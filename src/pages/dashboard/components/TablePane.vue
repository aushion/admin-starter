<template>
  <section class="table-pane">
    <!-- Basic table -->
    <article
      v-if="visibleTables.includes('basic')"
      class="table-box"
      :class="{
        'is-active': activeTab === 'basic',
        'is-expanded': !basicCollapsed && basicDataSource.length > 0,
      }"
    >
      <header class="table-box__head">
        <span>{{ basicTitle }}</span>
        <div class="table-box__head-actions">
          <el-tag size="small" :type="activeTab === 'basic' ? 'success' : 'info'">
            {{ basicDataSource.length }} 条
          </el-tag>
          <el-button
            text
            size="small"
            :disabled="basicDataSource.length === 0"
            @click="emit('toggle-collapse', { tab: 'basic' })"
          >
            {{ basicDataSource.length === 0 ? '无数据' : basicCollapsed ? '展开' : '收起' }}
          </el-button>
        </div>
      </header>
      <div
        class="table-box__body"
        :class="{ 'is-collapsed': basicDataSource.length === 0 || basicCollapsed }"
      >
        <ResultTable
          :title="basicTitle"
          :columns="basicColumns"
          :data-source="basicDataSource"
          :loading="basicLoading"
          :focused-id="focusedId"
          :selected-keys="basicSelectedKeys"
          @focus-map="(row) => emit('focus-map', { tab: 'basic', row })"
          @selection-change="(payload) => emit('selection-change', { tab: 'basic', payload })"
        />
      </div>
    </article>

    <!-- Advanced table -->
    <article
      v-if="visibleTables.includes('advanced')"
      class="table-box"
      :class="{
        'is-active': activeTab === 'advanced',
        'is-expanded': !advancedCollapsed && advancedDataSource.length > 0,
      }"
    >
      <header class="table-box__head">
        <span>{{ advancedTitle }}</span>
        <div class="table-box__head-actions">
          <el-tag size="small" :type="activeTab === 'advanced' ? 'success' : 'info'">
            {{ advancedDataSource.length }} 条
          </el-tag>
          <el-button
            text
            size="small"
            :disabled="advancedDataSource.length === 0"
            @click="emit('toggle-collapse', { tab: 'advanced' })"
          >
            {{ advancedDataSource.length === 0 ? '无数据' : advancedCollapsed ? '展开' : '收起' }}
          </el-button>
        </div>
      </header>
      <div
        class="table-box__body"
        :class="{ 'is-collapsed': advancedDataSource.length === 0 || advancedCollapsed }"
      >
        <ResultTable
          :title="advancedTitle"
          :columns="advancedColumns"
          :data-source="advancedDataSource"
          :loading="advancedLoading"
          :focused-id="focusedId"
          :selected-keys="advancedSelectedKeys"
          @focus-map="(row) => emit('focus-map', { tab: 'advanced', row })"
          @selection-change="(payload) => emit('selection-change', { tab: 'advanced', payload })"
        />
      </div>
    </article>

    <!-- Stats table -->
    <article
      v-if="visibleTables.includes('stats')"
      class="table-box"
      :class="{ 'is-expanded': !statsCollapsed && statsDataSource.length > 0 }"
    >
      <header class="table-box__head">
        <span>{{ statsTitle }}</span>
        <div class="table-box__head-actions">
          <el-tag size="small" type="info">{{ statsDataSource.length }} 组</el-tag>
          <el-button
            text
            size="small"
            :disabled="statsDataSource.length === 0"
            @click="emit('toggle-stats-collapse')"
          >
            {{ statsDataSource.length === 0 ? '无数据' : statsCollapsed ? '展开' : '收起' }}
          </el-button>
        </div>
      </header>
      <div
        class="table-box__body"
        :class="{ 'is-collapsed': statsDataSource.length === 0 || statsCollapsed }"
      >
        <StatsTable :data-source="statsDataSource" :loading="statsLoading" />
      </div>
    </article>
  </section>
</template>

<script setup lang="ts">
import type { ProColumn } from '@/components/ProTable'
import ResultTable from './ResultTable.vue'
import StatsTable from './StatsTable.vue'
import type { DeviceRow, QueryTabKey, StatsRow } from '../types'
import type { TableKey } from '@/store/dashboardLayout'

defineProps<{
  activeTab: QueryTabKey
  visibleTables: TableKey[]

  basicTitle: string
  basicColumns: ProColumn<DeviceRow>[]
  basicDataSource: DeviceRow[]
  basicLoading: boolean
  basicCollapsed: boolean
  basicSelectedKeys: Array<string | number>

  advancedTitle: string
  advancedColumns: ProColumn<DeviceRow>[]
  advancedDataSource: DeviceRow[]
  advancedLoading: boolean
  advancedCollapsed: boolean
  advancedSelectedKeys: Array<string | number>

  statsTitle: string
  statsDataSource: StatsRow[]
  statsLoading: boolean
  statsCollapsed: boolean

  focusedId?: number
}>()

const emit = defineEmits<{
  (e: 'toggle-collapse', payload: { tab: QueryTabKey }): void
  (e: 'toggle-stats-collapse'): void
  (e: 'focus-map', payload: { tab: QueryTabKey; row: DeviceRow }): void
  (
    e: 'selection-change',
    payload: {
      tab: QueryTabKey
      payload: { keys: Array<string | number>; rows: DeviceRow[] }
    },
  ): void
}>()
</script>

<style scoped>
.table-pane {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* Each visible table gets an equal share of height */
.table-box {
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  background: #fff;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  /* collapsed: shrink to just the header */
  flex: 0 0 auto;
  transition: flex 0.24s ease;
}

/* When expanded, participate in flex height sharing */
.table-box.is-expanded {
  flex: 1 1 0;
  min-height: 0;
}

.table-box.is-active {
  border-color: var(--el-color-success);
}

.table-box__head {
  height: 42px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  background: var(--el-fill-color-lighter);
  font-size: 13px;
  color: var(--el-text-color-primary);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.table-box__head-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.table-box__body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  transition: opacity 0.16s ease;
}

.table-box__body.is-collapsed {
  flex: 0 0 0;
  opacity: 0;
  pointer-events: none;
}
</style>
