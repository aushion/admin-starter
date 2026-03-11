<template>
  <section class="result-panel">
    <div v-loading="loading" class="table-v2-wrap">
      <el-auto-resizer>
        <template #default="{ height, width }">
          <el-table-v2
            :columns="virtualColumns"
            :data="dataSource"
            :width="width"
            :height="Math.max(height, 360)"
            :row-height="40"
            :header-height="42"
            :row-class="rowClassName"
            :row-event-handlers="rowEventHandlers"
          />
        </template>
      </el-auto-resizer>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, h } from 'vue'
import { ElButton, ElCheckbox, ElTag } from 'element-plus'
import type { ProColumn } from '@/components/ProTable'
import type { DeviceRow } from '../types'

const props = withDefaults(
  defineProps<{
    title: string
    columns: ProColumn<DeviceRow>[]
    dataSource: DeviceRow[]
    loading: boolean
    focusedId?: number
    selectedKeys?: Array<string | number>
  }>(),
  {
    selectedKeys: () => [],
  },
)

const emit = defineEmits<{
  (e: 'focus-map', row: DeviceRow): void
  (e: 'selection-change', payload: { keys: Array<string | number>; rows: DeviceRow[] }): void
}>()

function toKey(raw: string | number) {
  return String(raw)
}

const selectedSet = computed(() => new Set((props.selectedKeys || []).map((k) => toKey(k))))
const rowKeys = computed(() => props.dataSource.map((row) => row.id))

const isAllChecked = computed(() => {
  const keys = rowKeys.value
  return keys.length > 0 && keys.every((id) => selectedSet.value.has(toKey(id)))
})

const isIndeterminate = computed(() => {
  const keys = rowKeys.value
  if (!keys.length) return false
  const checkedCount = keys.filter((id) => selectedSet.value.has(toKey(id))).length
  return checkedCount > 0 && checkedCount < keys.length
})

function emitSelection(keys: Array<string | number>) {
  const keySet = new Set(keys.map((k) => toKey(k)))
  const rows = props.dataSource.filter((row) => keySet.has(toKey(row.id)))
  emit('selection-change', { keys, rows })
}

function toggleAll(checked: boolean) {
  if (!checked) {
    emitSelection([])
    return
  }
  emitSelection(rowKeys.value)
}

function toggleRow(row: DeviceRow, checked: boolean) {
  const next = new Set((props.selectedKeys || []).map((k) => toKey(k)))
  if (checked) next.add(toKey(row.id))
  else next.delete(toKey(row.id))

  const keys = props.dataSource
    .map((item) => item.id)
    .filter((id) => next.has(toKey(id)))

  emitSelection(keys)
}

function getByPath(obj: Record<string, any>, path?: string) {
  if (!path) return undefined
  if (!path.includes('.')) return obj[path]
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj)
}

function enumText(col: ProColumn<DeviceRow>, raw: unknown) {
  const ve = col.valueEnum
  if (!ve) return raw

  if (Array.isArray(ve)) {
    const hit = ve.find((x) => String(x.value) === String(raw))
    if (!hit) return raw
    return hit.text ?? hit.label ?? raw
  }

  const hit = (ve as any)[String(raw)] ?? (ve as any)[raw as any]
  if (!hit) return raw
  if (typeof hit === 'string') return hit
  return hit.text ?? hit.label ?? raw
}

function enumTagType(col: ProColumn<DeviceRow>, raw: unknown) {
  const ve = col.valueEnum
  if (!ve) return ''

  if (Array.isArray(ve)) {
    const hit = ve.find((x) => String(x.value) === String(raw))
    return (hit as any)?.status ?? ''
  }

  const hit = (ve as any)[String(raw)] ?? (ve as any)[raw as any]
  return typeof hit === 'object' ? hit?.status ?? '' : ''
}

function renderCell(col: ProColumn<DeviceRow>, rowData: DeviceRow) {
  const isAction = col.key === 'action' || col.slot === 'action'
  if (isAction) {
    return h(
      ElButton,
      {
        link: true,
        type: 'primary',
        onClick: (event: Event) => {
          event.stopPropagation()
          emit('focus-map', rowData)
        },
      },
      () => '地图定位',
    )
  }

  const raw = col.dataIndex ? getByPath(rowData as any, col.dataIndex as string) : undefined
  const text = enumText(col, raw)

  if (col.valueType === 'tag') {
    return h(
      ElTag,
      { size: 'small', type: enumTagType(col, raw) as any },
      () => (text == null ? '-' : String(text)),
    )
  }

  return h('span', { class: 'cell-text' }, text == null || text === '' ? '-' : String(text))
}

const selectionColumn = computed(() => ({
  key: '__selection__',
  dataKey: '__selection__',
  title: '',
  width: 54,
  align: 'center' as const,
  fixed: 'left' as const,
  headerCellRenderer: () =>
    h(ElCheckbox, {
      modelValue: isAllChecked.value,
      indeterminate: isIndeterminate.value,
      disabled: props.dataSource.length === 0,
      onChange: (checked: unknown) => toggleAll(Boolean(checked)),
    }),
  cellRenderer: ({ rowData }: { rowData: DeviceRow }) =>
    h(ElCheckbox, {
      modelValue: selectedSet.value.has(toKey(rowData.id)),
      onClick: (event: Event) => event.stopPropagation(),
      onChange: (checked: unknown) => toggleRow(rowData, Boolean(checked)),
    }),
}))

const virtualColumns = computed(() => {
  const cols = (props.columns || []).map((col) => {
    const key = String(col.key || col.dataIndex || col.title)
    const width = Number(col.width ?? col.minWidth ?? 140)

    return {
      key,
      dataKey: String(col.dataIndex || key),
      title: col.title,
      width,
      align: col.align ?? 'left',
      cellRenderer: ({ rowData }: { rowData: DeviceRow }) => renderCell(col, rowData),
    }
  })

  return [selectionColumn.value, ...cols]
})

const rowClassName = ({ rowData }: { rowData: DeviceRow }) => {
  return Number(rowData.id) === Number(props.focusedId) ? 'is-map-focused-row' : ''
}

const rowEventHandlers = {
  onClick: ({ rowData }: { rowData: DeviceRow }) => {
    emit('focus-map', rowData)
  },
}
</script>

<style scoped>
.result-panel {
  padding: 8px 12px 12px;
}

.table-v2-wrap {
  height: 440px;
}

:deep(.el-table-v2__row.is-map-focused-row) {
  background: #f0f9eb !important;
}

:deep(.el-table-v2__header-cell) {
  font-weight: 600;
}

:deep(.el-table-v2__header-cell[title='']) {
  display: flex;
  justify-content: center;
}

.cell-text {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
