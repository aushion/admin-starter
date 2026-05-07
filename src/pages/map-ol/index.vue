<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import 'ol/ol.css'
import { unByKey } from 'ol/Observable'
import Feature from 'ol/Feature'
import { toLonLat } from 'ol/proj'
import { createMapEngine, provideMapEngine } from '@/composables/ol/engine/context'
import { onMapReady } from '@/composables/ol/engine/utils'
import { useOlMap } from '@/composables/ol/useOlMap'
import { useOlHeatPoints, type HeatPoint } from '@/composables/ol/useOlHeatPoints'
import { useOlDraw } from '@/composables/ol/useOlDraw'
import { useOlViewport } from '@/composables/ol/useOlViewport'
import { useDashboardChannel } from '@/composables/ol/useDashboardChannel'
import { useEventSourcePoints, type RawStreamPoint } from '@/composables/ol/useEventSourcePoints'
import { useOlGridLayer } from '@/composables/ol/useOlGridLayer'
import { useOlBackendGridLayer } from '@/composables/ol/useOlBackendGridLayer'
import { useOlHighlightLayer } from '@/composables/ol/useOlHighlightLayer'
import { useOlPointPopup } from '@/composables/ol/useOlPointPopup'

const engine = createMapEngine()
provideMapEngine(engine)

const mapEl = ref<HTMLElement | null>(null)
const popupEl = ref<HTMLElement | null>(null)

const HEAT_HIDE_ZOOM = 13.5

const { map } = useOlMap(mapEl, {
  view: {
    zoom: 10,
    center: [12958412, 4852030],
  },
})

const draw = useOlDraw()
const viewport = useOlViewport()

// ─── 数据类型 ──────────────────────────────────

type HeatPointEx = HeatPoint & {
  x3857: number
  y3857: number
}

function rowToHeatPointEx(row: { id: string; coord3857: [number, number] }): HeatPointEx {
  const [x3857, y3857] = row.coord3857
  const [lon, lat] = toLonLat([x3857, y3857]) as [number, number]
  return { id: Number(row.id), lon, lat, x3857, y3857, weight: 0.5, clusterPeak: 1 }
}

// ─── 频道（高亮 / 筛选 / 清除）──────────────────

const { mode, filteredPoints, highlightedIds, pendingCenter } = useDashboardChannel()

/**
 * 全量原始点本地存储（非响应式，避免 100k 点触发 Vue 追踪开销）。
 * 仅在 draw-selection 筛选时被同步读取。
 */
const rawPointsStore: HeatPointEx[] = []

// ─── EventSource 流式加载 ──────────────────────

const isLoaded = ref(false)
const isStarted = ref(false)
const streamProgress = ref(0)
const streamReceived = ref(0)
const streamTotal = ref(0)
const streamError = ref('')

const eventSource = useEventSourcePoints({
  onBatch(batch: RawStreamPoint[], done: boolean, totalReceived: number) {
    const converted = batch.map(rowToHeatPointEx)
    rawPointsStore.push(...converted)
    heat.addBatch(converted)
    streamReceived.value = totalReceived
    if (streamTotal.value > 0) streamProgress.value = Math.min(1, totalReceived / streamTotal.value)
    if (done) {
      isLoaded.value = true
      streamProgress.value = 1
    }
  },
  onError() {
    streamError.value = '数据流连接失败，请刷新重试'
  },
  onDone(total) {
    streamReceived.value = total
    streamProgress.value = 1
    isLoaded.value = true
  },
})

watch(eventSource.expectedTotal, (v) => {
  if (v > 0) streamTotal.value = v
})

// ─── 框选筛选点集 ──────────────────────────────

const selectionPoints = computed<HeatPointEx[]>(() => {
  if (mode.value === 'filter') return filteredPoints.value.map(rowToHeatPointEx)
  const geom = draw.geometry.value
  if (geom) return rawPointsStore.filter((p) => geom.intersectsCoordinate([p.x3857, p.y3857]))
  return []
})

// ─── 热力图 ──────────────────────────────────

const heat = useOlHeatPoints({
  showHeat: true,
  showPoint: false,
  radius: 14,
  blur: 22,
  gradient: ['#1d4ed8', '#0ea5e9', '#22c55e', '#fde047', '#f97316', '#dc2626'],
  weightFn: (p) => Math.max(0.01, Math.min(1, Number(p.weight ?? 0.1))),
})

watch(
  [mode, filteredPoints],
  ([m]) => {
    if (m === 'filter') {
      heat.clearAll()
      heat.addBatch(filteredPoints.value.map(rowToHeatPointEx))
    } else if (m === 'normal' && rawPointsStore.length > 0) {
      heat.clearAll()
      heat.addBatch(rawPointsStore)
    }
  },
  { deep: false },
)

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

// ─── 图层组合 ──────────────────────────────────

