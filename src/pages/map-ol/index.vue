<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import 'ol/ol.css'
import { unByKey } from 'ol/Observable'
import Feature from 'ol/Feature'
import { fromLonLat, toLonLat } from 'ol/proj'
import { createMapEngine, provideMapEngine } from '@/composables/ol/engine/context'
import { onMapReady } from '@/composables/ol/engine/utils'
import { useOlMap } from '@/composables/ol/useOlMap'
import { useOlDraw } from '@/composables/ol/useOlDraw'
import { useOlViewport } from '@/composables/ol/useOlViewport'
import { useDashboardChannel } from '@/composables/ol/useDashboardChannel'
import { useOlGridLayer } from '@/composables/ol/useOlGridLayer'
import { useOlBackendGridLayer } from '@/composables/ol/useOlBackendGridLayer'
import { useOlHeatPoints, type HeatPoint } from '@/composables/ol/useOlHeatPoints'
import { useOlHighlightLayer } from '@/composables/ol/useOlHighlightLayer'
import { useOlLayers } from '@/composables/ol/useOlLayers'
import { useOlPointPopup } from '@/composables/ol/useOlPointPopup'
import { fetchPoints, type PointDTO } from '@/services/mapPoints'
import { extent3857ToBbox4326 } from '@/shared/geo'
import type { Filters } from '@/shared/protocol'
import LayerControlPanel from './components/LayerControlPanel.vue'

const engine = createMapEngine()
provideMapEngine(engine)

const mapEl = ref<HTMLElement | null>(null)
const popupEl = ref<HTMLElement | null>(null)

const MAP_POINT_LIMIT = 100_000
const GRID_HIDE_ZOOM = 13.5
const HEAT_POINT_SWITCH_ZOOM = 13.5

const { map } = useOlMap(mapEl, {
  view: {
    zoom: 10,
    center: [12958412, 4852030],
  },
})

const draw = useOlDraw()
const viewport = useOlViewport()

type MapPoint = HeatPoint & {
  id: number
  lon: number
  lat: number
  x3857: number
  y3857: number
  weight: number
  clusterPeak: number
}

type QueryLayerKey = 'basic' | 'advanced'
type ManagedLayerKey = 'pointBusiness' | 'selectionGrid' | 'backendGrid' | 'highlight'

function rowToMapPoint(row: { id: string; coord3857: [number, number] }): MapPoint {
  const [x3857, y3857] = row.coord3857
  const [lon, lat] = toLonLat([x3857, y3857]) as [number, number]
  return { id: Number(row.id), lon, lat, x3857, y3857, weight: 0.5, clusterPeak: 1 }
}

function dtoToMapPoint(row: PointDTO): MapPoint {
  const [x3857, y3857] = row.coord3857 ?? (fromLonLat([row.lon, row.lat]) as [number, number])
  return {
    id: Number(row.id),
    lon: row.lon,
    lat: row.lat,
    x3857,
    y3857,
    weight: row.weight ?? 0.5,
    clusterPeak: 1,
  }
}

const { mode, filteredPoints, highlightedIds, pendingCenter, latestQuery, sendBoundsSelect } =
  useDashboardChannel()

const rawPointsStores: Record<QueryLayerKey, MapPoint[]> = {
  basic: [],
  advanced: [],
}

const heat = useOlHeatPoints({
  showHeat: false,
  showPoint: false,
  radius: 14,
  blur: 22,
  gradient: ['#1d4ed8', '#0ea5e9', '#22c55e', '#fde047', '#f97316', '#dc2626'],
  zIndexHeat: 20,
  zIndexPoint: 30,
  weightFn: (p) => Math.max(0.01, Math.min(1, Number(p.weight ?? 0.1))),
})

const isStarted = ref(false)
const loadedByLayer = reactive<Record<QueryLayerKey, boolean>>({ basic: false, advanced: false })
const loadingByLayer = reactive<Record<QueryLayerKey, boolean>>({ basic: false, advanced: false })
const loadErrorByLayer = reactive<Record<QueryLayerKey, string>>({ basic: '', advanced: '' })
const loadedCountByLayer = reactive<Record<QueryLayerKey, number>>({ basic: 0, advanced: 0 })
const lastFiltersByLayer = reactive<Record<QueryLayerKey, Filters>>({ basic: {}, advanced: {} })

