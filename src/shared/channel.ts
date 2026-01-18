import type { DualMsg } from './protocol.ts';

const CHANNEL_NAME = 'dual-screen-ol';

export function createDualChannel() {
  const bc = new BroadcastChannel(CHANNEL_NAME);

  return {
    send(msg: DualMsg) {
      bc.postMessage(msg);
    },
    on(handler: (msg: DualMsg) => void) {
      bc.onmessage = (e) => handler(e.data as DualMsg);
      return () => (bc.onmessage = null);
    },
    close() {
      bc.close();
    },
  };
}
