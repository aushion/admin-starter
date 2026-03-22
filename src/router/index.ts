import { createRouter, createWebHistory } from 'vue-router'
import { staticRoutes, wrapWithLayout } from './routes'
import { useTagsView } from '@/composables/useTagsView'
import { usePermissionStore } from '@/store/permission'
import { useAuth } from '@/composables/useAuth'

const router = createRouter({
  history: createWebHistory(),
  routes: staticRoutes,
})

/** 白名单路径：无需登录即可访问 */
const WHITE_LIST = ['/login', '/register', '/403']

router.beforeEach(async (to, _from, next) => {
  const { token } = useAuth()
  const permission = usePermissionStore()

  // 1. 无 token → 只允许白名单
  if (!token.value) {
    if (WHITE_LIST.includes(to.path)) return next()
    return next({ path: '/login', query: { redirect: to.fullPath }, replace: true })
  }

  // 2. 已登录 → 不允许再访问登录页
  if (to.path === '/login') {
    return next({ path: '/', replace: true })
  }

  // 3. 权限已加载 → 直接放行
  if (permission.loaded) {
    return next()
  }

  // 4. 权限未加载 → 拉取用户信息 + 动态注册路由
  try {
    const dynamicChildren = await permission.fetchUser()
    const layoutRoute = wrapWithLayout(dynamicChildren)
    router.addRoute(layoutRoute)
    // 动态路由注册后初始化固定页签
    const tv = useTagsView()
    tv.initAffixTags(router)
    // 用 replace 重新导航，确保 addRoute 后的路由能匹配
    return next({ ...to, replace: true })
  } catch {
    // token 失效等异常 → 清除状态跳登录
    const { logout } = useAuth()
    logout()
    permission.resetPermission()
    return next({ path: '/login', query: { redirect: to.fullPath }, replace: true })
  }
})

// 路由跳转后自动加入 tags
router.afterEach((to) => {
  const tv = useTagsView()
  if (to.meta?.title && !to.meta?.hidden) tv.addView(to as any)
})

export default router
