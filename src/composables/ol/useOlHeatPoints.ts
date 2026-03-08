import { ref, shallowRef, unref, watch, type Ref } from 'vue'
import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import HeatmapLayer from 'ol/layer/Heatmap'
import VectorLayer from 'ol/layer/Vector'
import { fromLonLat } from 'ol/proj'
import { useMapEngine } from './engine/context'
import { useOlLayers } from './engine/useOlLayers'
import { useOlSources } from './engine/useOlSources'
import { onMapReady } from './engine/utils'
import type { Style } from 'ol/style'

type MaybeRef<T> = T | Ref<T>

export interface HeatPoint {
  id?: string | number
  lon: number
  lat: number
  weight?: number
  [k: string]: any
}

export interface UseOlHeatPointsOptions {
  points: MaybeRef<HeatPoint[]>

  sourceId?: string
  heatLayerId?: string
  pointLayerId?: string

  showHeat?: boolean
  showPoint?: boolean

  blur?: number
  radius?: number
  gradient?: string[]

  zIndexHeat?: number
  zIndexPoint?: number

  pointStyle?: Style

  /** 把后端 weight 转成 0~1 */
  weightFn?: (p: HeatPoint) => number

  /** 同 id 存在时是否替换（默认 true，保证热力积木重进页面不会叠图层） */
  replace?: boolean
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const toInt = (v: unknown, fallback: number) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n) : fallback
}

export function useOlHeatPoints(options: UseOlHeatPointsOptions) {
  const engine = useMapEngine()
  const layers = useOlLayers()
  const sources = useOlSources()

  const sourceId = options.sourceId ?? 'src:points'
  const heatLayerId = options.heatLayerId ?? 'layer:heat'
  const pointLayerId = options.pointLayerId ?? 'layer:points'

  const showHeat = ref(options.showHeat ?? true)
  const showPoint = ref(options.showPoint ?? false)
  const blur = ref(toInt(options.blur ?? 20, 20))
  const radius = ref(toInt(options.radius ?? 12, 12))

  const weightFn = options.weightFn ?? ((p) => clamp01(typeof p.weight === 'number' ? p.weight : 1))

  const src = sources.ensure(sourceId)

  const heatLayer = shallowRef<HeatmapLayer | null>(null)
  const pointLayer = shallowRef<VectorLayer<any> | null>(null)

  const setPoints = (pts: HeatPoint[]) => {
    const feats = new Array(pts.length)
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i] as HeatPoint
      const f = new Feature({ geometry: new Point(fromLonLat([p.lon, p.lat])) })
      f.set('weight', clamp01(weightFn(p)))
      f.set('data', p)
      if (p.id != null) f.setId(p.id)
      feats[i] = f
    }
    src.clear(true)
    src.addFeatures(feats)
  }

  const dispose = onMapReady(engine.map, () => {
    const h = new HeatmapLayer({
      source: src,
      blur: blur.value,
      radius: radius.value,
      gradient: options.gradient,
    })
    heatLayer.value = h
    layers.add(heatLayerId, h, {
      title: '热力图',
      group: 'data',
      zIndex: options.zIndexHeat ?? 20,
      visible: showHeat.value,
      replace: options.replace ?? true,
    })

    // Always create point layer; visibility is controlled reactively.
    const pl = new VectorLayer({ source: src, style: options.pointStyle })
    pointLayer.value = pl
    layers.add(pointLayerId, pl, {
      title: '点位',
      group: 'data',
      zIndex: options.zIndexPoint ?? 30,
      visible: showPoint.value,
      replace: options.replace ?? true,
    })

    setPoints(unref(options.points) ?? [])

    const stopPoints = watch(
      () => unref(options.points),
      (pts) => pts && setPoints(pts),
      { deep: false },
    )

    const stopBlur = watch(
      blur,
      (v) => {
        const next = Math.max(1, toInt(v, 20))
        if (next !== v) blur.value = next
        heatLayer.value?.setBlur(next)
      },
      { immediate: true },
    )

    const stopRadius = watch(
      radius,
      (v) => {
        const next = Math.max(1, toInt(v, 12))
        if (next !== v) radius.value = next
        heatLayer.value?.setRadius(next)
      },
      { immediate: true },
    )

    const stopShowHeat = watch(showHeat, (v) => layers.setVisible(heatLayerId, v), { immediate: true })
    const stopShowPoint = watch(showPoint, (v) => layers.setVisible(pointLayerId, v), { immediate: true })

    return () => {
      stopPoints(); stopBlur(); stopRadius(); stopShowHeat(); stopShowPoint()

      layers.remove(heatLayerId)
      layers.remove(pointLayerId)

      heatLayer.value = null
      pointLayer.value = null
      src.clear(true)
    }
  })

  return {
    source: src,
    heatLayer,
    pointLayer,
    showHeat,
    showPoint,
    blur,
    radius,
    setPoints,
    dispose,
  }
}
