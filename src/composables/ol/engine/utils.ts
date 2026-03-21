import { watch, onUnmounted, type ShallowRef } from 'vue'
import type Map from 'ol/Map'

export function onMapReady(
  mapRef: ShallowRef<Map | null>,
  attach: (map: Map) => void | (() => void),
) {
  let cleanup: void | (() => void)

  const stop = watch(
    () => mapRef.value,
    (map) => {
      if (cleanup) cleanup()
      cleanup = undefined
      if (map) cleanup = attach(map) || undefined
    },
    { immediate: true },
  )

  onUnmounted(() => {
    stop()
    if (cleanup) cleanup()
  })

  return () => {
    stop()
    if (cleanup) cleanup()
  }
}
