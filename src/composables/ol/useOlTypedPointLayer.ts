import { ref, shallowRef, watch } from 'vue'
import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import type { StyleLike } from 'ol/style/Style'
import { useMapEngine } from './engine/context'
import { onMapReady } from './engine/utils'

export interface TypedPoint {
  id: string | number
  x3857: number
  y3857: number
  [k: string]: unknown
}

export interface UseOlTypedPointLayerOptions {
  zIndex?: number
  style: StyleLike
}

/**
 * Generic point layer for typed data. One instance per point type.
 *
 * Interaction (hover / click) is intentionally NOT registered here —
 * handle it with a single pointermove/click listener on the map at the
 * page level, then read `feature.get('data')` for the typed payload.
 *
 * Usage:
 *   const taxiLayer = useOlTypedPointLayer<TaxiPoint>({ zIndex: 20, style: taxiStyle })
 *   taxiLayer.setPoints(points)
 *
 *   // page-level hit test:
 *   olMap.on('pointermove', evt => {
 *     const f = olMap.forEachFeatureAtPixel(evt.pixel, f => f, {
 *       layerFilter: l => l === taxiLayer.layer.value,
 *     })
 *     const data = f?.get('data') as TaxiPoint | undefined
 *   })
 */
export function useOlTypedPointLayer<T extends TypedPoint>(options: UseOlTypedPointLayerOptions) {
  const engine = useMapEngine()

  const source = new VectorSource()
  const layer = shallowRef<VectorLayer<VectorSource> | null>(null)
  const visible = ref(true)

  function buildFeature(p: T): Feature {
    const f = new Feature({ geometry: new Point([p.x3857, p.y3857]) })
    f.setId(p.id)
    f.set('data', p)
    return f
  }

  function setPoints(points: T[]): void {
    source.clear(true)
    source.addFeatures(points.map(buildFeature))
  }

  function addPoints(points: T[]): void {
    source.addFeatures(points.map(buildFeature))
  }

  function clearPoints(): void {
    source.clear(true)
  }

  onMapReady(engine.map, (map) => {
    const inst = new VectorLayer({
      source,
      zIndex: options.zIndex ?? 10,
      visible: visible.value,
      style: options.style,
    })
    layer.value = inst
    map.addLayer(inst)

    const stopWatch = watch(visible, (v) => inst.setVisible(v))

    return () => {
      stopWatch()
      map.removeLayer(inst)
      layer.value = null
      source.clear(true)
    }
  })

  return { source, layer, visible, setPoints, addPoints, clearPoints }
}
