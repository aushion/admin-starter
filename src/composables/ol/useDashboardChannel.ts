import { onUnmounted, ref } from 'vue'
import { createDualChannel } from '@/shared/channel'
import type { Filters, GeoBoundsPayload } from '@/shared/protocol'

type RawPoint = { id: string; coord3857: [number, number] }
type DashboardQuery = { requestId: string; filters: Filters }

export function useDashboardChannel() {
  const allPoints = ref<RawPoint[]>([])
  const mode = ref<'normal' | 'filter' | 'highlight'>('normal')
  const filteredPoints = ref<RawPoint[]>([])
  const highlightedIds = ref<Set<string>>(new Set())
  const pendingCenter = ref<[number, number] | null>(null)
  const latestQuery = ref<DashboardQuery | null>(null)
  const dashboardFilters = ref<Filters>({})

  function resetToNormal() {
    mode.value = 'normal'
    filteredPoints.value = []
    highlightedIds.value = new Set()
    pendingCenter.value = null
  }

  const channel = createDualChannel()

  channel.on((msg) => {
    if (msg.type === 'SYNC_STATE') {
      dashboardFilters.value = msg.payload.filters
      return
    }
    if (msg.type === 'QUERY') {
      resetToNormal()
      latestQuery.value = msg.payload
      return
    }
    if (msg.type === 'MAP_SYNC_ROWS') {
      allPoints.value = msg.payload.rows
      if (mode.value !== 'normal') resetToNormal()
      return
    }
    if (msg.type === 'MAP_SHOW_SELECTED') {
      mode.value = 'filter'
      filteredPoints.value = msg.payload.rows
      pendingCenter.value = msg.payload.center
      return
    }
    if (msg.type === 'MAP_HIGHLIGHT_SELECTED') {
      mode.value = 'highlight'
      highlightedIds.value = new Set(msg.payload.ids)
      return
    }
    if (msg.type === 'MAP_CLEAR_SELECTION') {
      resetToNormal()
    }
  })

  function sendBoundsSelect(payload: GeoBoundsPayload) {
    channel.send({ type: 'MAP_BOUNDS_SELECT', payload })
  }

  // 通知 Dashboard 地图已就绪，触发 MAP_SYNC_ROWS 推送
  channel.send({ type: 'MAP_READY' })

  onUnmounted(() => {
    channel.close()
  })

  return {
    allPoints,
    mode,
    filteredPoints,
    highlightedIds,
    pendingCenter,
    latestQuery,
    dashboardFilters,
    sendBoundsSelect,
  }
}
