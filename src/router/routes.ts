import type { RouteRecordRaw } from 'vue-router'
import AdminLayout from '@/layout/AdminLayout.vue'

/**
 * 静态路由：不需要权限，app 启动就注册
 */
export const staticRoutes: RouteRecordRaw[] = [
  {
    path: '/403',
    name: 'Forbidden',
    component: () => import('@/pages/exception/403.vue'),
    meta: { title: '无权限', hidden: true, public: true },
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/pages/auth/login.vue'),
    meta: { title: '登录', hidden: true, public: true },
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/pages/auth/register.vue'),
    meta: { title: '注册', hidden: true, public: true },
  },
]

/**
 * 动态路由（全量）：登录后根据权限过滤，再通过 addRoute 注册
 * 注意：这里定义 AdminLayout 的 children，由 generator.ts 过滤后包装为完整路由
 */
export const dynamicRoutes: RouteRecordRaw[] = [
  {
    path: 'dashboard',
    name: 'Dashboard',
    component: () => import('@/pages/dashboard/index.vue'),
    meta: {
      title: '仪表盘',
      icon: 'i-carbon-dashboard',
      affix: true,
      keepAlive: true,
      permissions: ['dashboard:view'],
    },
  },
  {
    path: 'charts',
    name: 'Charts',
    component: () => import('@/pages/charts/index.vue'),
    meta: {
      title: 'ECharts',
      icon: 'i-carbon-chart-bar',
      keepAlive: true,
      permissions: ['charts:view'],
    },
  },
  {
    path: 'icon',
    name: 'Icon',
    component: () => import('@/pages/icons/index.vue'),
    meta: { title: '图标', icon: 'i-carbon-document-export', permissions: ['icons:view'] },
  },
  {
    path: 'map-cesium',
    name: 'MapCesium',
    component: () => import('@/pages/map-cesium/index.vue'),
    meta: { title: 'Cesium', icon: 'i-carbon-earth', permissions: ['map:cesium'] },
  },
  {
    path: 'map-ol',
    name: 'MapOl',
    component: () => import('@/pages/map-ol/index.vue'),
    meta: { title: 'OpenLayers', icon: 'i-carbon-earth', permissions: ['map:ol'] },
  },
  {
    path: 'flow',
    name: 'Flow',
    component: () => import('@/pages/graph-flow/index.vue'),
    meta: { title: '流程图(轻量)', icon: 'i-carbon-flow', permissions: ['flow:view'] },
  },
  {
    path: 'mind',
    name: 'Mind',
    component: () => import('@/pages/graph-mind/index.vue'),
    meta: { title: '思维导图(轻量)', icon: 'i-carbon-network-3', permissions: ['mind:view'] },
  },
  {
    path: 'excel',
    name: 'Excel',
    component: () => import('@/pages/excel/index.vue'),
    meta: {
      title: 'Excel 导出',
      icon: 'i-carbon-document-export',
      permissions: ['excel:view'],
    },
  },
]

/**
 * 包装动态路由为完整的 AdminLayout 路由记录
 */
export function wrapWithLayout(children: RouteRecordRaw[]): RouteRecordRaw {
  return {
    path: '/',
    component: AdminLayout,
    redirect: children.length > 0 ? `/${children[0].path}` : '/403',
    children,
  }
}
