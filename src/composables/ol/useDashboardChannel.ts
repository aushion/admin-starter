import { onUnmounted, ref } from 'vue'
import type { DualMsg } from '@/shared/protocol'

const CHANNEL_NAME = 'dual-screen-ol'

type RawPoint = { id: string; coord3857: [number, number] }

export function useDashboardChannel() {
  const allPoints = ref<RawPoint[]>([])
  const mode = ref<'normal' | 'filter' | 'highlight'>('normal')
  const filteredPoints = ref<RawPoint[]>([])
  const highlightedIds = ref<Set<string>>(new Set())
  const pendingCenter = ref<[number, number] | null>(null)

  function resetToNormal() {
    mode.value = 'normal'
    filteredPoints.value = []
    highlightedIds.value = new Set()
    pendingCenter.value = null
  }

  const bc = new BroadcastChannel(CHANNEL_NAME)

  bc.onmessage = (e: MessageEvent<DualMsg>) => {
    const msg = e.data
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
  }

  // 通知 Dashboard 地图已就绪，触发 MAP_SYNC_ROWS 推送
  bc.postMessage({ type: 'MAP_READY' } satisfies DualMsg)

  onUnmounted(() => {
    bc.close()
  })

  return { allPoints, mode, filteredPoints, highlightedIds, pendingCenter }
}
