import axios from 'axios'
import type { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'
import { useAuth } from '@/composables/useAuth' // Verify this path exists or update accordingly

/** 后端统一响应结构（按你的后端规范改字段名即可） */
export type ApiResp<T = any> = {
  code: number
  message: string
  data: T
}

/** 可在请求 config 上扩展一些字段 */
declare module 'axios' {
  export interface AxiosRequestConfig {
    /** 不弹错误消息（比如静默轮询） */
    silent?: boolean
    /** 允许返回原始 response（下载、特殊接口用） */
    raw?: boolean
    /** 是否开启重复请求取消（默认 true） */
    dedupe?: boolean
  }
}

/** ========== 重复请求取消：同 url+method+params+data 只保留最后一次 ========== */
const pending = new Map<string, AbortController>()

function genKey(config: AxiosRequestConfig) {
  const { method, url, params, data } = config
  return [
    method?.toUpperCase() || 'GET',
    url || '',
    JSON.stringify(params || {}),
    typeof data === 'string' ? data : JSON.stringify(data || {}),
  ].join('&')
}

function addPending(config: AxiosRequestConfig) {
  if (config.dedupe === false) return
  const key = genKey(config)

  // 若已存在相同请求，则取消前一个
  if (pending.has(key)) {
    pending.get(key)!.abort()
    pending.delete(key)
  }

  const controller = new AbortController()
  config.signal = controller.signal
  pending.set(key, controller)
}

function removePending(config: AxiosRequestConfig) {
  if (config.dedupe === false) return
  const key = genKey(config)
  pending.delete(key)
}

/** ========== 业务错误消息（你可以按后端约定补更多） ========== */
function showError(msg: string, silent?: boolean) {
  if (!silent) ElMessage.error(msg || '请求失败')
}

/** ========== 创建实例 ========== */
export function createHttpClient() {
  const instance = axios.create({
    baseURL: import.meta.env.VITE_API_BASE || '/api',
    timeout: 30_000,
    withCredentials: false,
  })

  // 请求拦截
  instance.interceptors.request.use((config) => {
    addPending(config)

    const { token } = useAuth()
    if (token.value) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${token.value}`
    }

    return config
  })

  // 响应拦截（兼容两类：1) 业务 JSON 2) 文件流/非标准）
  instance.interceptors.response.use(
    (resp) => {
      removePending(resp.config)

      // raw: 直接返回 axios response
      if (resp.config.raw) return resp

      // 文件流/非 JSON（比如 blob 下载）
      const ct = String(resp.headers?.['content-type'] || '')
      if (resp.config.responseType === 'blob' || ct.includes('application/octet-stream')) {
        return resp.data
      }

      const r = resp.data as ApiResp
      // 如果你的后端不是这个结构，就在这里改
      if (typeof r?.code === 'number') {
        if (r.code === 0) return r.data
        // 常见：401 未登录/过期
        if (r.code === 401) {
          showError(r.message || '登录已过期，请重新登录', resp.config.silent)
          const { logout } = useAuth()
          logout()
          return Promise.reject(new Error(r.message || 'Unauthorized'))
        }
        showError(r.message || '请求失败', resp.config.silent)
        return Promise.reject(new Error(r.message || 'BusinessError'))
      }

      // 非标准结构：直接返回 data
      return resp.data
    },
    (err: AxiosError) => {
      const config = (err.config || {}) as AxiosRequestConfig
      removePending(config)

      // 主动取消（重复请求取消/手动 abort）
      if (axios.isCancel?.(err) || err.code === 'ERR_CANCELED') {
        return Promise.reject(err)
      }

      // 统一网络错误提示
      const status = err.response?.status
      const msg =
        status === 401
          ? '未授权，请登录'
          : status === 403
            ? '没有权限'
            : status === 404
              ? '接口不存在'
              : status === 500
                ? '服务器错误'
                : err.message || '网络异常'

      showError(msg, config.silent)
      return Promise.reject(err)
    },
  )

  return instance
}

/** 默认导出一个全局实例 */
export const http: AxiosInstance = createHttpClient()

/** ========== 便捷方法：带类型返回 ========== */
export function get<T>(url: string, params?: any, config?: AxiosRequestConfig) {
  return http.get<any, T>(url, { params, ...(config || {}) })
}
export function post<T>(url: string, data?: any, config?: AxiosRequestConfig) {
  return http.post<any, T>(url, data, config)
}
export function put<T>(url: string, data?: any, config?: AxiosRequestConfig) {
  return http.put<any, T>(url, data, config)
}
export function del<T>(url: string, params?: any, config?: AxiosRequestConfig) {
  return http.delete<any, T>(url, { params, ...(config || {}) })
}
