<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
import 'ol/ol.css'
import { unByKey } from 'ol/Observable'
import type { EventsKey } from 'ol/events'
import Feature from 'ol/Feature'
import { fromExtent as polygonFromExtent } from 'ol/geom/Polygon'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import Overlay from 'ol/Overlay'
import { fromLonLat } from 'ol/proj'
import { Fill, RegularShape, Stroke, Style } from 'ol/style'
import { createMapEngine, provideMapEngine } from '@/composables/ol/engine/context'
import { useOlMap } from '@/composables/ol/useOlMap'
import { useOlHeatPoints, type HeatPoint } from '@/composables/ol/useOlHeatPoints'
import { useOlDraw } from '@/composables/ol/useOlDraw'
import { useOlViewport } from '@/composables/ol/useOlViewport'

const engine = createMapEngine()
provideMapEngine(engine)

const mapEl = ref<HTMLElement | null>(null)

const POINT_COUNT = 10000
const HEAT_HIDE_ZOOM = 13.5
const GRID_BASE_PIXEL = 56
const GRID_MIN_SIZE_M = 80
const GRID_MAX_SIZE_M = 2600

const { map } = useOlMap(mapEl, {
  view: {
    zoom: 10,
    center: [12958412, 4852030], // 北京
  },
})

const draw = useOlDraw()
const viewport = useOlViewport()

// ─── 数据类型 ──────────────────────────────────

type ClusterSeed = {
  lon: number
  lat: number
  ratio: number
  sigmaKm: number
  peak: number
}

type HeatPointEx = HeatPoint & {
  x3857: number
  y3857: number
}

// ─── 聚簇种子 ──────────────────────────────────

const BEIJING_CLUSTERS: ClusterSeed[] = [
  { lon: 116.4074, lat: 39.9042, ratio: 0.18, sigmaKm: 4.8, peak: 1.0 },
  { lon: 116.4551, lat: 39.9220, ratio: 0.20, sigmaKm: 6.5, peak: 0.95 },
  { lon: 116.2970, lat: 39.9593, ratio: 0.16, sigmaKm: 6.2, peak: 0.92 },
  { lon: 116.3339, lat: 39.7267, ratio: 0.14, sigmaKm: 5.5, peak: 0.86 },
  { lon: 116.1767, lat: 39.7353, ratio: 0.10, sigmaKm: 7.0, peak: 0.72 },
  { lon: 116.6535, lat: 40.1289, ratio: 0.08, sigmaKm: 7.5, peak: 0.68 },
  { lon: 116.1076, lat: 40.2208, ratio: 0.07, sigmaKm: 8.0, peak: 0.62 },
  { lon: 116.8434, lat: 39.9284, ratio: 0.07, sigmaKm: 8.5, peak: 0.60 },
]

// ─── 随机数据生成 ──────────────────────────────

