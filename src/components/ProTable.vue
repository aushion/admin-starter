<template>
  <div class="pro-table">
    <div v-if="title || $slots.toolbar" class="pro-table__toolbar">
      <div v-if="title" class="pro-table__title">{{ title }}</div>
      <div class="pro-table__toolbar-right">
        <slot name="toolbar" />
      </div>
    </div>

    <el-table
      v-loading="computedLoading"
      :data="tableData"
      :row-key="rowKey"
      @sort-change="onSortChange"
      v-bind="tableProps"
    >
      <el-table-column
        v-for="col in visibleColumns"
        :key="colKey(col)"
        :prop="col.dataIndex"
        :label="col.title"
        :width="col.width"
        :min-width="col.minWidth"
        :fixed="col.fixed"
        :align="col.align ?? 'left'"
        :sortable="col.sortable ? 'custom' : false"
        :show-overflow-tooltip="col.ellipsis ?? col.showOverflowTooltip"
      >
        <template #header="scope">
          <slot
            v-if="col.headerSlot && $slots[col.headerSlot]"
            :name="col.headerSlot"
            v-bind="scope"
          />
          <slot
            v-else-if="col.dataIndex && $slots[`${col.dataIndex}Header`]"
            :name="`${col.dataIndex}Header`"
            v-bind="scope"
          />
          <template v-else>{{ col.title }}</template>
        </template>

        <template #default="scope">
          <slot
            v-if="col.slot && $slots[col.slot]"
            :name="col.slot"
            v-bind="scope"
          />
          <slot
            v-else-if="col.dataIndex && $slots[col.dataIndex]"
            :name="col.dataIndex"
            v-bind="scope"
          />
          <template v-else>
            <el-tag
              v-if="col.valueEnum && (col.valueType === 'tag' || hasStatus(col))"
              :type="mapStatusType(col, scope.row)"
              size="small"
            >
              {{ renderText(scope.row, col) }}
            </el-tag>
            <template v-else>
              {{ renderText(scope.row, col) }}
            </template>
          </template>
        </template>
      </el-table-column>

      <slot />
    </el-table>

    <div v-if="pageable && pageConfig" class="pro-table__pagination">
      <el-pagination
        :current-page="pageConfig.currentPage"
        :page-size="pageConfig.pageSize"
        :total="pageConfig.total"
        :page-sizes="pageConfig.pageSizes"
        :layout="pageConfig.layout"
        @size-change="onSizeChange"
        @current-change="onCurrentChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, watchEffect } from 'vue'

export type ValueEnum =
  | Record<string | number, string | { text?: string; label?: string; status?: string }>
  | Array<{ value: any; text?: string; label?: string; status?: string }>

export type ProColumnValueType = 'text' | 'tag' | 'date' | 'datetime' | 'money' | 'percent'

export interface ProColumn<T = any> {
  title: string
  dataIndex: keyof T & string

  width?: number | string
  minWidth?: number | string
  fixed?: 'left' | 'right'
  align?: 'left' | 'center' | 'right'
  ellipsis?: boolean
  showOverflowTooltip?: boolean

  hideInTable?: boolean

  // 远程排序
  sortable?: boolean

  // 映射与渲染
  valueType?: ProColumnValueType
  valueEnum?: ValueEnum

  // 插槽命名
  slot?: string
  headerSlot?: string
}

export interface ProPagination {
  currentPage: number
  pageSize: number
  total: number
  pageSizes?: number[]
  layout?: string
}

export interface RequestParams {
  currentPage: number
  pageSize: number
  sortField?: string
  sortOrder?: 'ascending' | 'descending' | null
  // 额外参数由外部通过 requestExtra 传入
  [k: string]: any
}

export type RequestFn<T> = (params: RequestParams) => Promise<{
  data: T[]
  total: number
  currentPage?: number
  pageSize?: number
}>

const props = withDefaults(defineProps<{
  title?: string
  columns: ProColumn<any>[]
  rowKey?: string | ((row: any) => string)

  // 受控模式
  dataSource?: any[]
  loading?: boolean
  pagination?: false | Partial<ProPagination>

  // request 模式
  request?: RequestFn<any> | null
  requestExtra?: Record<string, any> // 让外部把搜索参数塞进来（通常来自 ProForm）

  // 透传给 el-table
  tableProps?: Record<string, any>
}>(), {
  title: '',
  rowKey: 'id',
  dataSource: () => [],
  loading: false,
  pagination: () => ({
    currentPage: 1,
    pageSize: 10,
    total: 0,
    pageSizes: [10, 20, 50, 100],
    layout: 'total, sizes, prev, pager, next, jumper'
  }),
  request: null,
  requestExtra: () => ({}),
  tableProps: () => ({})
})

