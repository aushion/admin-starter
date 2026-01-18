import type { Filters } from '@/shared/protocol';

export type PointDTO = {
  id: string;
  lon: number;  // EPSG:4326
  lat: number;  // EPSG:4326
  type?: string;
};

export async function fetchPoints(params: {
  filters: Filters;
  bbox4326: [number, number, number, number];
  signal?: AbortSignal;
}): Promise<PointDTO[]> {
  // 你改成你们真实接口
  const res = await fetch('/api/map/points', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: params.signal,
    body: JSON.stringify({
      filters: params.filters,
      bbox: params.bbox4326,
    }),
  });

  if (!res.ok) throw new Error(`fetchPoints failed: ${res.status}`);
  return res.json();
}
