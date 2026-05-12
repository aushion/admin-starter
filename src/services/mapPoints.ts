import { post } from '@/api/http'
import type { Filters } from '@/shared/protocol'

export type PointDTO = {
  id: string
  lon: number // EPSG:4326
  lat: number // EPSG:4326
  coord3857: [number, number]
  weight?: number
  type?: string
}

export async function fetchPoints(params: {
  filters: Filters
  limit?: number
  signal?: AbortSignal
}): Promise<PointDTO[]> {
  const result = await post<{ rows: PointDTO[]; total: number }>(
    '/map/points',
    {
      filters: params.filters,
      limit: params.limit ?? 100_000,
    },
    {
      signal: params.signal,
      dedupe: false,
      silent: true,
      timeout: 60_000,
    },
  )

  return result.rows
}
