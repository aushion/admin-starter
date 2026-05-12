import { ref, shallowRef, watch } from 'vue'
import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import VectorLayer from 'ol/layer/Vector'
import ClusterSource from 'ol/source/Cluster'
import VectorSource from 'ol/source/Vector'
import { Circle, Fill, Stroke, Style, Text } from 'ol/style'
import { useMapEngine } from './engine/context'
import { onMapReady } from './engine/utils'

export interface ClusterPoint {
  id: string | number
  x3857: number
  y3857: number
  [k: string]: unknown
}

export interface UseOlClusterPointsOptions {
  distance?: number
  minDistance?: number
  zIndex?: number
  singleColor?: string
  clusterColors?: {
    small: string
    medium: string
    large: string
  }
}

const CHUNK_SIZE = 5000

const scheduleChunk: (cb: () => void) => void =
  typeof requestIdleCallback !== 'undefined'
    ? (cb) => requestIdleCallback(cb, { timeout: 50 })
    : (cb) => setTimeout(cb, 0)

function getClusterBucket(size: number): string {
  if (size < 10) return '2'
  if (size < 100) return '3'
  if (size < 1000) return '4'
  return '5'
}

export function useOlClusterPoints<T extends ClusterPoint>(options?: UseOlClusterPointsOptions) {
  const engine = useMapEngine()

  const pointSource = new VectorSource()
  const clusterSource = new ClusterSource({
    distance: options?.distance ?? 44,
    minDistance: options?.minDistance ?? 12,
    source: pointSource,
  })

  const layer = shallowRef<VectorLayer<ClusterSource> | null>(null)
  const visible = ref(true)
  const isRendering = ref(false)
  const renderedCount = ref(0)
  const totalCount = ref(0)

  const styleCache = new Map<string, Style>()
  let renderToken = 0

  function buildFeature(p: T): Feature {
    const feature = new Feature({ geometry: new Point([p.x3857, p.y3857]) })
    feature.setId(p.id)
    feature.set('data', p)
    return feature
  }

  function styleForCluster(feature: Feature): Style {
    const members = (feature.get('features') as Feature[] | undefined) ?? []
    const size = members.length || 1
    const key = size === 1 ? 'single' : getClusterBucket(size)
    const cached = styleCache.get(key)
    if (cached) return cached

    const radius = size === 1 ? 5 : Math.min(28, 12 + Math.log10(size) * 5)
    const fillColor =
      size === 1
        ? (options?.singleColor ?? 'rgba(37, 99, 235, 0.78)')
        : size < 100
          ? (options?.clusterColors?.small ?? 'rgba(14, 165, 233, 0.88)')
          : size < 1000
            ? (options?.clusterColors?.medium ?? 'rgba(245, 158, 11, 0.88)')
            : (options?.clusterColors?.large ?? 'rgba(220, 38, 38, 0.9)')

    const style = new Style({
      image: new Circle({
        radius,
        fill: new Fill({ color: fillColor }),
        stroke: new Stroke({ color: 'rgba(255, 255, 255, 0.92)', width: size === 1 ? 1 : 2 }),
      }),
      text:
        size === 1
          ? undefined
          : new Text({
              text: String(size),
              fill: new Fill({ color: '#fff' }),
              stroke: new Stroke({ color: 'rgba(15, 23, 42, 0.35)', width: 3 }),
              font: '600 12px sans-serif',
            }),
    })
    styleCache.set(key, style)
    return style
  }

  function clearPoints(): void {
    renderToken++
    pointSource.clear(true)
    renderedCount.value = 0
    totalCount.value = 0
    isRendering.value = false
  }

  function setPoints(points: T[]): void {
    const token = ++renderToken
    pointSource.clear(true)
    renderedCount.value = 0
    totalCount.value = points.length
    isRendering.value = points.length > 0

    if (points.length === 0) {
      isRendering.value = false
      return
    }

    let index = 0

    function processChunk() {
      if (token !== renderToken) return
      const end = Math.min(index + CHUNK_SIZE, points.length)
      const features = new Array<Feature>(end - index)
      for (let i = index; i < end; i++) {
        features[i - index] = buildFeature(points[i] as T)
      }
      pointSource.addFeatures(features)
      index = end
      renderedCount.value = end

      if (index < points.length) {
        scheduleChunk(processChunk)
      } else {
        isRendering.value = false
      }
    }

    scheduleChunk(processChunk)
  }

  onMapReady(engine.map, (map) => {
    const inst = new VectorLayer({
      source: clusterSource,
      zIndex: options?.zIndex ?? 30,
      visible: visible.value,
      style: styleForCluster as any,
    })
    layer.value = inst
    map.addLayer(inst)

    const stop = watch(visible, (v) => inst.setVisible(v), { immediate: true })

    return () => {
      renderToken++
      stop()
      map.removeLayer(inst)
      layer.value = null
      pointSource.clear(true)
    }
  })

  return {
    source: pointSource,
    clusterSource,
    layer,
    visible,
    isRendering,
    renderedCount,
    totalCount,
    setPoints,
    clearPoints,
  }
}
