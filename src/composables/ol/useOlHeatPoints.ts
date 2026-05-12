import { onUnmounted, ref, shallowRef, unref, watch, type Ref } from 'vue'
import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import HeatmapLayer from 'ol/layer/Heatmap'
import WebGLVectorLayer from 'ol/layer/WebGLVector'
import VectorSource from 'ol/source/Vector'
import { fromLonLat } from 'ol/proj'
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
  points?: MaybeRef<HeatPoint[]>

  showHeat?: boolean
  showPoint?: boolean

  blur?: number
  radius?: number
  gradient?: string[]

  zIndexHeat?: number
  zIndexPoint?: number

  /** @deprecated WebGL 渲染时不使用 ol/style，保留仅供兼容 */
  pointStyle?: Style

  /** 把后端 weight 转成 0~1 */
  weightFn?: (p: HeatPoint) => number
}

// 每帧最多处理的 Feature 数量，控制主线程占用 < 16ms
const CHUNK_SIZE = 2000

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const toInt = (v: unknown, fallback: number) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n) : fallback
}

/** requestIdleCallback polyfill */
const scheduleChunk: (cb: () => void) => void =
  typeof requestIdleCallback !== 'undefined'
    ? (cb) => requestIdleCallback(cb, { timeout: 50 })
    : (cb) => setTimeout(cb, 0)

export function useOlHeatPoints(options: UseOlHeatPointsOptions) {
  const showHeat = ref(options.showHeat ?? true)
  const showPoint = ref(options.showPoint ?? false)
  const blur = ref(toInt(options.blur ?? 20, 20))
  const radius = ref(toInt(options.radius ?? 12, 12))

  const weightFn = options.weightFn ?? ((p) => clamp01(typeof p.weight === 'number' ? p.weight : 1))

  const src = new VectorSource()

  const heatLayer = shallowRef(
    new HeatmapLayer({
      source: src,
      blur: blur.value,
      radius: radius.value,
      gradient: options.gradient,
      visible: showHeat.value,
      zIndex: options.zIndexHeat ?? 20,
    }),
  )
  const pointLayer = shallowRef(
    new WebGLVectorLayer({
      source: src,
      visible: showPoint.value,
      zIndex: options.zIndexPoint ?? 30,
      style: {
        'circle-radius': 6,
        'circle-fill-color': 'rgba(239,68,68,0.92)',
        'circle-stroke-color': 'rgba(127,29,29,0.9)',
        'circle-stroke-width': 1.5,
      },
    }),
  )

  /** 同步构建 Feature 列表（不入 source） */
  function buildFeatures(pts: HeatPoint[]): Feature[] {
    const feats = new Array<Feature>(pts.length)
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]
      if (!p) continue
      // 优先使用后端直传的 3857 坐标，避免昂贵的 fromLonLat 转换
      const coord: [number, number] =
        (p as any).x3857 != null && (p as any).y3857 != null
          ? [(p as any).x3857 as number, (p as any).y3857 as number]
          : (fromLonLat([p.lon, p.lat]) as [number, number])
      const f = new Feature({ geometry: new Point(coord) })
      f.set('weight', clamp01(weightFn(p)))
      f.set('data', p)
      if (p.id != null) f.setId(p.id)
      feats[i] = f
    }
    return feats
  }

  /**
   * 分批异步追加点，每帧最多处理 CHUNK_SIZE 个，不阻塞渲染。
   * 适合 EventSource 流式追加场景。
   */
  function addBatch(pts: HeatPoint[]) {
    if (pts.length === 0) return
    let i = 0

    function processChunk() {
      const end = Math.min(i + CHUNK_SIZE, pts.length)
      src.addFeatures(buildFeatures(pts.slice(i, end)))
      i = end
      if (i < pts.length) scheduleChunk(processChunk)
    }

    scheduleChunk(processChunk)
  }

  /** 清空所有点 */
  function clearAll() {
    src.clear(true)
  }

  /**
   * 全量替换（兼容旧调用方，内部同样分块以避免卡顿）。
   * 超过 5000 个点时自动走分块路径。
   */
  const setPoints = (pts: HeatPoint[]) => {
    src.clear(true)
    if (pts.length > 5000) {
      addBatch(pts)
    } else {
      src.addFeatures(buildFeatures(pts))
    }
  }

  if (options.points) {
    setPoints(unref(options.points) ?? [])
  }

  const watchers: (() => void)[] = []

  if (options.points) {
    watchers.push(
      watch(
        () => unref(options.points!),
        (pts) => pts && setPoints(pts),
        { deep: false },
      ),
    )
  }

  watchers.push(
    watch(
      blur,
      (v) => {
        const next = Math.max(1, toInt(v, 20))
        if (next !== v) blur.value = next
        heatLayer.value.setBlur(next)
      },
      { immediate: true },
    ),
    watch(
      radius,
      (v) => {
        const next = Math.max(1, toInt(v, 12))
        if (next !== v) radius.value = next
        heatLayer.value.setRadius(next)
      },
      { immediate: true },
    ),
  )

  function dispose() {
    watchers.forEach((stop) => stop())
    src.clear(true)
  }

  onUnmounted(dispose)

  return {
    source: src,
    heatLayer,
    pointLayer,
    showHeat,
    showPoint,
    blur,
    radius,
    setPoints,
    addBatch,
    clearAll,
    dispose,
  }
}
