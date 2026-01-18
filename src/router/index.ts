import { createRouter, createWebHistory } from 'vue-router'
import { routes } from './routes'
import { useTagsView } from '@/composables/useTagsView'

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// 初始化 affix（固定页签）
const tv = useTagsView()
tv.initAffixTags(router)

// 路由跳转后自动加入 tags
router.afterEach((to) => {
  // 只对 layout 内页面生效：一般都带 meta.title
  if (to.meta?.title) tv.addView(to as any)
})

export default router
