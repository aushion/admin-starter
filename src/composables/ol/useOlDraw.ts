import { computed, ref, shallowRef, type ComputedRef, type Ref, type ShallowRef } from 'vue'
import Draw, { createBox } from 'ol/interaction/Draw'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import type Geometry from 'ol/geom/Geometry'
import type { StyleLike } from 'ol/style/Style'
import { Fill, Stroke, Style } from 'ol/style'
import { useMapEngine } from './engine/context'
import { onMapReady } from './engine/utils'

export type DrawMode = 'none' | 'rect' | 'polygon'

export interface UseOlDrawOptions {
  /** 框选区域样式，有默认值 */
  selectionStyle?: StyleLike
  /** 绘制图层 zIndex，默认 36 */
  zIndex?: number
}

export interface UseOlDrawReturn {
  /** 框选完成后的几何体（null 表示未框选） */
  geometry: ShallowRef<Geometry | null>
  /** 当前绘制模式 */
  mode: Ref<DrawMode>
  /** 是否正在绘制中 */
  isDrawing: ComputedRef<boolean>
  /** 开始绘制，自动清除上一次框选 */
  start: (mode: Exclude<DrawMode, 'none'>) => void
  /** 清除框选结果和绘制图层 */
  clear: () => void
}

const DEFAULT_SELECTION_STYLE = new Style({
  fill: new Fill({ color: 'rgba(59, 130, 246, 0.10)' }),
  stroke: new Stroke({ color: 'rgba(59, 130, 246, 0.9)', width: 2, lineDash: [8, 6] }),
})

export function useOlDraw(options?: UseOlDrawOptions): UseOlDrawReturn {
  const engine = useMapEngine()

  const geometry = shallowRef<Geometry | null>(null)
  const mode = ref<DrawMode>('none')
  const isDrawing = computed(() => mode.value !== 'none')

  const drawSource = new VectorSource()
  const drawLayer = new VectorLayer({
    source: drawSource,
    zIndex: options?.zIndex ?? 36,
    style: options?.selectionStyle ?? DEFAULT_SELECTION_STYLE,
  })

  let drawInteraction: Draw | null = null

  const teardownInteraction = () => {
    if (!drawInteraction) return
    const map = engine.map.value
    if (map) map.removeInteraction(drawInteraction)
    drawInteraction = null
  }

  const clear = () => {
    teardownInteraction()
    mode.value = 'none'
    geometry.value = null
    drawSource.clear(true)
  }

  const start = (drawMode: Exclude<DrawMode, 'none'>) => {
    const map = engine.map.value
    if (!map) return

    // 清除上一次状态
    teardownInteraction()
    drawSource.clear(true)
    geometry.value = null

    mode.value = drawMode

    const interaction = new Draw({
      source: drawSource,
      type: drawMode === 'rect' ? 'Circle' : 'Polygon',
      geometryFunction: drawMode === 'rect' ? createBox() : undefined,
    })

    interaction.on('drawend', (evt) => {
      const geom = evt.feature?.getGeometry?.()
      geometry.value = geom ? (geom.clone() as Geometry) : null
      mode.value = 'none'
      teardownInteraction()
    })

    drawInteraction = interaction
    map.addInteraction(interaction)
  }

  onMapReady(engine.map, (map) => {
    map.addLayer(drawLayer)

    return () => {
      teardownInteraction()
      map.removeLayer(drawLayer)
      drawSource.clear(true)
    }
  })

  return { geometry, mode, isDrawing, start, clear }
}