function gaussianRandom(): number {
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function kmToLat(km: number) {
  return km / 111
}

function kmToLon(km: number, lat: number) {
  return km / (111 * Math.cos((lat * Math.PI) / 180))
}

function pickCluster(): ClusterSeed {
  const r = Math.random()
  let acc = 0
  for (let i = 0; i < BEIJING_CLUSTERS.length; i++) {
    acc += (BEIJING_CLUSTERS[i] as ClusterSeed).ratio
    if (r <= acc) return BEIJING_CLUSTERS[i] as ClusterSeed
  }
  return BEIJING_CLUSTERS[BEIJING_CLUSTERS.length - 1] as ClusterSeed
}

function generateBeijingRandomPoints(count: number): HeatPointEx[] {
  const data: HeatPointEx[] = new Array(count)

  for (let i = 0; i < count; i++) {
    const c = pickCluster()

    const dxKm = gaussianRandom() * c.sigmaKm
    const dyKm = gaussianRandom() * c.sigmaKm

    const lon = c.lon + kmToLon(dxKm, c.lat)
    const lat = c.lat + kmToLat(dyKm)

    const dist = Math.sqrt(dxKm * dxKm + dyKm * dyKm)
    const decay = Math.exp(-(dist * dist) / (2 * c.sigmaKm * c.sigmaKm))
    const localNoise = 0.15 + Math.random() * 0.25
    const base = c.peak * decay + localNoise
    const normalized = Math.max(0.03, Math.min(1, base))

    const [x3857, y3857] = fromLonLat([lon, lat]) as [number, number]

    data[i] = {
      id: i + 1,
      lon,
      lat,
      x3857,
      y3857,
      weight: normalized,
      clusterPeak: c.peak,
    }
  }

  const noiseCount = Math.floor(count * 0.06)
  for (let i = 0; i < noiseCount; i++) {
    const idx = Math.floor(Math.random() * count)
    const p = data[idx] as HeatPointEx
    p.weight = Math.max(0.02, Math.min(0.2, Math.random() * 0.18))
  }

  return data
}

// ─── 业务状态 ──────────────────────────────────

const basePoints = ref<HeatPointEx[]>([])
const targetPoints = ref<HeatPointEx[]>([])

const gridCellSize = ref(0)
const gridCellCount = ref(0)
const gridMaxCount = ref(1)

const gridSource = new VectorSource()
const gridLayer = shallowRef<VectorLayer<VectorSource> | null>(null)

let pointerMoveKey: EventsKey | null = null
const popupEl = ref<HTMLElement | null>(null)
let popupOverlay: Overlay | null = null
const hoveredPoint = ref<HeatPointEx | null>(null)

const hasSelection = computed(() => !!draw.geometry.value)
const selectedPointCount = computed(() => targetPoints.value.length)
const gridHeatVisible = computed(() => hasSelection.value && viewport.zoom.value < HEAT_HIDE_ZOOM)

// ─── 热力图 ──────────────────────────────────

const pointStyle = new Style({
  image: new RegularShape({
    points: 5,
    radius: 7,
    radius2: 3,
    angle: 0,
    fill: new Fill({ color: 'rgba(239, 68, 68, 0.95)' }),
    stroke: new Stroke({ color: 'rgba(127, 29, 29, 0.95)', width: 1.2 }),
  }),
})

const heat = useOlHeatPoints({
  points: targetPoints,
  showHeat: true,
  showPoint: false,
  radius: 14,
  blur: 22,
  pointStyle,
  gradient: ['#1d4ed8', '#0ea5e9', '#22c55e', '#fde047', '#f97316', '#dc2626'],
  weightFn: (p) => Math.max(0.01, Math.min(1, Number(p.weight ?? 0.1))),
})

const radiusModel = computed<number>({
  get: () => heat.radius.value,
  set: (v) => {
    heat.radius.value = Number(v)
  },
})

const blurModel = computed<number>({
  get: () => heat.blur.value,
  set: (v) => {
    heat.blur.value = Number(v)
  },
})

function applyBalancedPreset() {
  radiusModel.value = 14
  blurModel.value = 22
}

// ─── 网格热力 ──────────────────────────────────

function gridFillColorByRatio(r: number) {
  const ratio = Math.max(0, Math.min(1, r))
  if (ratio >= 0.9) return 'rgba(127, 29, 29, 0.62)'
  if (ratio >= 0.75) return 'rgba(185, 28, 28, 0.56)'
  if (ratio >= 0.55) return 'rgba(249, 115, 22, 0.52)'
  if (ratio >= 0.35) return 'rgba(245, 158, 11, 0.46)'
  if (ratio >= 0.2) return 'rgba(34, 197, 94, 0.42)'
  return 'rgba(14, 165, 233, 0.36)'
}

const gridStyleCache = new Map<number, Style>()

function getGridStyleByCount(count: number) {
  const max = Math.max(1, gridMaxCount.value)
  const ratio = count / max
  const bucket = Math.max(1, Math.round(ratio * 20))

  if (gridStyleCache.has(bucket)) return gridStyleCache.get(bucket) as Style

  const style = new Style({
    fill: new Fill({ color: gridFillColorByRatio(bucket / 20) }),
    stroke: new Stroke({ color: 'rgba(30, 41, 59, 0.28)', width: 0.8 }),
  })

  gridStyleCache.set(bucket, style)
  return style
}

function syncLayerByZoom() {
  const hideHeat = viewport.zoom.value >= HEAT_HIDE_ZOOM
  heat.showHeat.value = !hideHeat
  heat.showPoint.value = hideHeat

  if (gridLayer.value) {
    const visible = hasSelection.value && !hideHeat && gridCellCount.value > 0
    gridLayer.value.setVisible(visible)
  }
}

function rebuildGridHeat() {
  gridSource.clear(true)
  gridCellCount.value = 0
  gridMaxCount.value = 1
  gridStyleCache.clear()

  const geom = draw.geometry.value
  if (!geom) return
  if (viewport.zoom.value >= HEAT_HIDE_ZOOM) return
  if (targetPoints.value.length === 0) return

  const [minX, minY, maxX, maxY] = geom.getExtent() as [number, number, number, number]
  const cellSize = Math.max(GRID_MIN_SIZE_M, Math.min(GRID_MAX_SIZE_M, viewport.resolution.value * GRID_BASE_PIXEL))
  gridCellSize.value = Math.round(cellSize)

  const cols = Math.max(1, Math.ceil((maxX - minX) / cellSize))
  const rows = Math.max(1, Math.ceil((maxY - minY) / cellSize))

  const counter = new Map<string, number>()

  for (let i = 0; i < targetPoints.value.length; i++) {
    const p = targetPoints.value[i] as HeatPointEx
    const x = p.x3857
    const y = p.y3857

    if (x < minX || x > maxX || y < minY || y > maxY) continue

    const col = Math.min(cols - 1, Math.max(0, Math.floor((x - minX) / cellSize)))
    const row = Math.min(rows - 1, Math.max(0, Math.floor((y - minY) / cellSize)))
    const key = `${col}_${row}`

    counter.set(key, (counter.get(key) || 0) + 1)
  }

  if (counter.size === 0) return

  let maxCount = 1
  const features: Feature[] = []

  for (const [key, count] of counter.entries()) {
    if (count > maxCount) maxCount = count

    const [colRaw, rowRaw] = key.split('_')
    const col = Number(colRaw)
    const row = Number(rowRaw)

    const x1 = minX + col * cellSize
    const y1 = minY + row * cellSize
    const x2 = Math.min(maxX, x1 + cellSize)
    const y2 = Math.min(maxY, y1 + cellSize)

    const cellExtent: [number, number, number, number] = [x1, y1, x2, y2]
    if (!geom.intersectsExtent(cellExtent)) continue

    const feature = new Feature(polygonFromExtent(cellExtent))
    feature.set('count', count)
    features.push(feature)
  }

  gridMaxCount.value = Math.max(1, maxCount)
  gridCellCount.value = features.length

  if (features.length) gridSource.addFeatures(features)
}

// ─── 框选联动 ──────────────────────────────────

function applySelection() {
  if (!draw.geometry.value) {
    targetPoints.value = basePoints.value.slice()
    rebuildGridHeat()
    syncLayerByZoom()
    return
  }

  const geom = draw.geometry.value
  const filtered = basePoints.value.filter((p) => geom.intersectsCoordinate([p.x3857, p.y3857]))
  targetPoints.value = filtered

  rebuildGridHeat()
  syncLayerByZoom()
}

function clearSelection() {
  draw.clear()
  gridSource.clear(true)
  gridCellCount.value = 0
  gridCellSize.value = 0

  targetPoints.value = basePoints.value.slice()
  syncLayerByZoom()
}

function beginDraw(mode: 'rect' | 'polygon') {
  gridSource.clear(true)
  gridCellCount.value = 0
  gridCellSize.value = 0

  draw.start(mode)
}

function refresh() {
  basePoints.value = generateBeijingRandomPoints(POINT_COUNT)
  if (draw.geometry.value) {
    applySelection()
    return
  }
  targetPoints.value = basePoints.value.slice()
  syncLayerByZoom()
}

// ─── draw.geometry 变化时自动触发筛选 ──────────

watch(draw.geometry, (geom) => {
  if (geom) applySelection()
})

// ─── viewport 变化时联动图层和网格 ──────────────

watch(viewport.zoom, () => {
  if (draw.geometry.value) rebuildGridHeat()
  syncLayerByZoom()
})

// ─── 地图初始化后：网格图层 + Popup ──────────────

watch(
  map,
  (olMap) => {
    if (!olMap || gridLayer.value) return

    const gridLayerInst = new VectorLayer({
      source: gridSource,
      zIndex: 34,
      visible: false,
      style: (feature) => {
        const count = Number(feature.get('count') || 0)
        return getGridStyleByCount(count)
      },
    })

    gridLayer.value = gridLayerInst
    olMap.addLayer(gridLayerInst)

    popupOverlay = new Overlay({
      element: popupEl.value!,
      positioning: 'bottom-center',
      offset: [0, -12],
      stopEvent: false,
    })
    olMap.addOverlay(popupOverlay)

    pointerMoveKey = olMap.on('pointermove', (evt) => {
      if (evt.dragging) {
        hoveredPoint.value = null
        popupOverlay?.setPosition(undefined)
        return
      }

      const feature = olMap.forEachFeatureAtPixel(evt.pixel, (f) => f, {
        layerFilter: (l) => l === heat.pointLayer.value,
        hitTolerance: 4,
      })

      if (feature) {
        const data = (feature as Feature).get('data') as HeatPointEx | undefined
        if (data) {
          hoveredPoint.value = data
          popupOverlay?.setPosition(evt.coordinate)
          const el = olMap.getTargetElement()
          if (el) el.style.cursor = 'pointer'
          return
        }
      }

      hoveredPoint.value = null
      popupOverlay?.setPosition(undefined)
      const el = olMap.getTargetElement()
      if (el) el.style.cursor = ''
    })

    refresh()
    syncLayerByZoom()
  },
  { immediate: true },
)

onUnmounted(() => {
  if (pointerMoveKey) {
    unByKey(pointerMoveKey)
    pointerMoveKey = null
  }

  const olMap = map.value
  if (olMap) {
    if (popupOverlay) olMap.removeOverlay(popupOverlay)
    if (gridLayer.value) olMap.removeLayer(gridLayer.value)
  }

  popupOverlay = null
  gridLayer.value = null
  gridSource.clear(true)
})
</script>

<template>
  <div class="relative h-screen w-full overflow-hidden">
    <div ref="mapEl" class="h-full w-full"></div>

    <div ref="popupEl" class="ol-popup" :class="{ 'ol-popup--visible': hoveredPoint }">
      <template v-if="hoveredPoint">
        <div class="ol-popup__title">ID: {{ hoveredPoint.id }}</div>
        <div class="ol-popup__row"><span class="ol-popup__label">经度</span><span>{{ hoveredPoint.lon.toFixed(6) }}</span></div>
        <div class="ol-popup__row"><span class="ol-popup__label">纬度</span><span>{{ hoveredPoint.lat.toFixed(6) }}</span></div>
        <div class="ol-popup__row"><span class="ol-popup__label">权重</span><span>{{ hoveredPoint.weight.toFixed(4) }}</span></div>
        <div class="ol-popup__row"><span class="ol-popup__label">聚簇峰值</span><span>{{ hoveredPoint.clusterPeak }}</span></div>
      </template>
    </div>

    <div class="absolute left-4 top-4 z-20 w-94 max-w-[calc(100vw-2rem)]">
      <ElCard class="rounded-4 border-0 bg-white/88 shadow-2xl shadow-slate-900/12 backdrop-blur-md">
        <div class="flex items-center justify-between gap-3">
          <div class="text-sm font-semibold text-slate-700">选区网格热力控制台</div>
          <ElTag size="small" :type="gridHeatVisible ? 'success' : 'info'">
            {{ gridHeatVisible ? '网格热力显示中' : '点位模式' }}
          </ElTag>
        </div>

        <div class="mt-3 flex flex-wrap items-center gap-2">
          <ElButton type="primary" size="small" @click="beginDraw('rect')">矩形框选</ElButton>
          <ElButton type="primary" plain size="small" @click="beginDraw('polygon')">多边形框选</ElButton>
          <ElButton size="small" @click="clearSelection">清空框选</ElButton>
          <ElButton size="small" @click="refresh">刷新 {{ POINT_COUNT }} 点</ElButton>
          <ElButton size="small" @click="applyBalancedPreset">均衡预设</ElButton>
        </div>

        <div class="mt-2 rounded-3 bg-slate-50 px-3 py-2 text-xs text-slate-600 leading-5">
          当前绘制模式：<span class="font-semibold">{{ draw.mode.value === 'none' ? '无' : draw.mode.value === 'rect' ? '矩形' : '多边形' }}</span>
          ，选中点位 <span class="font-semibold">{{ selectedPointCount }}</span> 个，网格 <span class="font-semibold">{{ gridCellCount }}</span> 个。
          网格尺寸约 <span class="font-semibold">{{ gridCellSize || '-' }}</span> 米，Zoom <span class="font-semibold">{{ viewport.zoom.value.toFixed(2) }}</span>。
        </div>

        <ElDivider class="my-3" />

        <div class="space-y-4">
          <div>
            <div class="mb-1 flex items-center justify-between text-xs text-slate-600">
              <span>Heat Radius</span>
              <span class="font-semibold text-slate-800">{{ radiusModel }}</span>
            </div>
            <ElSlider v-model="radiusModel" :min="4" :max="40" :step="1" size="small" />
          </div>

          <div>
            <div class="mb-1 flex items-center justify-between text-xs text-slate-600">
              <span>Heat Blur</span>
              <span class="font-semibold text-slate-800">{{ blurModel }}</span>
            </div>
            <ElSlider v-model="blurModel" :min="4" :max="60" :step="1" size="small" />
          </div>

          <div class="rounded-3 bg-slate-50 px-3 py-2 text-xs text-slate-600 leading-5">
            框选后会在选区内按当前缩放级别网格化聚合并叠加网格热力。继续放大时网格自动细化；当缩放达到
            <span class="font-semibold">{{ HEAT_HIDE_ZOOM }}</span> 后隐藏热力，直接展示目标点。
          </div>
        </div>
      </ElCard>
    </div>
  </div>
</template>

<style scoped>
.ol-popup {
  position: absolute;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(8px);
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 12px;
  line-height: 1.6;
  color: #334155;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.14);
  white-space: nowrap;
  min-width: 160px;
}

.ol-popup--visible {
  opacity: 1;
}

.ol-popup__title {
  font-weight: 600;
  font-size: 13px;
  color: #1e293b;
  margin-bottom: 4px;
  padding-bottom: 4px;
  border-bottom: 1px solid #e2e8f0;
}

.ol-popup__row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.ol-popup__label {
  color: #94a3b8;
}
</style>
