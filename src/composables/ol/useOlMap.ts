import { nextTick, onActivated, onMounted, onUnmounted, shallowRef, unref, type Ref } from 'vue'
import Map from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import XYZ from 'ol/source/XYZ'
import OSM from 'ol/source/OSM'
import type { MapOptions } from 'ol/Map'
import type { ViewOptions } from 'ol/View'
import type { Options as XYZOptions } from 'ol/source/XYZ'
import { useMapEngine } from './engine/context'

type MaybeRef<T> = T | Ref<T>

export interface UseOlMapOptions {
  xyzUrl?: MaybeRef<string | null | undefined>
  view?: ViewOptions
  xyzOptions?: Omit<XYZOptions, 'url'>
  mapOptions?: Omit<MapOptions, 'target' | 'layers' | 'view'>
  fallbackXyzUrl?: MaybeRef<string | null | undefined>
}

export function useOlMap(mapEl: MaybeRef<HTMLElement | null | undefined>, options: UseOlMapOptions) {
  const engine = useMapEngine()
  const baseLayer = shallowRef<TileLayer<XYZ | OSM> | null>(null)
  let resizeObserver: ResizeObserver | null = null

  const updateMapSize = () => {
    const map = engine.map.value
    if (!map) return
    map.updateSize()
    map.render()
  }

  onMounted(async () => {
    const el = unref(mapEl)
    if (!el) return

    const primaryUrl = unref(options.xyzUrl)?.trim()
    const fallbackUrl = unref(options.fallbackXyzUrl)?.trim()

    const createPrimarySource = () => {
      if (!primaryUrl) return null
      return new XYZ({ url: primaryUrl, crossOrigin: 'anonymous', ...(options.xyzOptions ?? {}) })
    }

    const createFallbackSource = () => {
      if (fallbackUrl) return new XYZ({ url: fallbackUrl, crossOrigin: 'anonymous' })
      return new OSM({ crossOrigin: 'anonymous' })
    }

    const primarySource = createPrimarySource()
    const layer = new TileLayer({
      source: primarySource ?? createFallbackSource(),
    })
    layer.setZIndex(0)
    baseLayer.value = layer

    if (!primarySource) {
      console.warn('[useOlMap] xyzUrl is empty, switched to fallback base map.')
    } else {
      let switched = false
      const switchToFallback = () => {
        if (switched) return
        switched = true
        console.warn('[useOlMap] xyzUrl load failed, switched to fallback base map.', { url: primaryUrl })
        layer.setSource(createFallbackSource())
      }
      primarySource.once('tileloaderror', switchToFallback)
    }

    const view = new View({
      projection: 'EPSG:3857',
      center: [0, 0],
      zoom: 2,
      ...(options.view ?? {}),
    })

    const map = new Map({
      target: el,
      layers: [layer],
      view,
      ...(options.mapOptions ?? {}),
    })

    engine.map.value = map

    await nextTick()
    requestAnimationFrame(updateMapSize)

    resizeObserver = new ResizeObserver(() => updateMapSize())
    resizeObserver.observe(el)
    window.addEventListener('resize', updateMapSize)
  })

  onActivated(() => {
    requestAnimationFrame(updateMapSize)
  })

  onUnmounted(() => {
    resizeObserver?.disconnect()
    resizeObserver = null
    window.removeEventListener('resize', updateMapSize)

    const map = engine.map.value
    if (map) {
      if (baseLayer.value) map.removeLayer(baseLayer.value)
      map.setTarget(undefined)
      engine.map.value = null
    }

    baseLayer.value = null
  })

  return { map: engine.map, baseLayer, updateMapSize }
}
