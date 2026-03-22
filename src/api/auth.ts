import { post, get, http } from './http'
import { downloadBlob } from '@/utils/download'

export type LoginResp = { token: string }
export function loginApi(username: string, password: string) {
  return post<LoginResp>('/auth/login', { username, password })
}

export type UserInfo = {
  id: string
  name: string
  roles: string[]
  permissions: string[]
}
export function getMeApi() {
  return get<UserInfo>('/auth/me')
}

// 下载示例：后端返回 blob
export async function downloadReportApi() {
  const blob = await http.get('/report/export', { responseType: 'blob' })
  downloadBlob(blob, 'report.xlsx')
}
