import { shallowRef, watch, type Ref } from 'vue'
import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { Fill, RegularShape, Stroke, Style } from 'ol/style'
import { useMapEngine } from './engine/context'
import { onMapReady } from './engine/utils'

interface Locatable {
  id: string | number
  x3857: number
  y3857: number
}

export interface UseOlHighlightLayerOptions {
  zIndex?: number
  style?: Style
}

const DEFAULT_STYLE = new Style({
  image: new RegularShape({
    points: 5,
    radius: 12,
    radius2: 5,
    angle: 0,
    fill: new Fill({ color: 'rgba(255, 220, 0, 0.95)' }),
    stroke: new Stroke({ color: 'rgba(234, 88, 12, 0.95)', width: 2 }),
  }),
})

export function useOlHighlightLayer(
  mode: Ref<string>,
  highlightedIds: Ref<Set<string>>,
  getStore: () => Locatable[],
  options?: UseOlHighlightLayerOptions,
) {
  const engine = useMapEngine()

  const source = new VectorSource()
  const layer = shallowRef<VectorLayer<VectorSource> | null>(null)

  onMapReady(engine.map, (map) => {
    const inst = new VectorLayer({
      source,
      zIndex: options?.zIndex ?? 50,
      visible: false,
      style: options?.style ?? DEFAULT_STYLE,
    })
    layer.value = inst
    map.addLayer(inst)

    const stop = watch(
      [mode, highlightedIds],
      ([m, ids]) => {
        if (m !== 'highlight' || ids.size === 0) {
          source.clear(true)
          inst.setVisible(false)
          return
        }
        const features = getStore()
          .filter((p) => ids.has(String(p.id)))
          .map((p) => {
            const f = new Feature({ geometry: new Point([p.x3857, p.y3857]) })
            f.setId(p.id)
            return f
          })
        source.clear(true)
        source.addFeatures(features)
        inst.setVisible(true)
      },
      { immediate: true, deep: false },
    )

    return () => {
      stop()
      map.removeLayer(inst)
      layer.value = null
      source.clear(true)
    }
  })

  return { layer, source }
}
