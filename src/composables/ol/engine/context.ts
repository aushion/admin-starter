import { getCurrentInstance, inject, provide, shallowReactive, shallowRef, type InjectionKey, type ShallowRef } from 'vue'
import type OlMap from 'ol/Map'
import type BaseLayer from 'ol/layer/Base'
import type VectorSource from 'ol/source/Vector'
import type Overlay from 'ol/Overlay'
import type Interaction from 'ol/interaction/Interaction'

export interface LayerMeta {
  id: string
  title?: string
  group?: string          // 用于图层树分组
  zIndex?: number
  visible?: boolean
}

export interface MapEngine {
  map: ShallowRef<OlMap | null>

  // registries
  layers: Map<string, BaseLayer>
  layerMeta: Map<string, LayerMeta>
  sources: Map<string, VectorSource>
  overlays: Map<string, Overlay>
  interactions: Map<string, Interaction>
}

export const MAP_ENGINE_KEY: InjectionKey<MapEngine> = Symbol('MAP_ENGINE')

export function createMapEngine(): MapEngine {
  return {
    map: shallowRef<OlMap | null>(null),

    layers: shallowReactive(new Map()),
    layerMeta: shallowReactive(new Map()),
    sources: shallowReactive(new Map()),
    overlays: shallowReactive(new Map()),
    interactions: shallowReactive(new Map()),
  }
}

export function provideMapEngine(engine: MapEngine) {
  provide(MAP_ENGINE_KEY, engine)
}

export function useMapEngine(): MapEngine {
  const injected = inject(MAP_ENGINE_KEY, null)
  if (injected) return injected

  // Allow same-component "provide + use*" in <script setup>.
  type InstanceProvides = {
    provides?: Record<PropertyKey, unknown>
    appContext?: { provides?: Record<PropertyKey, unknown> }
  }
  const instance = getCurrentInstance() as unknown as InstanceProvides | null
  const ownProvided = instance?.provides?.[MAP_ENGINE_KEY as unknown as symbol] as MapEngine | undefined
  const appProvided = instance?.appContext?.provides?.[MAP_ENGINE_KEY as unknown as symbol] as MapEngine | undefined
  const engine = ownProvided ?? appProvided ?? null

  if (!engine) throw new Error('[MapEngine] not provided. Call provideMapEngine(createMapEngine()).')
  return engine
}