const emit = defineEmits<{
  // 受控模式分页事件（可选）
  (e: 'page-change', page: number): void
  (e: 'page-size-change', size: number): void
  (e: 'sort-change', payload: { prop: string; order: any }): void

  // request 模式生命周期（可选给外部监听）
  (e: 'loaded', payload: { data: any[]; total: number }): void
}>()

const pageable = computed(() => props.pagination !== false && props.pagination !== null)

const defaultPage: ProPagination = {
  currentPage: 1,
  pageSize: 10,
  total: 0,
  pageSizes: [10, 20, 50, 100],
  layout: 'total, sizes, prev, pager, next, jumper'
}

const state = reactive({
  innerLoading: false,
  innerData: [] as any[],
  innerPagination: { ...defaultPage } as ProPagination,
  sorter: { field: null as string | null, order: null as any }
})

const visibleColumns = computed(() => (props.columns ?? []).filter(c => !c.hideInTable))

const tableData = computed(() => (props.request ? state.innerData : (props.dataSource ?? [])))
const computedLoading = computed(() => (props.request ? state.innerLoading : !!props.loading))

const pageConfig = computed<ProPagination | null>(() => {
  if (!pageable.value) return null
  const merged = { ...defaultPage, ...(typeof props.pagination === 'object' ? props.pagination : {}) }
  if (props.request) {
    return { ...merged, ...state.innerPagination }
  }
  return merged
})

function colKey(col: ProColumn<any>) {
  return `${col.dataIndex}-${col.title}`
}

function enumLookup(col: ProColumn<any>, raw: any) {
  const ve = col.valueEnum
  if (!ve) return null
  if (Array.isArray(ve)) {
    return ve.find(x => String(x.value) === String(raw)) ?? null
  }
  return (ve as any)[raw] ?? null
}

function renderText(row: any, col: ProColumn<any>) {
  const raw = row?.[col.dataIndex]
  const ve = col.valueEnum
  if (!ve) return raw

  const found = enumLookup(col, raw)
  if (!found) return raw

  if (typeof found === 'string') return found
  return found.text ?? found.label ?? raw
}

function hasStatus(col: ProColumn<any>) {
  const ve = col.valueEnum
  if (!ve) return false
  if (Array.isArray(ve)) return ve.some(x => !!x.status)
  return Object.keys(ve).some(k => !!(ve as any)[k]?.status)
}

function mapStatusType(col: ProColumn<any>, row: any) {
  const raw = row?.[col.dataIndex]
  const found = enumLookup(col, raw)
  if (!found || typeof found === 'string') return ''
  return found.status ?? ''
}

// ---------- request 模式请求 ----------
async function fetchData() {
  if (!props.request) return
  state.innerLoading = true
  try {
    const p = pageConfig.value ?? defaultPage
    const params: RequestParams = {
      currentPage: p.currentPage,
      pageSize: p.pageSize,
      ...(props.requestExtra ?? {})
    }
    if (state.sorter.field) {
      params.sortField = state.sorter.field
      params.sortOrder = state.sorter.order
    }

    const res = await props.request(params)
    state.innerData = res.data ?? []
    state.innerPagination.total = res.total ?? 0
    if (res.currentPage != null) state.innerPagination.currentPage = res.currentPage
    if (res.pageSize != null) state.innerPagination.pageSize = res.pageSize
    emit('loaded', { data: state.innerData, total: state.innerPagination.total })
  } finally {
    state.innerLoading = false
  }
}

watchEffect(() => {
  // request 模式：当 requestExtra / pagination 初始值变化时，跟随刷新一次
  if (props.request) {
    // 同步初始分页（来自 props.pagination）
    if (typeof props.pagination === 'object') {
      const { currentPage, pageSize } = props.pagination
      if (currentPage != null) state.innerPagination.currentPage = currentPage
      if (pageSize != null) state.innerPagination.pageSize = pageSize
    }
    fetchData()
  }
})

// ---------- 分页/排序 ----------
function onSizeChange(size: number) {
  if (props.request) {
    state.innerPagination.pageSize = size
    state.innerPagination.currentPage = 1
    fetchData()
  } else {
    emit('page-size-change', size)
  }
}

function onCurrentChange(page: number) {
  if (props.request) {
    state.innerPagination.currentPage = page
    fetchData()
  } else {
    emit('page-change', page)
  }
}

function onSortChange(payload: { column: any; prop: string; order: 'ascending' | 'descending' | null }) {
  if (props.request) {
    state.sorter.field = payload.prop
    state.sorter.order = payload.order
    fetchData()
  } else {
    emit('sort-change', payload)
  }
}
</script>

<style scoped>
.pro-table__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.pro-table__title {
  font-size: 14px;
  font-weight: 600;
}
.pro-table__toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.pro-table__pagination {
  margin-top: 10px;
  text-align: right;
}
</style>
