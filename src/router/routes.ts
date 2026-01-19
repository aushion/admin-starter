import type { RouteRecordRaw } from 'vue-router'
import AdminLayout from '@/layout/AdminLayout.vue'
import BlankLayout from '@/layout/BlankLayout.vue'

export const routes: RouteRecordRaw[] = [
  {
    path: '/403',
    name: 'Forbidden',
    component: () => import('@/pages/exception/403.vue'),
    meta: { title: '无权限', hidden: true, public: true },
  },

  // ✅ 大屏：独立路由树（不带菜单栏）
  {
    path: '/map-ol',
    component: BlankLayout,
    children: [
      {
        path: '',
        name: 'MapScreen',
        component: () => import('@/pages/map-ol/index.vue'),
        meta: { title: '地图大屏', layout: 'blank', permissions: ['map:screen'] },
      },
    ],
  },

  // ✅ 后台：原有路由树（带 AdminLayout）
  {
    path: '/',
    component: AdminLayout,
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/pages/dashboard/index.vue'),
        meta: { title: '仪表盘', icon: 'i-carbon-dashboard', affix: true, keepAlive: true, permissions: ['dashboard:view'] },
      },
      {
        path: 'charts',
        name: 'Charts',
        component: () => import('@/pages/charts/index.vue'),
        meta: { title: 'ECharts', icon: 'i-carbon-chart-bar', keepAlive: true, permissions: ['charts:view'] },
      },
      // {
      //   path: 'map-ol',
      //   name: 'MapOL',
      //   component: () => import('@/pages/map-ol/index.vue'),
      //   meta: { title: 'OpenLayers', icon: 'i-carbon-map' },
      // },
      {
        path: 'map-cesium',
        name: 'MapCesium',
        component: () => import('@/pages/map-cesium/index.vue'),
        meta: { title: 'Cesium', icon: 'i-carbon-earth', permissions: ['map:cesium'] },
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
        meta: { title: 'Excel 导出', icon: 'i-carbon-document-export', permissions: ['excel:export'] },
      },
    ],
  },
]
