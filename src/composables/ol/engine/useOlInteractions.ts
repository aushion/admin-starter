import type Interaction from 'ol/interaction/Interaction'
import { useMapEngine } from './context'
import { onMapReady } from './utils'

export interface AddInteractionOptions {
  active?: boolean
  replace?: boolean
}

export function useOlInteractions() {
  const engine = useMapEngine()

  const get = <T extends Interaction = Interaction>(id: string) =>
    engine.interactions.get(id) as T | undefined

  const add = (id: string, it: Interaction, opt: AddInteractionOptions = {}) => {
    const existing = engine.interactions.get(id)
    if (existing && !opt.replace) return existing
    if (existing && engine.map.value) engine.map.value.removeInteraction(existing)

    engine.interactions.set(id, it)
    if (typeof opt.active === 'boolean') it.setActive(opt.active)
    if (engine.map.value) engine.map.value.addInteraction(it)
    return it
  }

  const remove = (id: string) => {
    const it = engine.interactions.get(id)
    if (it && engine.map.value) engine.map.value.removeInteraction(it)
    engine.interactions.delete(id)
  }

  const setActive = (id: string, active: boolean) => {
    const it = engine.interactions.get(id)
    it?.setActive(active)
  }

  // map ready 后把已有 interaction 补挂（避免 map 未创建时先 add）
  onMapReady(engine.map, (map) => {
    for (const it of engine.interactions.values()) {
      map.removeInteraction(it)
      map.addInteraction(it)
    }
  })

  return { get, add, remove, setActive }
}