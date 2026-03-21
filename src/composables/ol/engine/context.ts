import {
  getCurrentInstance,
  inject,
  provide,
  shallowRef,
  type InjectionKey,
  type ShallowRef,
} from 'vue'
import type OlMap from 'ol/Map'

export interface MapEngine {
  map: ShallowRef<OlMap | null>
}

export const MAP_ENGINE_KEY: InjectionKey<MapEngine> = Symbol('MAP_ENGINE')

export function createMapEngine(): MapEngine {
  return {
    map: shallowRef<OlMap | null>(null),
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
  const ownProvided = instance?.provides?.[MAP_ENGINE_KEY as unknown as symbol] as
    | MapEngine
    | undefined
  const appProvided = instance?.appContext?.provides?.[MAP_ENGINE_KEY as unknown as symbol] as
    | MapEngine
    | undefined
  const engine = ownProvided ?? appProvided ?? null

  if (!engine)
    throw new Error('[MapEngine] not provided. Call provideMapEngine(createMapEngine()).')
  return engine
}