const grid = useOlGridLayer(
  draw.geometry,
  viewport.zoom,
  viewport.resolution,
  () => selectionPoints.value,
)

const backendGrid = useOlBackendGridLayer({
  fetchGrids: async (_extent) => {
    // TODO: replace with real API call
    // const [lonMin, latMin] = toLonLat([_extent[0], _extent[1]])
    // const [lonMax, latMax] = toLonLat([_extent[2], _extent[3]])
    // return fetch(`/api/grids?...`).then(r => r.json())
    return [
      { longitudeMin: 116.0, longitudeMax: 116.5, latitudeMin: 39.7, latitudeMax: 40.0, id: 'g1' },
      { longitudeMin: 116.5, longitudeMax: 117.0, latitudeMin: 39.7, latitudeMax: 40.0, id: 'g2' },
      { longitudeMin: 116.0, longitudeMax: 116.5, latitudeMin: 40.0, latitudeMax: 40.3, id: 'g3' },
      { longitudeMin: 116.5, longitudeMax: 117.0, latitudeMin: 40.0, latitudeMax: 40.3, id: 'g4' },
    ]
  },
})

useOlHighlightLayer(mode, highlightedIds, () => rawPointsStore)

const popup = useOlPointPopup<HeatPointEx>(popupEl)

// ─── 派生状态 ──────────────────────────────────

const hasSelection = computed(() => !!draw.geometry.value)
const selectedPointCount = computed(() => selectionPoints.value.length)
const gridHeatVisible = computed(() => hasSelection.value && viewport.zoom.value < HEAT_HIDE_ZOOM)

// ─── 框选控制 ──────────────────────────────────

const isBoxSelecting = ref(false)

function syncLayerByZoom() {
  const hideHeat = viewport.zoom.value >= HEAT_HIDE_ZOOM
  heat.showHeat.value = !hideHeat
  heat.showPoint.value = hideHeat
  grid.syncVisible(hasSelection.value)
}

function applySelection() {
  if (!draw.geometry.value) {
    syncLayerByZoom()
    return
  }
  grid.rebuild()
  syncLayerByZoom()
}

function beginDraw(drawMode: 'rect' | 'polygon') {
  grid.clear()
  draw.start(drawMode)
}

function clearSelection() {
  draw.clear()
  grid.clear()
  backendGrid.clear()
  syncLayerByZoom()
}

function beginBoxSelection() {
  backendGrid.clear()
  isBoxSelecting.value = true
  beginDraw('rect')
}

watch(draw.geometry, async (geom) => {
  if (!geom) return
  if (isBoxSelecting.value) {
    isBoxSelecting.value = false
    await backendGrid.query(geom.getExtent() as [number, number, number, number])
  } else {
    applySelection()
  }
})

watch(viewport.zoom, () => {
  if (draw.geometry.value) grid.rebuild()
  syncLayerByZoom()
})

watch(pendingCenter, (center) => {
  if (!center || !map.value) return
  map.value.getView().animate({ center, zoom: 14, duration: 600 }, () => {
    pendingCenter.value = null
  })
})

// ─── 手动加载点位数据 ──────────────────────────

function loadPoints() {
  if (isStarted.value) return
  isStarted.value = true
  eventSource.connect('/api/stream/map-points')
}

// ─── 地图就绪：Hover 交互 ──────────────────────

onMapReady(engine.map, (olMap) => {
  const key = olMap.on('pointermove', (evt) => {
    if (evt.dragging) {
      popup.hide()
      return
    }

    const feature = olMap.forEachFeatureAtPixel(evt.pixel, (f) => f, {
      layerFilter: (l) => l === heat.pointLayer.value,
      hitTolerance: 4,
    })

    if (feature) {
      const data = (feature as Feature).get('data') as HeatPointEx | undefined
      if (data) {
        popup.show(data, evt.coordinate)
        olMap.getTargetElement().style.cursor = 'pointer'
        return
      }
    }

    popup.hide()
    olMap.getTargetElement().style.cursor = ''
  })

  syncLayerByZoom()

  return () => unByKey(key)
})
</script>

