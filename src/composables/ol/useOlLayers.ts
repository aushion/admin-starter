import { computed, watch, type Ref } from 'vue'
import type BaseLayer from 'ol/layer/Base'
import { useMapEngine } from './engine/context'
import { onMapReady } from './engine/utils'

export type OlLayerStatus = {
  loading?: boolean
  loaded?: boolean
  error?: string
  renderedCount?: number
  totalCount?: number
  loadedCount?: number
  unit?: string
}

export type OlLayerRegistration<TKey extends string = string> = {
  key: TKey
  title: string
  color: string
  visible: Ref<boolean>
  layers?: OlManagedLayer[]
  getStatus?: () => OlLayerStatus
  onVisibleChange?: (visible: boolean) => void
}

export type OlManagedLayer = {
  key: string
  layer: Ref<BaseLayer | null | undefined>
  visible?: Ref<boolean>
  opacity?: Ref<number>
  zIndex?: Ref<number>
}

export type OlLayerItem<TKey extends string = string> = Required<OlLayerStatus> & {
  key: TKey
  title: string
  color: string
  visible: boolean
}

function normalizeStatus(status?: OlLayerStatus): Required<OlLayerStatus> {
  return {
    loading: status?.loading ?? false,
    loaded: status?.loaded ?? false,
    error: status?.error ?? '',
    renderedCount: status?.renderedCount ?? 0,
    totalCount: status?.totalCount ?? 0,
    loadedCount: status?.loadedCount ?? 0,
    unit: status?.unit ?? '',
  }
}

export function useOlLayers<TKey extends string>(registrations: OlLayerRegistration<TKey>[]) {
  const engine = useMapEngine()

  const items = computed<OlLayerItem<TKey>[]>(() =>
    registrations.map((registration) => ({
      key: registration.key,
      title: registration.title,
      color: registration.color,
      visible: registration.visible.value,
      ...normalizeStatus(registration.getStatus?.()),
    })),
  )

  function setVisible(layerKey: TKey, visible: boolean | string | number) {
    const registration = registrations.find((item) => item.key === layerKey)
    if (!registration) return
    const nextVisible = Boolean(visible)
    registration.visible.value = nextVisible
    registration.onVisibleChange?.(nextVisible)
  }

  onMapReady(engine.map, (map) => {
    const stops: (() => void)[] = []
    const addedLayers = new Set<BaseLayer>()

    function addLayer(layer: BaseLayer) {
      if (addedLayers.has(layer)) return
      map.addLayer(layer)
      addedLayers.add(layer)
    }

    function removeLayer(layer: BaseLayer) {
      if (!addedLayers.has(layer)) return
      map.removeLayer(layer)
      addedLayers.delete(layer)
    }

    function syncLayerState(layerConfig: OlManagedLayer, fallbackVisible: Ref<boolean>) {
      const layer = layerConfig.layer.value
      if (!layer) return
      layer.setVisible((layerConfig.visible ?? fallbackVisible).value)
      if (layerConfig.opacity) layer.setOpacity(layerConfig.opacity.value)
      if (layerConfig.zIndex) layer.setZIndex(layerConfig.zIndex.value)
    }

    for (const registration of registrations) {
      for (const layerConfig of registration.layers ?? []) {
        const stopLayer = watch(
          layerConfig.layer,
          (layer, oldLayer) => {
            if (oldLayer && oldLayer !== layer) removeLayer(oldLayer)
            if (!layer) return
            syncLayerState(layerConfig, registration.visible)
            addLayer(layer)
          },
          { immediate: true },
        )
        stops.push(stopLayer)

        stops.push(
          watch(layerConfig.visible ?? registration.visible, () => {
            syncLayerState(layerConfig, registration.visible)
          }),
        )

        if (layerConfig.opacity) {
          stops.push(
            watch(layerConfig.opacity, () => {
              syncLayerState(layerConfig, registration.visible)
            }),
          )
        }

        if (layerConfig.zIndex) {
          stops.push(
            watch(layerConfig.zIndex, () => {
              syncLayerState(layerConfig, registration.visible)
            }),
          )
        }
      }
    }

    return () => {
      stops.forEach((stop) => stop())
      for (const layer of addedLayers) map.removeLayer(layer)
      addedLayers.clear()
    }
  })

  return { items, setVisible }
}
