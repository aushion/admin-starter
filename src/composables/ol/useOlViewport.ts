import { ref, shallowRef, type Ref, type ShallowRef } from 'vue'
import { unByKey } from 'ol/Observable'
import type { Extent } from 'ol/extent'
import type { Coordinate } from 'ol/coordinate'
import { useMapEngine } from './engine/context'
import { onMapReady } from './engine/utils'

export interface UseOlViewportReturn {
  zoom: Ref<number>
  resolution: Ref<number>
  extent: ShallowRef<Extent>
  center: ShallowRef<Coordinate>
}

export function useOlViewport(): UseOlViewportReturn {
  const engine = useMapEngine()

  const zoom = ref(0)
  const resolution = ref(1)
  const extent = shallowRef<Extent>([0, 0, 0, 0])
  const center = shallowRef<Coordinate>([0, 0])

  const syncFromView = () => {
    const map = engine.map.value
    if (!map) return
    const view = map.getView()
    zoom.value = view.getZoom() ?? 0
    resolution.value = view.getResolution() ?? 1
    extent.value = view.calculateExtent(map.getSize())
    center.value = view.getCenter() ?? [0, 0]
  }

  onMapReady(engine.map, (map) => {
    syncFromView()
    const key = map.on('moveend', syncFromView)
    return () => unByKey(key)
  })

  return { zoom, resolution, extent, center }
}