<template>
  <div class="relative h-screen w-full overflow-hidden">
    <div ref="mapEl" class="h-full w-full"></div>

    <!-- 流式加载进度条 -->
    <Transition name="stream-bar">
      <div
        v-if="isStarted && !isLoaded"
        class="pointer-events-none absolute inset-x-0 top-0 z-50 flex flex-col items-center"
      >
        <div class="h-1 w-full bg-slate-200/60">
          <div
            class="h-full bg-blue-500 transition-[width] duration-300 ease-out"
            :style="{ width: streamTotal > 0 ? `${streamProgress * 100}%` : '0%' }"
          ></div>
        </div>
        <div
          class="mt-2 rounded-full bg-white/90 px-4 py-1.5 text-xs font-medium text-slate-700 shadow-md backdrop-blur-sm"
        >
          <span v-if="streamError" class="text-red-500">{{ streamError }}</span>
          <span v-else-if="streamTotal > 0">
            正在加载点位数据… {{ streamReceived.toLocaleString() }} /
            {{ streamTotal.toLocaleString() }}
            （{{ Math.round(streamProgress * 100) }}%）
          </span>
          <span v-else>正在接收数据… {{ streamReceived.toLocaleString() }} 个点</span>
        </div>
      </div>
    </Transition>

    <div ref="popupEl" class="ol-popup" :class="{ 'ol-popup--visible': popup.hovered.value }">
      <template v-if="popup.hovered.value">
        <div class="ol-popup__title">ID: {{ popup.hovered.value.id }}</div>
        <div class="ol-popup__row">
          <span class="ol-popup__label">经度</span>
          <span>{{ popup.hovered.value.lon.toFixed(6) }}</span>
        </div>
        <div class="ol-popup__row">
          <span class="ol-popup__label">纬度</span>
          <span>{{ popup.hovered.value.lat.toFixed(6) }}</span>
        </div>
        <div class="ol-popup__row">
          <span class="ol-popup__label">权重</span>
          <span>{{ (popup.hovered.value.weight ?? 0).toFixed(4) }}</span>
        </div>
        <div class="ol-popup__row">
          <span class="ol-popup__label">聚簇峰值</span>
          <span>{{ popup.hovered.value.clusterPeak }}</span>
        </div>
      </template>
    </div>

    <div class="absolute left-4 top-4 z-20 w-94 max-w-[calc(100vw-2rem)]">
      <ElCard
        class="rounded-4 border-0 bg-white/88 shadow-2xl shadow-slate-900/12 backdrop-blur-md"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="text-sm font-semibold text-slate-700">选区网格热力控制台</div>
          <div class="flex items-center gap-2">
            <ElTag v-if="!isStarted" size="small" type="info">未加载</ElTag>
            <ElTag v-else-if="!isLoaded" size="small" type="warning">
              加载中 {{ streamReceived.toLocaleString() }}
            </ElTag>
            <ElTag v-else size="small" type="success">
              {{ streamReceived.toLocaleString() }} 个点
            </ElTag>
            <ElTag size="small" :type="gridHeatVisible ? 'success' : 'info'">
              {{ gridHeatVisible ? '网格热力显示中' : '点位模式' }}
            </ElTag>
            <ElTag v-if="backendGrid.count.value > 0" size="small" type="warning">
              查询网格 {{ backendGrid.count.value }}
            </ElTag>
          </div>
        </div>

        <div class="mt-3 flex flex-wrap items-center gap-2">
          <ElButton
            type="success"
            size="small"
            :disabled="isStarted"
            :loading="isStarted && !isLoaded"
            @click="loadPoints"
          >
            {{ isStarted && !isLoaded ? '加载中…' : isLoaded ? '已加载' : '加载点位数据' }}
          </ElButton>
          <ElButton type="primary" size="small" :disabled="!isLoaded" @click="beginDraw('rect')">
            矩形框选
          </ElButton>
          <ElButton
            type="primary"
            plain
            size="small"
            :disabled="!isLoaded"
            @click="beginDraw('polygon')"
          >
            多边形框选
          </ElButton>
          <ElButton
            type="warning"
            size="small"
            :disabled="!isLoaded || backendGrid.isFetching.value"
            :loading="backendGrid.isFetching.value"
            @click="beginBoxSelection"
          >
            框选查询
          </ElButton>
          <ElButton size="small" @click="clearSelection">清空框选</ElButton>
          <ElButton size="small" @click="applyBalancedPreset">均衡预设</ElButton>
        </div>

        <div class="mt-2 rounded-3 bg-slate-50 px-3 py-2 text-xs text-slate-600 leading-5">
          当前绘制模式：<span class="font-semibold">{{
            draw.mode.value === 'none' ? '无' : draw.mode.value === 'rect' ? '矩形' : '多边形'
          }}</span>
          ，选中点位 <span class="font-semibold">{{ selectedPointCount }}</span> 个，网格
          <span class="font-semibold">{{ grid.cellCount.value }}</span> 个。 网格尺寸约
          <span class="font-semibold">{{ grid.cellSize.value || '-' }}</span> 米，Zoom
          <span class="font-semibold">{{ viewport.zoom.value.toFixed(2) }}</span
          >。
          <template v-if="backendGrid.count.value > 0">
            查询网格
            <span class="font-semibold text-indigo-600">{{ backendGrid.count.value }}</span> 个。
          </template>
          <template v-if="backendGrid.isFetching.value">
            <span class="text-amber-600">正在查询网格数据…</span>
          </template>
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

.stream-bar-enter-active,
.stream-bar-leave-active {
  transition: opacity 0.4s ease;
}
.stream-bar-enter-from,
.stream-bar-leave-to {
  opacity: 0;
}
</style>
