import { computed, ref } from 'vue'
import type { RouteLocationNormalizedLoaded, Router } from 'vue-router'

export type TagView = {
  title: string
  fullPath: string
  path: string
  name?: string | symbol
  affix?: boolean
  keepAlive?: boolean
}

const _views = ref<TagView[]>([])

function getTitle(route: RouteLocationNormalizedLoaded) {
  const t = route.meta?.title
  return typeof t === 'string' && t.trim() ? t : route.name ? String(route.name) : route.path
}

function isSameTag(a: TagView, b: TagView) {
  // 用 fullPath 更符合实际（同一路由不同 query 也算不同页签）
  return a.fullPath === b.fullPath
}

function normalize(route: RouteLocationNormalizedLoaded): TagView {
  return {
    title: getTitle(route),
    fullPath: route.fullPath,
    path: route.path,
    name: route.name,
    affix: Boolean(route.meta?.affix),
    keepAlive: Boolean(route.meta?.keepAlive),
  }
}

export function useTagsView() {
  const views = computed(() => _views.value)

  // 给 keep-alive 用（注意：keep-alive 匹配的是组件 name，不是 route name；下面会教你怎么启用）
  const cachedNames = computed(() => {
    return _views.value
      .filter((v) => v.keepAlive && typeof v.name === 'string')
      .map((v) => v.name as string)
  })

  function initAffixTags(router: Router) {
    // 扫描路由 meta.affix 的固定页（比如 dashboard）
    const affix: TagView[] = []

    const walk = (routes: any[], basePath = '') => {
      routes.forEach((r) => {
        const full = r.path.startsWith('/') ? r.path : `${basePath}/${r.path}`.replace(/\/+/g, '/')
        if (r.meta?.affix) {
          affix.push({
            title: r.meta?.title || String(r.name || full),
            fullPath: full,
            path: full,
            name: r.name,
            affix: true,
            keepAlive: Boolean(r.meta?.keepAlive),
          })
        }
        if (r.children?.length) walk(r.children, full)
      })
    }

    walk(router.getRoutes(), '')
    // 去重
    const uniq: TagView[] = []
    for (const t of affix) {
      if (!uniq.some((x) => x.fullPath === t.fullPath)) uniq.push(t)
    }

    // 只初始化一次
    if (_views.value.length === 0) _views.value = uniq
  }

  function addView(route: RouteLocationNormalizedLoaded) {
    // 不加入没有标题的页面也行，这里按 meta.title / name 兜底
    const tag = normalize(route)
    if (_views.value.some((v) => isSameTag(v, tag))) return
    _views.value.push(tag)
  }

  function removeView(tag: TagView) {
    if (tag.affix) return
    _views.value = _views.value.filter((v) => !isSameTag(v, tag))
  }

  function removeOthers(tag: TagView) {
    _views.value = _views.value.filter((v) => v.affix || isSameTag(v, tag))
  }

  function removeAll() {
    _views.value = _views.value.filter((v) => v.affix)
  }

  return {
    views,
    cachedNames,
    initAffixTags,
    addView,
    removeView,
    removeOthers,
    removeAll,
  }
}
