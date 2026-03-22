import type { RouteRecordRaw } from 'vue-router'
import { dynamicRoutes } from './routes'
import type { PermissionCode } from '@/store/permission'

/**
 * 检查用户权限是否满足路由要求
 */
function hasAccess(permissions: PermissionCode[], routeMeta?: Record<string, any>): boolean {
  // 无 meta 或无 permissions 要求 → 放行
  if (!routeMeta?.permissions || routeMeta.permissions.length === 0) return true
  // 通配符
  if (permissions.includes('*')) return true
  // 路由要求的权限必须全部满足
  return (routeMeta.permissions as PermissionCode[]).every((p) => permissions.includes(p))
}

/**
 * 递归过滤路由树
 */
function filterRoutes(routes: RouteRecordRaw[], permissions: PermissionCode[]): RouteRecordRaw[] {
  const result: RouteRecordRaw[] = []

  for (const route of routes) {
    if (!hasAccess(permissions, route.meta as Record<string, any>)) continue

    const filtered = { ...route }

    if (Array.isArray(route.children) && route.children.length > 0) {
      filtered.children = filterRoutes(route.children, permissions)
    }

    result.push(filtered)
  }

  return result
}

/**
 * 根据用户权限列表，从全量动态路由中过滤出可访问的路由
 */
export function generateRoutes(permissions: PermissionCode[]): RouteRecordRaw[] {
  return filterRoutes(dynamicRoutes, permissions)
}