const requestSeqByLayer: Record<QueryLayerKey, number> = { basic: 0, advanced: 0 }
const abortControllerByLayer: Record<QueryLayerKey, AbortController | null> = {
  basic: null,
  advanced: null,
}

function getQueryLayer(filters: Filters = {}): QueryLayerKey {
  return filters.activeTab === 'advanced' ? 'advanced' : 'basic'
}

function replaceRawPoints(layerKey: QueryLayerKey, points: MapPoint[]) {
  const store = rawPointsStores[layerKey]
  store.splice(0, store.length, ...points)
  loadedCountByLayer[layerKey] = points.length
}

function syncHeatPoints(layerKey?: QueryLayerKey) {
  if (mode.value === 'filter') {
    heat.setPoints(filteredPoints.value.map(rowToMapPoint))
    return
  }
  if (!layerKey) {
    heat.setPoints(allRawPoints.value)
    return
  }
  heat.setPoints(allRawPoints.value)
}

async function loadPoints(filters: Filters = {}) {
  const layerKey = getQueryLayer(filters)
  const seq = ++requestSeqByLayer[layerKey]
  abortControllerByLayer[layerKey]?.abort()
  abortControllerByLayer[layerKey] = new AbortController()
  isStarted.value = true
  loadingByLayer[layerKey] = true
  loadedByLayer[layerKey] = false
  loadErrorByLayer[layerKey] = ''
  lastFiltersByLayer[layerKey] = filters

  try {
    const rows = await fetchPoints({
      filters,
      limit: MAP_POINT_LIMIT,
      signal: abortControllerByLayer[layerKey]?.signal,
    })
    if (seq !== requestSeqByLayer[layerKey]) return
    replaceRawPoints(layerKey, rows.map(dtoToMapPoint))
    syncHeatPoints(layerKey)
    loadedByLayer[layerKey] = true
  } catch (err) {
    if (seq !== requestSeqByLayer[layerKey]) return
    if ((err as Error).name === 'CanceledError' || (err as Error).message === 'canceled') return
    loadErrorByLayer[layerKey] = '点位接口请求失败，请刷新重试'
    replaceRawPoints(layerKey, [])
    heat.setPoints(allRawPoints.value)
  } finally {
    if (seq === requestSeqByLayer[layerKey]) loadingByLayer[layerKey] = false
  }
}

function reloadPoints() {
  const filters = latestQuery.value?.filters
  if (filters) {
    void loadPoints(filters)
    return
  }
  void loadPoints({ activeTab: 'basic', ...(lastFiltersByLayer.basic ?? {}) })
  void loadPoints({ activeTab: 'advanced', ...(lastFiltersByLayer.advanced ?? {}) })
}

watch(latestQuery, (query) => {
  if (!query) return
  void loadPoints(query.filters)
})

watch(
  [mode, filteredPoints],
  () => {
    syncHeatPoints()
  },
  { deep: false },
)

const allRawPoints = computed(() => [...rawPointsStores.basic, ...rawPointsStores.advanced])

const selectionPoints = computed<MapPoint[]>(() => {
  if (mode.value === 'filter') return filteredPoints.value.map(rowToMapPoint)
  const geom = draw.geometry.value
  if (geom) return allRawPoints.value.filter((p) => geom.intersectsCoordinate([p.x3857, p.y3857]))
  return []
})

const grid = useOlGridLayer(
  draw.geometry,
  viewport.zoom,
  viewport.resolution,
  () => selectionPoints.value,
)

const backendGrid = useOlBackendGridLayer({
  fetchGrids: async (extent) => {
    const [longitudeMin, latitudeMin, longitudeMax, latitudeMax] = extent3857ToBbox4326(extent)
    const longitudeMid = (longitudeMin + longitudeMax) / 2
    const latitudeMid = (latitudeMin + latitudeMax) / 2
    return [
      { longitudeMin, longitudeMax: longitudeMid, latitudeMin, latitudeMax: latitudeMid, id: 'g1' },
      { longitudeMin: longitudeMid, longitudeMax, latitudeMin, latitudeMax: latitudeMid, id: 'g2' },
      { longitudeMin, longitudeMax: longitudeMid, latitudeMin: latitudeMid, latitudeMax, id: 'g3' },
      { longitudeMin: longitudeMid, longitudeMax, latitudeMin: latitudeMid, latitudeMax, id: 'g4' },
    ]
  },
})

