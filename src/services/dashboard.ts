import { post } from '@/api/http'
import type { DeviceRow, QueryForm, QueryTabKey } from '@/pages/dashboard/types'

export type DashboardQueryParams = {
  tab: QueryTabKey
  filters: QueryForm
  limit?: number
}

export type DashboardQueryResult = {
  rows: DeviceRow[]
  total: number
}

export function fetchDashboardRows(params: DashboardQueryParams): Promise<DashboardQueryResult> {
  return post<DashboardQueryResult>('/dashboard/query', params, { dedupe: false })
}
