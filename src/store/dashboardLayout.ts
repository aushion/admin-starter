import { defineStore } from 'pinia'
import { useStorage } from '@vueuse/core'

export type TableKey = 'basic' | 'advanced' | 'stats'

export const TABLE_OPTIONS: { key: TableKey; label: string }[] = [
  { key: 'basic', label: '基础查询结果表' },
  { key: 'advanced', label: '扩展筛选结果表' },
  { key: 'stats', label: '分区统计汇总表' },
]

export const useDashboardLayoutStore = defineStore('dashboardLayout', () => {
  const visibleTables = useStorage<TableKey[]>('dashboard-visible-tables', ['basic', 'advanced'])

  function setVisibleTables(keys: TableKey[]) {
    visibleTables.value = keys.length ? keys : ['basic']
  }

  return { visibleTables, setVisibleTables }
})
