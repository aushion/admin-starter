import { ref, shallowRef, type Ref } from 'vue'
import Overlay from 'ol/Overlay'
import type { Coordinate } from 'ol/coordinate'
import { useMapEngine } from './engine/context'
import { onMapReady } from './engine/utils'

/**
 * Manages an OL Overlay for point hover popups.
 * The caller is responsible for hit-testing and calling show/hide.
 */
export function useOlPointPopup<T>(popupEl: Ref<HTMLElement | null>) {
  const engine = useMapEngine()
  const hovered = ref<T | null>(null) as Ref<T | null>
  const overlay = shallowRef<Overlay | null>(null)

  onMapReady(engine.map, (map) => {
    const inst = new Overlay({
      element: popupEl.value!,
      positioning: 'bottom-center',
      offset: [0, -12],
      stopEvent: false,
    })
    map.addOverlay(inst)
    overlay.value = inst

    return () => {
      map.removeOverlay(inst)
      overlay.value = null
    }
  })

  function show(data: T, coordinate: Coordinate): void {
    hovered.value = data
    overlay.value?.setPosition(coordinate)
  }

  function hide(): void {
    hovered.value = null
    overlay.value?.setPosition(undefined)
  }

  return { hovered, overlay, show, hide }
}
