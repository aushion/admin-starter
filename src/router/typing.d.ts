import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    icon?: string
    affix?: boolean
    keepAlive?: boolean
    hidden?: boolean
    layout?: string
    public?: boolean
    roles?: string[]
    permissions?: string[]
  }
}
