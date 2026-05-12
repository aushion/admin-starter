<template>
  <section class="query-panel">
    <div class="pane-title">ProForm 查询条件</div>
    <div class="pane-desc">每个 Tab 是独立表单，提交时只触发当前 Tab 的查询。</div>

    <el-tabs v-model="activeTabProxy" class="query-tabs">
      <el-tab-pane label="基础查询" name="basic">
        <div class="query-form-scroll">
          <ProForm
            v-model="basicModelProxy"
            :schema="basicSchema"
            layout="horizontal"
            label-width="96"
            :default-col-span="24"
            :gutter="0"
            submit-text="查询"
            reset-text="重置"
            @submit="onSubmitBasic"
            @reset="onResetBasic"
          />
        </div>
      </el-tab-pane>

      <el-tab-pane label="扩展筛选" name="advanced">
        <div class="query-form-scroll">
          <ProForm
            v-model="advancedModelProxy"
            :schema="advancedSchema"
            layout="horizontal"
            label-width="96"
            :default-col-span="24"
            :gutter="0"
            submit-text="查询"
            reset-text="重置"
            @submit="onSubmitAdvanced"
            @reset="onResetAdvanced"
          />
        </div>
      </el-tab-pane>
    </el-tabs>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ProForm, { type ProFormItem } from '@/components/ProForm'
import type { AdvancedQueryForm, BasicQueryForm, QueryTabKey, TabQueryPayload } from '../types'

const props = withDefaults(
  defineProps<{
    activeTab: QueryTabKey
    basicModel: BasicQueryForm
    advancedModel: AdvancedQueryForm
  }>(),
  {
    activeTab: 'basic',
    basicModel: () => ({}),
    advancedModel: () => ({}),
  },
)

const emit = defineEmits<{
  (e: 'update:activeTab', value: QueryTabKey): void
  (e: 'update:basicModel', value: BasicQueryForm): void
  (e: 'update:advancedModel', value: AdvancedQueryForm): void
  (e: 'submit', payload: TabQueryPayload): void
  (e: 'reset', payload: TabQueryPayload): void
}>()

const activeTabProxy = computed<QueryTabKey>({
  get: () => props.activeTab,
  set: (value) => emit('update:activeTab', value),
})

const basicModelProxy = computed<BasicQueryForm>({
  get: () => props.basicModel,
  set: (value) => emit('update:basicModel', value),
})

const advancedModelProxy = computed<AdvancedQueryForm>({
  get: () => props.advancedModel,
  set: (value) => emit('update:advancedModel', value),
})

const basicSchema: ProFormItem[] = [
  { field: 'keyword', label: '关键词', valueType: 'text', placeholder: '设备名 / ID' },
  {
    field: 'status',
    label: '状态',
    valueType: 'select',
    valueEnum: { online: '在线', offline: '离线' },
  },
  {
    field: 'zone',
    label: '区域',
    valueType: 'select',
    valueEnum: { north: '北区', south: '南区', west: '西区' },
  },
  { field: 'owner', label: '负责人', valueType: 'text', placeholder: '负责人姓名' },
  { field: 'longitudeMin', label: '最小经度', valueType: 'text', placeholder: '如 115.80' },
  { field: 'longitudeMax', label: '最大经度', valueType: 'text', placeholder: '如 116.90' },
  { field: 'latitudeMin', label: '最小纬度', valueType: 'text', placeholder: '如 39.40' },
  { field: 'latitudeMax', label: '最大纬度', valueType: 'text', placeholder: '如 40.20' },
]

const advancedSchema: ProFormItem[] = [
  { field: 'keyword', label: '关键词', valueType: 'text', placeholder: '设备名 / ID' },
  {
    field: 'status',
    label: '状态',
    valueType: 'select',
    valueEnum: { online: '在线', offline: '离线' },
  },
  {
    field: 'zone',
    label: '区域',
    valueType: 'select',
    valueEnum: { north: '北区', south: '南区', west: '西区' },
  },
  {
    field: 'level',
    label: '优先级',
    valueType: 'select',
    valueEnum: { P1: 'P1', P2: 'P2', P3: 'P3' },
  },
  {
    field: 'source',
    label: '来源',
    valueType: 'select',
    valueEnum: { manual: '手工', api: '接口', import: '导入' },
  },
  { field: 'startedAt', label: '开始时间', valueType: 'datetime' },
  { field: 'endedAt', label: '结束时间', valueType: 'datetime' },
  { field: 'longitudeMin', label: '最小经度', valueType: 'text', placeholder: '如 115.80' },
  { field: 'longitudeMax', label: '最大经度', valueType: 'text', placeholder: '如 116.90' },
  { field: 'latitudeMin', label: '最小纬度', valueType: 'text', placeholder: '如 39.40' },
  { field: 'latitudeMax', label: '最大纬度', valueType: 'text', placeholder: '如 40.20' },
]

function onSubmitBasic(values: BasicQueryForm) {
  emit('submit', { tab: 'basic', values })
}

function onResetBasic(values: BasicQueryForm) {
  emit('reset', { tab: 'basic', values })
}

function onSubmitAdvanced(values: AdvancedQueryForm) {
  emit('submit', { tab: 'advanced', values })
}

function onResetAdvanced(values: AdvancedQueryForm) {
  emit('reset', { tab: 'advanced', values })
}
</script>

<style scoped>
.query-panel {
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  background: #fff;
  padding: 14px;
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.pane-title {
  margin-bottom: 4px;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.pane-desc {
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.query-tabs {
  margin-bottom: 0;
  flex: 1;
  min-height: 0;
}

.query-form-scroll {
  height: 100%;
  overflow: auto;
  padding-right: 4px;
}

.query-panel :deep(.el-tabs__header) {
  margin-bottom: 8px;
}

.query-panel :deep(.el-tabs__content) {
  height: calc(100% - 40px);
}

.query-panel :deep(.el-tab-pane) {
  height: 100%;
}

.query-panel :deep(.el-form-item) {
  margin-bottom: 12px;
}

.query-panel :deep(.el-form-item__content) {
  min-width: 0;
}

.query-panel :deep(.el-form-item__label) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.query-panel :deep(.el-input),
.query-panel :deep(.el-select),
.query-panel :deep(.el-date-editor) {
  width: 100%;
}

.query-panel :deep(.pro-form__actions) {
  position: sticky;
  bottom: 0;
  padding-top: 8px;
  background: #fff;
  z-index: 2;
}
</style>
