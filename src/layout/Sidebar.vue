<template>
  <aside
      class="h-full border-r border-gray-200 dark:border-gray-700 transition-all duration-200 overflow-hidden"
      :class="collapsed ? 'w-16' : 'w-56'"
  >
    <!-- Logo / 标题 -->
    <div class="h-12 flex items-center justify-center border-b border-gray-200 dark:border-gray-700">
      <span class="font-600 text-sm" v-if="!collapsed">Admin</span>
      <span v-else>☰</span>
    </div>

    <el-menu
        class="border-0!"
        :default-active="activePath"
        :collapse="collapsed"
        :collapse-transition="false"
        router
    >
      <SidebarItem
          v-for="item in menus"
          :key="item.key"
          :item="item"
      />
    </el-menu>
  </aside>
</template>

<script setup lang="ts">
import { computed, defineComponent,resolveComponent, h, type PropType } from 'vue'
import { useRoute } from 'vue-router'
import { useApp } from '../composables/useApp'
import { routes } from '../router/routes'
import type { RouteRecordRaw } from 'vue-router'
import SidebarItem from './MenuItem.vue'

type MenuItem = {
  key: string
  title: string
  icon?: string
  path?: string              // el-menu-item 的 index（用于 router 跳转）
  children?: MenuItem[]
}

const route = useRoute()
const { sidebarCollapsed } = useApp()

const collapsed = computed(() => sidebarCollapsed.value)
const activePath = computed(() => route.path)

// 你可以在 meta 里约定 hidden: true 来隐藏菜单
function isHidden(r: RouteRecordRaw) {
  return Boolean((r.meta as any)?.hidden)
}

function getTitle(r: RouteRecordRaw) {
  return String((r.meta as any)?.title || r.name || r.path)
}

function getIcon(r: RouteRecordRaw) {
  const icon = (r.meta as any)?.icon
  return (typeof icon === 'string' && icon.trim()) ? icon : undefined
}

/**
 * 把 routes 转成菜单树
 * - 支持多级 children
 * - path 自动拼成绝对路径：/parent/child
 */
function buildMenuTree(records: RouteRecordRaw[], base = ''): MenuItem[] {
  const res: MenuItem[] = []

  for (const r of records) {
    if (!r || isHidden(r)) continue

    // 计算当前节点的绝对路径
    const rawPath = String(r.path || '')
    const fullPath = rawPath.startsWith('/')
        ? rawPath
        : `${base}/${rawPath}`.replace(/\/+/g, '/')

    // 递归 children
    const children = Array.isArray(r.children) ? buildMenuTree(r.children, fullPath) : []

    // 目录节点：只有 children，没有 component 的也可当目录
    const title = getTitle(r)
    const icon = getIcon(r)

    console.log(icon, 'icon');
    

    // 如果这个路由本身没有 title，但子节点有（极少），也可以选择隐藏父级
    // 这里按“只要有 children 就展示”处理
    if (children.length > 0) {
      res.push({
        key: String(r.name || fullPath),
        title,
        icon,
        // 注意：目录不一定要可点击；如果你希望点击目录也跳转，就把 path: fullPath 打开
        // path: fullPath,
        children,
      })
      continue
    }

    // 叶子节点：菜单项必须有可跳转 path
    // 有些路由可能是 redirect-only 或空 path，这里做基本兜底
    if (title) {
      res.push({
        key: String(r.name || fullPath),
        title,
        icon,
        path: fullPath,
      })
    }
  }
  console.log(res,'res')
  return res
}

/**
 * 从 routes.ts 里提取 layout 下菜单
 */
const menus = computed<MenuItem[]>(() => {
  const root = routes.find(r => r.path === '/')
  const children = (root?.children || []).filter(r => !isHidden(r))
  return buildMenuTree(children, '')
})

/**
 * 递归菜单组件：SidebarItem
 * - item.children => el-sub-menu
 * - else => el-menu-item
 */
// const SidebarItem = defineComponent({
//   name: 'SidebarItem',
//   props: {
//     item: {
//       type: Object as PropType<MenuItem>,
//       required: true,
//     },
//   },
//   setup(props) {
//     const ElSubMenu = resolveComponent('el-sub-menu')
//     const ElMenuItem = resolveComponent('el-menu-item')

//     const renderIcon = (icon?: string) => {
//       if (!icon) return null
//       return h('span', {
//         class: [icon, 'w-5', 'h-5', 'inline-block', 'mr-2', 'align-middle', 'text-current'],
//       })
//     }

//     const renderTitle = (title: string, icon?: string) =>
//         h('span', { class: 'flex items-center' }, [
//           renderIcon(icon),
//           h('span', { class: 'align-middle' }, title),
//         ])

//     return () => {
//       const item = props.item
//       const hasChildren = Array.isArray(item.children) && item.children.length > 0

//       if (hasChildren) {
//         return h(
//             ElSubMenu as any,
//             { index: item.key },
//             {
//               title: () => renderTitle(item.title, item.icon),
//               default: () => item.children!.map(child => h(SidebarItem, { item: child, key: child.key })),
//             },
//         )
//       }

//       return h(
//           ElMenuItem as any,
//           { index: item.path || '' },
//           { default: () => renderTitle(item.title, item.icon) },
//       )
//     }
//   },
// })
</script>
