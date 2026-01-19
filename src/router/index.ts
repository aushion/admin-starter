import { createRouter, createWebHistory } from 'vue-router'
import { routes } from './routes'
import { useTagsView } from '@/composables/useTagsView'
import { usePermissionStore } from '@/store/permission'

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to, _from, next) => {
  const permission = usePermissionStore()
  const allowed = to.matched.every(r => permission.canAccess(r.meta))

  if (!allowed) {
    return next({ path: '/403', query: { from: to.fullPath }, replace: true })
  }

  next()
})

// 初始化 affix（固定页签）
const tv = useTagsView()
tv.initAffixTags(router)

// 路由跳转后自动加入 tags
router.afterEach((to) => {
  // 只对 layout 内页面生效：一般都带 meta.title
  if (to.meta?.title && !to.meta?.hidden) tv.addView(to as any)
})

export default router
