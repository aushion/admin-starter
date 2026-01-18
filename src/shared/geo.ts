import type { Extent } from 'ol/extent';
import { transformExtent } from 'ol/proj';

/**
 * 把 EPSG:3857 extent 转成 EPSG:4326 bbox
 * 返回 [minLon, minLat, maxLon, maxLat]
 */
export function extent3857ToBbox4326(extent3857: Extent): [number, number, number, number] {
  const e = transformExtent(extent3857, 'EPSG:3857', 'EPSG:4326');
  return [e[0] as number, e[1] as number, e[2] as number, e[3] as number];
}
