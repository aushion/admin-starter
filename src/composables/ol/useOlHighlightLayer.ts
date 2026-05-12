import { onUnmounted, ref, shallowRef, watch, type Ref } from 'vue'
import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { Fill, RegularShape, Stroke, Style } from 'ol/style'

interface Locatable {
  id: string | number
  x3857: number
  y3857: number
}

export interface UseOlHighlightLayerOptions {
  zIndex?: number
  style?: Style
}

const DEFAULT_STYLE = new Style({
  image: new RegularShape({
    points: 5,
    radius: 12,
    radius2: 5,
    angle: 0,
    fill: new Fill({ color: 'rgba(255, 220, 0, 0.95)' }),
    stroke: new Stroke({ color: 'rgba(234, 88, 12, 0.95)', width: 2 }),
  }),
})

export function useOlHighlightLayer(
  mode: Ref<string>,
  highlightedIds: Ref<Set<string>>,
  getStore: () => Locatable[],
  options?: UseOlHighlightLayerOptions,
) {
  const source = new VectorSource()
  const visible = ref(true)
  const layerVisible = ref(false)
  const layer = shallowRef(
    new VectorLayer({
      source,
      zIndex: options?.zIndex ?? 50,
      visible: false,
      style: options?.style ?? DEFAULT_STYLE,
    }),
  )

  function syncVisible() {
    layerVisible.value =
      visible.value && source.getFeatures().length > 0 && mode.value === 'highlight'
  }

  const stop = watch(
    [mode, highlightedIds],
    ([m, ids]) => {
      if (m !== 'highlight' || ids.size === 0) {
        source.clear(true)
        syncVisible()
        return
      }
      const features = getStore()
        .filter((p) => ids.has(String(p.id)))
        .map((p) => {
          const f = new Feature({ geometry: new Point([p.x3857, p.y3857]) })
          f.setId(p.id)
          return f
        })
      source.clear(true)
      source.addFeatures(features)
      syncVisible()
    },
    { immediate: true, deep: false },
  )

  const stopVisible = watch(visible, () => {
    syncVisible()
  })

  onUnmounted(() => {
    stop()
    stopVisible()
    source.clear(true)
  })

  return { layer, source, visible, layerVisible, syncVisible }
}
