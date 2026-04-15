<template>
  <div v-loading="loading" class="stats-table-wrap">
    <el-auto-resizer>
      <template #default="{ height, width }">
        <el-table-v2
          :columns="columns"
          :data="dataSource"
          :width="width"
          :height="Math.max(height, 120)"
          :row-height="40"
          :header-height="42"
        />
      </template>
    </el-auto-resizer>
  </div>
</template>

<script setup lang="ts">
import { computed, h } from 'vue'
import { ElTag } from 'element-plus'
import type { StatsRow } from '../types'

defineProps<{
  dataSource: StatsRow[]
  loading?: boolean
}>()

const ZONE_LABEL: Record<string, string> = {
  north: '北区',
  south: '南区',
  west: '西区',
}

const columns = computed(() => [
  {
    key: 'zone',
    dataKey: 'zoneLabel',
    title: '区域',
    width: 100,
    cellRenderer: ({ rowData }: { rowData: StatsRow }) =>
      h('span', { style: 'font-weight:600' }, ZONE_LABEL[rowData.zone] ?? rowData.zone),
  },
  {
    key: 'online',
    dataKey: 'online',
    title: '在线',
    width: 100,
    cellRenderer: ({ rowData }: { rowData: StatsRow }) =>
      h(ElTag, { size: 'small', type: 'success' }, () => String(rowData.online)),
  },
  {
    key: 'offline',
    dataKey: 'offline',
    title: '离线',
    width: 100,
    cellRenderer: ({ rowData }: { rowData: StatsRow }) =>
      h(ElTag, { size: 'small', type: 'info' }, () => String(rowData.offline)),
  },
  {
    key: 'total',
    dataKey: 'total',
    title: '合计',
    width: 100,
    cellRenderer: ({ rowData }: { rowData: StatsRow }) =>
      h('span', { style: 'font-weight:600' }, String(rowData.total)),
  },
  {
    key: 'p1',
    dataKey: 'p1',
    title: 'P1 优先级',
    width: 110,
    cellRenderer: ({ rowData }: { rowData: StatsRow }) =>
      h(ElTag, { size: 'small', type: 'danger' }, () => String(rowData.p1)),
  },
  {
    key: 'p2',
    dataKey: 'p2',
    title: 'P2 优先级',
    width: 110,
    cellRenderer: ({ rowData }: { rowData: StatsRow }) =>
      h(ElTag, { size: 'small', type: 'warning' }, () => String(rowData.p2)),
  },
  {
    key: 'p3',
    dataKey: 'p3',
    title: 'P3 优先级',
    width: 110,
    cellRenderer: ({ rowData }: { rowData: StatsRow }) =>
      h(ElTag, { size: 'small', type: '' }, () => String(rowData.p3)),
  },
])
</script>

<style scoped>
.stats-table-wrap {
  height: 100%;
  padding: 8px 12px 12px;
  box-sizing: border-box;
}
</style>
