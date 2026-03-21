import type { DualMsg } from './protocol.ts'

const CHANNEL_NAME = 'dual-screen-ol'

function sanitizeMessage<T>(msg: T): T {
  try {
    // Prefer native structured clone to preserve undefined/date/typed values.
    return structuredClone(msg)
  } catch {
    // Fallback for reactive proxies or other non-cloneable wrappers.
    return JSON.parse(JSON.stringify(msg)) as T
  }
}

export function createDualChannel() {
  const bc = new BroadcastChannel(CHANNEL_NAME)

  return {
    send(msg: DualMsg) {
      bc.postMessage(sanitizeMessage(msg))
    },
    on(handler: (msg: DualMsg) => void) {
      bc.onmessage = (e) => handler(e.data as DualMsg)
      return () => (bc.onmessage = null)
    },
    close() {
      bc.close()
    },
  }
}
