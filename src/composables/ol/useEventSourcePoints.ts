import { computed, onUnmounted, ref } from 'vue'

export type RawStreamPoint = { id: string; coord3857: [number, number] }

export interface StreamBatch {
  rows: RawStreamPoint[]
  /** 后端声明的总点数（可选，用于进度计算） */
  total?: number
  /** 最后一批时为 true */
  done?: boolean
}

export interface UseEventSourcePointsOptions {
  /** 每收到一批数据时调用，done=true 表示最后一批 */
  onBatch: (batch: RawStreamPoint[], done: boolean, totalReceived: number) => void
  onError?: (err: Event) => void
  onDone?: (total: number) => void
}

export function useEventSourcePoints(options: UseEventSourcePointsOptions) {
  const isStreaming = ref(false)
  const receivedCount = ref(0)
  const expectedTotal = ref(0)

  /** 0~1，仅在后端声明 total 时有意义 */
  const progress = computed(() =>
    expectedTotal.value > 0 ? Math.min(1, receivedCount.value / expectedTotal.value) : 0,
  )

  let es: EventSource | null = null

  function connect(url: string) {
    close()
    isStreaming.value = true
    receivedCount.value = 0
    expectedTotal.value = 0

    es = new EventSource(url)

    es.onmessage = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data as string) as StreamBatch
        receivedCount.value += data.rows.length
        if (data.total != null) expectedTotal.value = data.total

        const done = data.done ?? false
        options.onBatch(data.rows, done, receivedCount.value)

        if (done) {
          isStreaming.value = false
          options.onDone?.(receivedCount.value)
          es?.close()
          es = null
        }
      } catch (err) {
        console.error('[EventSource] parse error', err)
      }
    }

    es.onerror = (e) => {
      isStreaming.value = false
      options.onError?.(e)
      es?.close()
      es = null
    }
  }

  function close() {
    es?.close()
    es = null
    isStreaming.value = false
  }

  onUnmounted(close)

  return { connect, close, isStreaming, receivedCount, expectedTotal, progress }
}
