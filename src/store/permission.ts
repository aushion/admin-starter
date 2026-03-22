import { defineStore } from 'pinia'
import { getMeApi } from '@/api/auth'
import { generateRoutes } from '@/router/generator'
import type { RouteRecordRaw } from 'vue-router'

export type PermissionCode = string

export type UserProfile = {
  id: string
  name: string
  roles: string[]
  permissions: PermissionCode[]
}

export type AccessMeta = {
  public?: boolean
  roles?: string[]
  permissions?: PermissionCode[]
}

function toArray(input?: string | string[]) {
  if (!input) return [] as string[]
  return Array.isArray(input) ? input : [input]
}

export const usePermissionStore = defineStore('permission', {
  state: () => ({
    /** 用户信息（登录后从 /auth/me 获取） */
    profile: null as UserProfile | null,
    /** 权限是否已加载（用于路由守卫判断是否需要重新拉取） */
    loaded: false,
    /** 根据权限过滤后的动态路由 */
    dynamicRoutes: [] as RouteRecordRaw[],
  }),
  getters: {
    roles: (state) => state.profile?.roles ?? [],
    permissions: (state) => state.profile?.permissions ?? [],
    isLoggedIn: (state) => state.loaded && !!state.profile,
  },
  actions: {
    /** 从后端拉取用户信息和权限，生成动态路由 */
    async fetchUser() {
      const info = await getMeApi()
      this.profile = {
        id: info.id,
        name: info.name,
        roles: info.roles,
        permissions: info.permissions,
      }
      this.dynamicRoutes = generateRoutes(info.permissions)
      this.loaded = true
      return this.dynamicRoutes
    },

    /** 重置权限状态（登出时调用） */
    resetPermission() {
      this.profile = null
      this.loaded = false
      this.dynamicRoutes = []
    },

    hasRole(roles?: string | string[]) {
      const required = toArray(roles)
      if (required.length === 0) return true
      return required.some((r) => this.roles.includes(r))
    },

    hasPermission(perms?: PermissionCode | PermissionCode[]) {
      const required = toArray(perms)
      if (required.length === 0) return true
      if (this.permissions.includes('*')) return true
      return required.every((p) => this.permissions.includes(p))
    },

    canAccess(meta?: AccessMeta) {
      if (!meta || meta.public) return true
      if (meta.roles && !this.hasRole(meta.roles)) return false
      if (meta.permissions && !this.hasPermission(meta.permissions)) return false
      return true
    },
  },
})
