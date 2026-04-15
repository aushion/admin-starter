export type RowStatus = 'online' | 'offline'
export type ZoneCode = 'north' | 'south' | 'west'
export type QueryTabKey = 'basic' | 'advanced'
export type PriorityLevel = 'P1' | 'P2' | 'P3'
export type SourceType = 'manual' | 'api' | 'import'

export type BasicQueryForm = {
  keyword?: string
  status?: RowStatus
  zone?: ZoneCode
  owner?: string
}

export type AdvancedQueryForm = {
  keyword?: string
  status?: RowStatus
  zone?: ZoneCode
  level?: PriorityLevel
  source?: SourceType
  startedAt?: string
  endedAt?: string
}

export type QueryForm = BasicQueryForm | AdvancedQueryForm

export type DeviceRow = {
  id: number
  name: string
  status: RowStatus
  zone: ZoneCode
  owner: string
  level: PriorityLevel
  source: SourceType
  coord3857: [number, number]
  updatedAt: string
}

export type TabQueryPayload = {
  tab: QueryTabKey
  values: QueryForm
}

export type StatsRow = {
  id: string
  zone: ZoneCode
  zoneLabel: string
  online: number
  offline: number
  total: number
  p1: number
  p2: number
  p3: number
}
