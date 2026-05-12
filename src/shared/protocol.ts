export type Filters = Record<string, any>

export type GeoBoundsPayload = {
  longitudeMin: number
  longitudeMax: number
  latitudeMin: number
  latitudeMax: number
}

export type DualMsg =
  | { type: 'MAP_READY' }
  | { type: 'SYNC_STATE'; payload: { filters: Filters } }
  | { type: 'QUERY'; payload: { requestId: string; filters: Filters } }
  | { type: 'FOCUS'; payload: { id?: string; coord3857?: [number, number]; zoom?: number } }
  | { type: 'MAP_SELECT'; payload: { id: string } }
  | { type: 'MAP_BOUNDS_SELECT'; payload: GeoBoundsPayload }
  | { type: 'MAP_SYNC_ROWS'; payload: { rows: Array<{ id: string; coord3857: [number, number] }> } }
  | {
      type: 'MAP_SHOW_SELECTED'
      payload: {
        rows: Array<{ id: string; coord3857: [number, number] }>
        center: [number, number]
      }
    }
  | { type: 'MAP_HIGHLIGHT_SELECTED'; payload: { ids: string[] } }
  | { type: 'MAP_CLEAR_SELECTION' }
