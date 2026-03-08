<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import 'ol/ol.css'
import { unByKey } from 'ol/Observable'
import type { EventsKey } from 'ol/events'
import { Fill, RegularShape, Stroke, Style } from 'ol/style'
import { createMapEngine, provideMapEngine } from '@/composables/ol/engine/context'
import { useOlMap } from '@/composables/ol/useOlMap'
import { useOlHeatPoints, type HeatPoint } from '@/composables/ol/useOlHeatPoints'

const engine = createMapEngine()
provideMapEngine(engine)

const mapEl = ref<HTMLElement | null>(null)

const POINT_LAYER_ZOOM = 12
const POINT_COUNT = 10000

const { map } = useOlMap(mapEl, {
  // xyzUrl: 'http://localhost:8080/tiles/{z}/{x}/{y}.png',
  view: {
    zoom: 10,
    center: [12958412, 4852030], // 北京
  },
})

const points = ref<HeatPoint[]>([])

type ClusterSeed = {
  lon: number
  lat: number
  ratio: number
  sigmaKm: number
  peak: number
}

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

function generateBeijingRandomPoints(count: number): HeatPoint[] {
  const data: HeatPoint[] = new Array(count)

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

    data[i] = {
      id: i + 1,
      lon,
      lat,
      weight: normalized,
      clusterPeak: c.peak,
    }
  }

  const noiseCount = Math.floor(count * 0.06)
  for (let i = 0; i < noiseCount; i++) {
    const idx = Math.floor(Math.random() * count)
    const p = data[idx] as HeatPoint
    p.weight = Math.max(0.02, Math.min(0.2, Math.random() * 0.18))
  }

  return data
}

function refresh() {
  points.value = generateBeijingRandomPoints(POINT_COUNT)
}

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
  points,
  showHeat: true,
  showPoint: true,
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

const currentZoom = computed(() => map.value?.getView().getZoom() ?? 0)
const pointLayerVisible = computed(() => currentZoom.value >= POINT_LAYER_ZOOM)

function syncLayerByZoom() {
  heat.showPoint.value = pointLayerVisible.value
  heat.showHeat.value = true
}

let moveEndKey: EventsKey | null = null

onMounted(() => {
  refresh()
  syncLayerByZoom()

  const olMap = map.value
  if (!olMap) return

  moveEndKey = olMap.on('moveend', syncLayerByZoom)
})

onUnmounted(() => {
  if (moveEndKey) {
    unByKey(moveEndKey)
    moveEndKey = null
  }
})
</script>

<template>
  <div class="relative h-screen w-full overflow-hidden">
    <div ref="mapEl" class="h-full w-full"></div>

    <div class="absolute left-4 top-4 z-20 w-84 max-w-[calc(100vw-2rem)]">
      <ElCard class="rounded-4 border-0 bg-white/88 shadow-2xl shadow-slate-900/12 backdrop-blur-md">
        <div class="flex items-center justify-between gap-3">
          <div class="text-sm font-semibold text-slate-700">北京热力图控制台</div>
          <ElTag size="small" :type="pointLayerVisible ? 'success' : 'info'">
            {{ pointLayerVisible ? '点图层已叠加' : '仅热力图' }}
          </ElTag>
        </div>

        <div class="mt-3 flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <ElButton type="primary" size="small" @click="refresh()">刷新 {{ POINT_COUNT }} 点</ElButton>
            <ElButton size="small" @click="applyBalancedPreset()">均衡预设</ElButton>
          </div>
          <div class="text-xs text-slate-500">Zoom {{ currentZoom.toFixed(2) }}</div>
        </div>

        <ElDivider class="my-3" />

        <div class="space-y-4">
          <div>
            <div class="mb-1 flex items-center justify-between text-xs text-slate-600">
              <span>Radius</span>
              <span class="font-semibold text-slate-800">{{ radiusModel }}</span>
            </div>
            <ElSlider v-model="radiusModel" :min="4" :max="40" :step="1" size="small" />
          </div>

          <div>
            <div class="mb-1 flex items-center justify-between text-xs text-slate-600">
              <span>Blur</span>
              <span class="font-semibold text-slate-800">{{ blurModel }}</span>
            </div>
            <ElSlider v-model="blurModel" :min="4" :max="60" :step="1" size="small" />
          </div>

          <div class="rounded-3 bg-slate-50 px-3 py-2 text-xs text-slate-600 leading-5">
            热力图常驻显示；当缩放级别达到 <span class="font-semibold">{{ POINT_LAYER_ZOOM }}</span> 时自动叠加点图层。
            当前点数 <span class="font-semibold">{{ points.length }}</span>。
          </div>
        </div>
      </ElCard>
    </div>
  </div>
</template>