const highlightLayer = useOlHighlightLayer(mode, highlightedIds, () => allRawPoints.value)

const popup = useOlPointPopup<MapPoint>(popupEl)

const hasSelection = computed(() => !!draw.geometry.value)
const isLoaded = computed(() => loadedByLayer.basic || loadedByLayer.advanced)
const isLoading = computed(() => loadingByLayer.basic || loadingByLayer.advanced)
const loadError = computed(() => loadErrorByLayer.basic || loadErrorByLayer.advanced)
const pointBusinessLayerEnabled = ref(true)
const autoSwitchByZoom = ref(true)
const shouldShowPointByZoom = computed(() => viewport.zoom.value >= HEAT_POINT_SWITCH_ZOOM)
const selectedPointCount = computed(() => selectionPoints.value.length)
const gridVisible = computed(
  () => grid.visible.value && hasSelection.value && viewport.zoom.value < GRID_HIDE_ZOOM,
)
const pointStatusText = computed(() => {
  if (loadError.value) return loadError.value
  if (isLoading.value) return '加载中'
  const loadedCount = loadedCountByLayer.basic + loadedCountByLayer.advanced
  return `${loadedCount.toLocaleString()} 个点`
})
const heatPointModeText = computed(() => {
  if (!autoSwitchByZoom.value) return '叠加模式'
  return shouldShowPointByZoom.value ? '点位模式' : '热力模式'
})
const heatPointStatus = computed(() => ({
  loading: isLoading.value,
  loaded: isLoaded.value,
  error: loadError.value,
  loadedCount: loadedCountByLayer.basic + loadedCountByLayer.advanced,
  unit: '个点',
}))

watch(
  [pointBusinessLayerEnabled, autoSwitchByZoom, shouldShowPointByZoom],
  () => {
    if (!pointBusinessLayerEnabled.value) {
      heat.showHeat.value = false
      heat.showPoint.value = false
      return
    }

    if (autoSwitchByZoom.value) {
      heat.showHeat.value = !shouldShowPointByZoom.value
      heat.showPoint.value = shouldShowPointByZoom.value
      return
    }

    heat.showHeat.value = true
    heat.showPoint.value = true
  },
  { immediate: true },
)

const layerManager = useOlLayers<ManagedLayerKey>([
  {
    key: 'pointBusiness',
    title: '点位业务图层',
    color: '#ef4444',
    visible: pointBusinessLayerEnabled,
    layers: [
      { key: 'heat', layer: heat.heatLayer, visible: heat.showHeat },
      { key: 'point', layer: heat.pointLayer, visible: heat.showPoint },
    ],
    getStatus: () => heatPointStatus.value,
  },
  {
    key: 'selectionGrid',
    title: '选区网格图层',
    color: '#f59e0b',
    visible: grid.visible,
    layers: [{ key: 'selectionGrid', layer: grid.layer, visible: grid.layerVisible }],
    getStatus: () => ({
      loaded: grid.cellCount.value > 0,
      renderedCount: grid.cellCount.value,
      totalCount: grid.cellCount.value,
      loadedCount: grid.cellCount.value,
      unit: '个网格',
    }),
    onVisibleChange: () => syncLayerByZoom(),
  },
  {
    key: 'backendGrid',
    title: '查询网格图层',
    color: '#6366f1',
    visible: backendGrid.visible,
    layers: [{ key: 'backendGrid', layer: backendGrid.layer, visible: backendGrid.layerVisible }],
    getStatus: () => ({
      loading: backendGrid.isFetching.value,
      loaded: backendGrid.count.value > 0,
      renderedCount: backendGrid.count.value,
      totalCount: backendGrid.count.value,
      loadedCount: backendGrid.count.value,
      unit: '个网格',
    }),
    onVisibleChange: () => backendGrid.syncVisible(),
  },
  {
    key: 'highlight',
    title: '高亮图层',
    color: '#facc15',
    visible: highlightLayer.visible,
    layers: [
      { key: 'highlight', layer: highlightLayer.layer, visible: highlightLayer.layerVisible },
    ],
    getStatus: () => ({
      loaded: highlightedIds.value.size > 0,
      renderedCount: highlightedIds.value.size,
      totalCount: highlightedIds.value.size,
      loadedCount: highlightedIds.value.size,
      unit: '个高亮',
    }),
  },
])

