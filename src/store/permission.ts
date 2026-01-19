import { defineStore } from 'pinia'

export type PermissionCode = string

export type UserProfile = {
  id: string
  name: string
  roles: string[]
  permissions: PermissionCode[]
}

export type PresetKey = 'admin' | 'ops' | 'viewer'

const STORAGE_KEY = 'admin-starter.user'

const PRESETS: Record<PresetKey, UserProfile> = {
  admin: {
    id: '1',
    name: '管理员',
    roles: ['admin'],
    permissions: ['*'],
  },
  ops: {
    id: '2',
    name: '运营',
    roles: ['ops'],
    permissions: [
      'dashboard:view',
      'dashboard:open-map',
      'dashboard:query',
      'map:screen',
      'charts:view',
    ],
  },
  viewer: {
    id: '3',
    name: '访客',
    roles: ['viewer'],
    permissions: ['dashboard:view'],
  },
}

function toArray(input?: string | string[]) {
  if (!input) return [] as string[]
  return Array.isArray(input) ? input : [input]
}

function loadPreset(): PresetKey {
  const cached = typeof localStorage !== 'undefined'
    ? (localStorage.getItem(STORAGE_KEY) as PresetKey | null)
    : null
  return cached && PRESETS[cached] ? cached : 'admin'
}

const initialPreset = loadPreset()

export type AccessMeta = {
  public?: boolean
  roles?: string[]
  permissions?: PermissionCode[]
}

export const usePermissionStore = defineStore('permission', {
  state: () => ({
    currentKey: initialPreset as PresetKey,
    profile: PRESETS[initialPreset],
  }),
  getters: {
    roles: (state) => state.profile.roles,
    permissions: (state) => state.profile.permissions,
  },
  actions: {
    switchPreset(key: PresetKey) {
      if (!PRESETS[key]) return
      this.currentKey = key
      this.profile = PRESETS[key]
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, key)
      }
    },
    hasRole(roles?: string | string[]) {
      const required = toArray(roles)
      if (required.length === 0) return true
      return required.some(r => this.roles.includes(r))
    },
    hasPermission(perms?: PermissionCode | PermissionCode[]) {
      const required = toArray(perms)
      if (required.length === 0) return true
      if (this.permissions.includes('*')) return true
      return required.every(p => this.permissions.includes(p))
    },
    canAccess(meta?: AccessMeta) {
      if (!meta || meta.public) return true
      if (meta.roles && !this.hasRole(meta.roles)) return false
      if (meta.permissions && !this.hasPermission(meta.permissions)) return false
      return true
    },
  },
})
