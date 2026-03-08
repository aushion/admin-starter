import type BaseLayer from 'ol/layer/Base'
import { useMapEngine } from './context'
import { onMapReady } from './utils'

export interface AddLayerOptions {
  title?: string
  group?: string
  zIndex?: number
  visible?: boolean
  /** 如果同 id 已存在：默认复用旧 layer（不覆盖） */
  replace?: boolean
}

export function useOlLayers() {
  const engine = useMapEngine()

  const has = (id: string) => engine.layers.has(id)

  const get = <T extends BaseLayer = BaseLayer>(id: string) =>
    engine.layers.get(id) as T | undefined

  const add = (id: string, layer: BaseLayer, opt: AddLayerOptions = {}) => {
    const existing = engine.layers.get(id)
    if (existing && !opt.replace) return existing

    // 若 replace，先移除旧的
    if (existing && engine.map.value) engine.map.value.removeLayer(existing)

    engine.layers.set(id, layer)
    engine.layerMeta.set(id, { id, ...opt })

    if (typeof opt.zIndex === 'number') layer.setZIndex(opt.zIndex)
    if (typeof opt.visible === 'boolean') layer.setVisible(opt.visible)

    if (engine.map.value) engine.map.value.addLayer(layer)
    return layer
  }

  const remove = (id: string) => {
    const layer = engine.layers.get(id)
    if (layer && engine.map.value) engine.map.value.removeLayer(layer)
    engine.layers.delete(id)
    engine.layerMeta.delete(id)
  }

  const setVisible = (id: string, visible: boolean) => {
    const layer = engine.layers.get(id)
    layer?.setVisible(visible)
    const meta = engine.layerMeta.get(id)
    if (meta) engine.layerMeta.set(id, { ...meta, visible })
  }

  const setZIndex = (id: string, zIndex: number) => {
    const layer = engine.layers.get(id)
    layer?.setZIndex(zIndex)
    const meta = engine.layerMeta.get(id)
    if (meta) engine.layerMeta.set(id, { ...meta, zIndex })
  }

  /**
   * 确保 map ready 后，把 registry 里的 layer 都挂上
   * 这样 composable 里 add layer 不必担心 map 尚未创建
   */
  onMapReady(engine.map, (map) => {
    for (const [id, layer] of engine.layers) {
      // 防止重复 add：先 remove 再 add 最稳（OpenLayers 自己也能处理，但稳一点）
      map.removeLayer(layer)
      map.addLayer(layer)

      const meta = engine.layerMeta.get(id)
      if (meta?.zIndex != null) layer.setZIndex(meta.zIndex)
      if (meta?.visible != null) layer.setVisible(meta.visible)
    }
  })

  return { has, get, add, remove, setVisible, setZIndex }
}