const layerItems = layerManager.items
const isBoxSelecting = ref(false)

function setLayerVisible(key: string, visible: boolean | string | number) {
  layerManager.setVisible(key as ManagedLayerKey, visible)
  popup.hide()
}

function syncLayerByZoom() {
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
  backendGrid.clear()
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
    const extent = geom.getExtent() as [number, number, number, number]
    const [longitudeMin, latitudeMin, longitudeMax, latitudeMax] = extent3857ToBbox4326(extent)
    sendBoundsSelect({ longitudeMin, longitudeMax, latitudeMin, latitudeMax })
    await backendGrid.query(extent)
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

    const data = (feature as Feature | undefined)?.get('data') as MapPoint | undefined

    if (data) {
      popup.show(data, evt.coordinate)
      olMap.getTargetElement().style.cursor = 'pointer'
      return
    }

    popup.hide()
    olMap.getTargetElement().style.cursor = feature ? 'pointer' : ''
  })

  syncLayerByZoom()

  return () => unByKey(key)
})

void loadPoints({})
</script>

<template>
  <div class="relative h-screen w-full overflow-hidden">
    <div ref="mapEl" class="h-full w-full"></div>

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
          <span>{{ popup.hovered.value.weight.toFixed(4) }}</span>
        </div>
      </template>
    </div>

    <div class="absolute left-4 top-4 z-20 w-94 max-w-[calc(100vw-2rem)]">
      <ElCard
        class="rounded-4 border-0 bg-white/88 shadow-2xl shadow-slate-900/12 backdrop-blur-md"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="text-sm font-semibold text-slate-700">热力点位控制台</div>
          <div class="flex items-center gap-2">
            <ElTag v-if="!isStarted" size="small" type="info">未请求</ElTag>
            <ElTag v-else-if="isLoading" size="small" type="warning"> 加载中 </ElTag>
            <ElTag v-else-if="loadError" size="small" type="danger">失败</ElTag>
            <ElTag v-else size="small" type="success">已加载</ElTag>
            <ElTag size="small" :type="gridVisible ? 'success' : 'info'">
              {{ gridVisible ? '选区网格显示中' : heatPointModeText }}
            </ElTag>
            <ElTag v-if="backendGrid.count.value > 0" size="small" type="warning">
              查询网格 {{ backendGrid.count.value }}
            </ElTag>
          </div>
        </div>

        <div class="mt-3 flex flex-wrap items-center gap-2">
          <ElButton type="success" size="small" :loading="isLoading" @click="reloadPoints">
            重新加载点位
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
          <ElSwitch
            v-model="autoSwitchByZoom"
            size="small"
            active-text="自动缩放切换"
            inactive-text="叠加显示"
          />
        </div>

        <div class="mt-2 rounded-3 bg-slate-50 px-3 py-2 text-xs text-slate-600 leading-5">
          当前绘制模式：<span class="font-semibold">{{
            draw.mode.value === 'none' ? '无' : draw.mode.value === 'rect' ? '矩形' : '多边形'
          }}</span>
          ，点位 <span class="font-semibold">{{ pointStatusText }}</span
          >，选中点位 <span class="font-semibold">{{ selectedPointCount }}</span> 个，网格
          <span class="font-semibold">{{ grid.cellCount.value }}</span> 个。网格尺寸约
          <span class="font-semibold">{{ grid.cellSize.value || '-' }}</span> 米，Zoom
          <span class="font-semibold">{{ viewport.zoom.value.toFixed(2) }}</span
          >。
          <template v-if="backendGrid.isFetching.value">
            <span class="text-amber-600">正在查询网格数据...</span>
          </template>
        </div>

        <LayerControlPanel class="mt-3" :items="layerItems" @change-visible="setLayerVisible" />
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
