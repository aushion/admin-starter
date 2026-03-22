import { usePermissionStore, type PermissionCode } from '@/store/permission'

/**
 * 权限判断 composable
 * 在组件中使用：const { hasPermission, hasAnyPermission } = usePermission()
 */
export function usePermission() {
  const store = usePermissionStore()

  /** 检查是否拥有所有指定权限（AND） */
  function hasPermission(perms: PermissionCode | PermissionCode[]) {
    return store.hasPermission(perms)
  }

  /** 检查是否拥有任一指定权限（OR） */
  function hasAnyPermission(perms: PermissionCode[]) {
    if (perms.length === 0) return true
    if (store.permissions.includes('*')) return true
    return perms.some((p) => store.permissions.includes(p))
  }

  /** 检查是否拥有指定角色 */
  function hasRole(roles: string | string[]) {
    return store.hasRole(roles)
  }

  return { hasPermission, hasAnyPermission, hasRole }
}
