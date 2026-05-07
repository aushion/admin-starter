import { ref, shallowRef, type Ref, type ShallowRef } from 'vue'
import Feature from 'ol/Feature'
import { fromExtent as polygonFromExtent } from 'ol/geom/Polygon'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { Fill, Stroke, Style } from 'ol/style'
import type Geometry from 'ol/geom/Geometry'
import { useMapEngine } from './engine/context'
import { onMapReady } from './engine/utils'

export interface GridPoint {
  x3857: number
  y3857: number
}

export interface UseOlGridLayerOptions {
  zIndex?: number
  minSizeM?: number
  maxSizeM?: number
  basePixel?: number
  heatHideZoom?: number
}

export function useOlGridLayer(
  geometry: ShallowRef<Geometry | null>,
  zoom: Ref<number>,
  resolution: Ref<number>,
  getPoints: () => GridPoint[],
  options?: UseOlGridLayerOptions,
) {
  const GRID_MIN_SIZE_M = options?.minSizeM ?? 80
  const GRID_MAX_SIZE_M = options?.maxSizeM ?? 2600
  const GRID_BASE_PIXEL = options?.basePixel ?? 56
  const HEAT_HIDE_ZOOM = options?.heatHideZoom ?? 13.5

  const engine = useMapEngine()

  const cellSize = ref(0)
  const cellCount = ref(0)
  const maxCount = ref(1)

  const source = new VectorSource()
  const layer = shallowRef<VectorLayer<VectorSource> | null>(null)
  const styleCache = new Map<number, Style>()

  function fillColor(ratio: number): string {
    const r = Math.max(0, Math.min(1, ratio))
    if (r >= 0.9) return 'rgba(127, 29, 29, 0.62)'
    if (r >= 0.75) return 'rgba(185, 28, 28, 0.56)'
    if (r >= 0.55) return 'rgba(249, 115, 22, 0.52)'
    if (r >= 0.35) return 'rgba(245, 158, 11, 0.46)'
    if (r >= 0.2) return 'rgba(34, 197, 94, 0.42)'
    return 'rgba(14, 165, 233, 0.36)'
  }

  function styleByCount(count: number): Style {
    const bucket = Math.max(1, Math.round((count / Math.max(1, maxCount.value)) * 20))
    if (styleCache.has(bucket)) return styleCache.get(bucket)!
    const s = new Style({
      fill: new Fill({ color: fillColor(bucket / 20) }),
      stroke: new Stroke({ color: 'rgba(30, 41, 59, 0.28)', width: 0.8 }),
    })
    styleCache.set(bucket, s)
    return s
  }

  function rebuild(): void {
    source.clear(true)
    cellCount.value = 0
    maxCount.value = 1
    styleCache.clear()

    const geom = geometry.value
    if (!geom || zoom.value >= HEAT_HIDE_ZOOM) return

    const pts = getPoints()
    if (pts.length === 0) return

    const [minX, minY, maxX, maxY] = geom.getExtent() as [number, number, number, number]
    const size = Math.max(
      GRID_MIN_SIZE_M,
      Math.min(GRID_MAX_SIZE_M, resolution.value * GRID_BASE_PIXEL),
    )
    cellSize.value = Math.round(size)

    const cols = Math.max(1, Math.ceil((maxX - minX) / size))
    const rows = Math.max(1, Math.ceil((maxY - minY) / size))
    const counter = new Map<string, number>()

    for (const p of pts) {
      const { x3857: x, y3857: y } = p
      if (x < minX || x > maxX || y < minY || y > maxY) continue
      const col = Math.min(cols - 1, Math.max(0, Math.floor((x - minX) / size)))
      const row = Math.min(rows - 1, Math.max(0, Math.floor((y - minY) / size)))
      const key = `${col}_${row}`
      counter.set(key, (counter.get(key) || 0) + 1)
    }

    if (counter.size === 0) return

    let max = 1
    const features: Feature[] = []

    for (const [key, count] of counter) {
      if (count > max) max = count
      const [c, r] = key.split('_').map(Number) as [number, number]
      const x1 = minX + c * size
      const y1 = minY + r * size
      const x2 = Math.min(maxX, x1 + size)
      const y2 = Math.min(maxY, y1 + size)
      const ext: [number, number, number, number] = [x1, y1, x2, y2]
      if (!geom.intersectsExtent(ext)) continue
      const f = new Feature(polygonFromExtent(ext))
      f.set('count', count)
      features.push(f)
    }

    maxCount.value = Math.max(1, max)
    cellCount.value = features.length
    if (features.length) source.addFeatures(features)
  }

  function clear(): void {
    source.clear(true)
    cellCount.value = 0
    cellSize.value = 0
    maxCount.value = 1
    styleCache.clear()
    layer.value?.setVisible(false)
  }

  function syncVisible(hasSelection: boolean): void {
    layer.value?.setVisible(hasSelection && zoom.value < HEAT_HIDE_ZOOM && cellCount.value > 0)
  }

  onMapReady(engine.map, (map) => {
    const inst = new VectorLayer({
      source,
      zIndex: options?.zIndex ?? 34,
      visible: false,
      style: (feature) => styleByCount(Number(feature.get('count') || 0)),
    })
    layer.value = inst
    map.addLayer(inst)

    return () => {
      map.removeLayer(inst)
      layer.value = null
      source.clear(true)
    }
  })

  return { cellSize, cellCount, layer, rebuild, clear, syncVisible }
}
