import { onUnmounted, ref, shallowRef } from 'vue'
import Feature from 'ol/Feature'
import { fromExtent as polygonFromExtent } from 'ol/geom/Polygon'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { fromLonLat } from 'ol/proj'
import { Fill, Stroke, Style } from 'ol/style'

export interface BackendGrid {
  longitudeMin: number
  longitudeMax: number
  latitudeMin: number
  latitudeMax: number
  id: string
}

export interface UseOlBackendGridLayerOptions {
  zIndex?: number
  fetchGrids: (extent: [number, number, number, number]) => Promise<BackendGrid[]>
}

export function useOlBackendGridLayer(options: UseOlBackendGridLayerOptions) {
  const count = ref(0)
  const isFetching = ref(false)
  const visible = ref(true)
  const layerVisible = ref(false)
  const source = new VectorSource()
  const layer = shallowRef(
    new VectorLayer({
      source,
      zIndex: options.zIndex ?? 36,
      visible: false,
      style: new Style({
        fill: new Fill({ color: 'rgba(99, 102, 241, 0.32)' }),
        stroke: new Stroke({ color: 'rgba(67, 56, 202, 0.85)', width: 1.4 }),
      }),
    }),
  )

  function syncVisible(): void {
    layerVisible.value = visible.value && count.value > 0
  }

  function render(grids: BackendGrid[]): void {
    source.clear(true)
    if (!grids.length) {
      count.value = 0
      syncVisible()
      return
    }
    const features = grids.map((g) => {
      const [x1, y1] = fromLonLat([g.longitudeMin, g.latitudeMin])
      const [x2, y2] = fromLonLat([g.longitudeMax, g.latitudeMax])
      const f = new Feature(polygonFromExtent([x1, y1, x2, y2]))
      f.setId(g.id)
      f.set('gridData', g)
      return f
    })
    source.addFeatures(features)
    count.value = features.length
    syncVisible()
  }

  function clear(): void {
    source.clear(true)
    count.value = 0
    syncVisible()
  }

  async function query(extent: [number, number, number, number]): Promise<void> {
    isFetching.value = true
    try {
      const grids = await options.fetchGrids(extent)
      render(grids)
    } finally {
      isFetching.value = false
    }
  }

  onUnmounted(() => {
    source.clear(true)
  })

  return { count, isFetching, layer, visible, layerVisible, syncVisible, query, clear }
}
