<template>
  <section class="table-pane">
    <article class="table-box" :class="{ 'is-active': activeTab === 'basic' }">
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

    <article class="table-box" :class="{ 'is-active': activeTab === 'advanced' }">
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
  </section>
</template>

<script setup lang="ts">
import type { ProColumn } from '@/components/ProTable'
import ResultTable from './ResultTable.vue'
import type { DeviceRow, QueryTabKey } from '../types'

defineProps<{
  activeTab: QueryTabKey

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

  focusedId?: number
}>()

const emit = defineEmits<{
  (e: 'toggle-collapse', payload: { tab: QueryTabKey }): void
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
}

.table-box {
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  background: #fff;
  overflow: hidden;
}

.table-box.is-active {
  border-color: var(--el-color-success);
}

.table-box__head {
  height: 42px;
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
  max-height: 1200px;
  opacity: 1;
  transition:
    max-height 0.24s ease,
    opacity 0.16s ease;
}

.table-box__body.is-collapsed {
  max-height: 0;
  opacity: 0;
}
</style>
