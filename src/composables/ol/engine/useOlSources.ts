import VectorSource from 'ol/source/Vector'
import { useMapEngine } from './context'

export function useOlSources() {
  const engine = useMapEngine()

  const has = (id: string) => engine.sources.has(id)
  const get = (id: string) => engine.sources.get(id)

  const ensure = (id: string, factory?: () => VectorSource) => {
    const existing = engine.sources.get(id)
    if (existing) return existing
    const src = factory ? factory() : new VectorSource()
    engine.sources.set(id, src)
    return src
  }

  const remove = (id: string) => {
    const src = engine.sources.get(id)
    src?.clear(true)
    engine.sources.delete(id)
  }

  return { has, get, ensure, remove }
}