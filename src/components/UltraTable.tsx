import { defineComponent, computed, reactive, ref, useSlots } from 'vue'
import type { PropType, Slots } from 'vue'
import { ElTable, ElTableColumn, ElPagination, ElTag } from 'element-plus'
import type { TableInstance } from 'element-plus'

export type ValueEnum =
  | Record<string | number, string | { text?: string; label?: string; status?: string }>
  | Array<{ value: any; text?: string; label?: string; status?: string }>

export type ProColumnValueType = 'text' | 'tag' | 'date' | 'datetime' | 'money' | 'percent'

export interface ProColumn<T = any> {
  title: string
  dataIndex?: keyof T & string
  key?: string

  width?: number | string
  minWidth?: number | string
  fixed?: 'left' | 'right'
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
  ellipsis?: boolean
  showOverflowTooltip?: boolean

  hideInTable?: boolean

  valueType?: ProColumnValueType
  valueEnum?: ValueEnum

  slot?: string
  headerSlot?: string

  render?: (scope: { row: T; column: any; $index: number; cellValue: any }) => any
  headerRender?: (ctx: { column: ProColumn<T> }) => any

  children?: ProColumn<T>[]
}

export interface ProPagination {
  currentPage: number
  pageSize: number
  total: number
  pageSizes: number[]
  layout: string
}

export interface RequestParams {
  currentPage: number
  pageSize: number
  sortField?: string
  sortOrder?: 'ascending' | 'descending' | null
  [k: string]: any
}

export type RequestFn<T> = (params: RequestParams) => Promise<{
  data: T[]
  total: number
  currentPage?: number
  pageSize?: number
}>

export interface RowSelection<T = any> {
  selectedRowKeys?: Array<string | number>
  onChange?: (keys: Array<string | number>, rows: T[]) => void
  fixed?: 'left' | 'right'
  columnWidth?: number
  reserveSelection?: boolean
  selectable?: (row: T, index: number) => boolean
  getRowKey?: (row: T) => string | number
}

export interface ExpandConfig {
  width?: number
  fixed?: 'left' | 'right'
}

export interface ProTableProps<T = any> {
  title?: string
  columns: ProColumn<T>[]

  rowKey?: string | ((row: T) => string | number)

  dataSource?: T[]
  loading?: boolean

  pagination?: false | Partial<ProPagination>

  request?: RequestFn<T> | null
  requestExtra?: Record<string, any>
  manual?: boolean

  rowSelection?: RowSelection<T> | null
  expand?: ExpandConfig | null

  tableProps?: Record<string, any>
}

/* ---------- helpers ---------- */

function getByPath(obj: any, path?: string) {
  if (!obj || !path) return undefined
  if (!path.includes('.')) return obj?.[path]
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj)
}

function enumLookup(col: ProColumn<any>, raw: any) {
  const ve = col.valueEnum
  if (!ve) return null
  if (Array.isArray(ve)) return ve.find((x) => String(x.value) === String(raw)) ?? null
  return (ve as any)[raw] ?? null
}

function hasStatus(col: ProColumn<any>) {
  const ve = col.valueEnum
  if (!ve) return false
  if (Array.isArray(ve)) return ve.some((x) => !!x.status)
  return Object.keys(ve).some((k) => !!(ve as any)[k]?.status)
}

function mapStatusType(col: ProColumn<any>, row: any) {
  const raw = col.dataIndex ? getByPath(row, col.dataIndex) : undefined
  const found = enumLookup(col, raw)
  if (!found || typeof found === 'string') return ''
  return found.status ?? ''
}

function renderText(row: any, col: ProColumn<any>) {
  const raw = col.dataIndex ? getByPath(row, col.dataIndex) : undefined
  const ve = col.valueEnum
  if (!ve) return raw
  const found = enumLookup(col, raw)
  if (!found) return raw
  if (typeof found === 'string') return found
  return found.text ?? found.label ?? raw
}

function colKey(col: ProColumn<any>) {
  return col.key || col.dataIndex || col.title
}

/* ---------- component ---------- */

export default defineComponent({
  name: 'ProTable',
  props: {
    title: { type: String, default: '' },
    columns: { type: Array as PropType<ProColumn<any>[]>, required: true },

    rowKey: {
      type: [String, Function] as PropType<string | ((row: any) => string | number)>,
      default: 'id',
    },

    dataSource: { type: Array as PropType<any[]>, default: () => [] },
    loading: { type: Boolean, default: false },
    pagination: {
      type: [Boolean, Object] as PropType<false | Partial<ProPagination>>,
      default: () => ({}),
    },

    request: { type: Function as PropType<RequestFn<any> | null>, default: null },
    requestExtra: { type: Object as PropType<Record<string, any>>, default: () => ({}) },
    manual: { type: Boolean, default: false },

    rowSelection: { type: Object as PropType<RowSelection<any> | null>, default: null },
    expand: { type: Object as PropType<ExpandConfig | null>, default: null },

    tableProps: { type: Object as PropType<Record<string, any>>, default: () => ({}) },
  },
  emits: [
    'page-change',
    'page-size-change',
    'sort-change',
    'update:selectedRowKeys',
    'selection-change',
    'loaded',
  ],
  setup(props, { emit, expose }) {
    const slots = useSlots()
    const tableRef = ref<TableInstance>()

    const defaultPage: ProPagination = {
      currentPage: 1,
      pageSize: 10,
      total: 0,
      pageSizes: [10, 20, 50, 100],
      layout: 'total, sizes, prev, pager, next, jumper',
    }

    const state = reactive({
      innerLoading: false,
      innerData: [] as any[],
      innerPagination: { ...defaultPage },
      sorter: { field: null as string | null, order: null as any },
      innerSelectedKeys: [] as Array<string | number>,
      requestSeq: 0,
    })

    const pageable = computed(() => props.pagination !== false && props.pagination !== null)

    const pageConfig = computed<ProPagination | null>(() => {
      if (!pageable.value) return null
      const merged = {
        ...defaultPage,
        ...(typeof props.pagination === 'object' ? props.pagination : {}),
      }
      if (props.request) return { ...merged, ...state.innerPagination }
      return merged
    })

    const dataComputed = computed(() => (props.request ? state.innerData : props.dataSource))
    const loadingComputed = computed(() => (props.request ? state.innerLoading : props.loading))
    const visibleColumns = computed(() =>
      (props.columns ?? []).filter((c) => c.hideInTable !== true),
    )

    function getRowKeyValue(row: any) {
      if (props.rowSelection?.getRowKey) return props.rowSelection.getRowKey(row)
      const rk = props.rowKey
      if (typeof rk === 'function') return rk(row)
      return row?.[rk]
    }

    async function fetchData() {
      if (!props.request) return
      const seq = ++state.requestSeq
      state.innerLoading = true
      try {
        const p = pageConfig.value ?? defaultPage
        const params: RequestParams = {
          currentPage: p.currentPage,
          pageSize: p.pageSize,
          ...(props.requestExtra ?? {}),
        }
        if (state.sorter.field) {
          params.sortField = state.sorter.field
          params.sortOrder = state.sorter.order
        }
        const res = await props.request(params)
        if (seq !== state.requestSeq) return
        state.innerData = res.data ?? []
        state.innerPagination.total = res.total ?? 0
        if (res.currentPage != null) state.innerPagination.currentPage = res.currentPage
        if (res.pageSize != null) state.innerPagination.pageSize = res.pageSize
        emit('loaded', { data: state.innerData, total: state.innerPagination.total })
      } finally {
        if (seq === state.requestSeq) state.innerLoading = false
      }
    }

    // 自动请求（manual = false）
    if (props.request && !props.manual) {
      // 简化：你也可以加 watchEffect(JSON.stringify(requestExtra))，和你现有 .vue 版本一致
      fetchData()
    }

    function reload() {
      return fetchData()
    }
    function reset() {
      state.sorter.field = null
      state.sorter.order = null
      if (props.request) {
        state.innerPagination.currentPage = 1
        fetchData()
      } else {
        emit('sort-change', { prop: '', order: null })
        emit('page-change', 1)
      }
    }

    function setPage(page: number) {
      if (props.request) {
        state.innerPagination.currentPage = page
        fetchData()
      } else emit('page-change', page)
    }

    function setPageSize(size: number) {
      if (props.request) {
        state.innerPagination.pageSize = size
        state.innerPagination.currentPage = 1
        fetchData()
      } else emit('page-size-change', size)
    }

    function onSortChange(payload: any) {
      if (props.request) {
        state.sorter.field = payload.prop
        state.sorter.order = payload.order
        fetchData()
      } else emit('sort-change', payload)
    }

    function onSelectionChange(rows: any[]) {
      if (!props.rowSelection) return
      const keys = rows.map(getRowKeyValue)
      state.innerSelectedKeys = keys
      emit('update:selectedRowKeys', keys)
      emit('selection-change', { keys, rows })
      props.rowSelection.onChange?.(keys, rows)
    }

    function clearSelection() {
      tableRef.value?.clearSelection?.()
      state.innerSelectedKeys = []
      emit('update:selectedRowKeys', [])
      emit('selection-change', { keys: [], rows: [] })
      props.rowSelection?.onChange?.([], [])
    }

    function getSelectedKeys() {
      return [...state.innerSelectedKeys]
    }

    expose({
      reload,
      reset,
      setPage,
      setPageSize,
      clearSelection,
      getSelectedKeys,
      tableRef,
      state,
    })

    // JSX ProCol（闭包引用 helpers + slots）
    const ProCol = (pc: { col: ProColumn<any> }) => {
      const col = pc.col
      const hasChildren = Array.isArray(col.children) && col.children.length > 0
      const isLeaf = !hasChildren

      const headerSlotName = col.headerSlot || (col.dataIndex ? `${col.dataIndex}Header` : '')
      const cellSlotName = col.slot || col.dataIndex || ''

      const Header = (scope: any) => {
        if (typeof col.headerRender === 'function') return col.headerRender({ column: col })
        const fn = headerSlotName && (slots as any)[headerSlotName]
        return fn ? fn(scope) : col.title
      }

      const columnProps: any = {
        prop: isLeaf ? col.dataIndex : undefined,
        label: col.title,
        width: col.width,
        minWidth: col.minWidth,
        fixed: col.fixed,
        align: col.align ?? 'left',
        sortable: isLeaf && col.sortable && col.dataIndex ? 'custom' : false,
        showOverflowTooltip: col.ellipsis ?? col.showOverflowTooltip,
      }

      if (hasChildren) {
        return (
          <ElTableColumn {...columnProps}>
            {{
              header: (s: any) => <>{Header(s)}</>,
              default: () =>
                col.children!.map((child) => <ProCol key={colKey(child)} col={child} />),
            }}
          </ElTableColumn>
        )
      }

      return (
        <ElTableColumn {...columnProps}>
          {{
            header: (s: any) => <>{Header(s)}</>,
            default: (scope: any) => {
              if (!scope?.row) return null

              if (typeof col.render === 'function') {
                const cellValue = col.dataIndex ? getByPath(scope.row, col.dataIndex) : undefined
                return col.render({
                  row: scope.row,
                  column: scope.column,
                  $index: scope.$index,
                  cellValue,
                })
              }

              const slotFn = cellSlotName && (slots as any)[cellSlotName]
              if (slotFn) return slotFn(scope)

              const text = renderText(scope.row, col)
              const shouldTag = !!col.valueEnum && (col.valueType === 'tag' || hasStatus(col))
              if (shouldTag) {
                return (
                  <ElTag size="small" type={mapStatusType(col, scope.row) as any}>
                    {String(text ?? '')}
                  </ElTag>
                )
              }
              return String(text ?? '')
            },
          }}
        </ElTableColumn>
      )
    }

    return () => (
      <div class="pro-table">
        {(props.title || slots.toolbar) && (
          <div class="pro-table__toolbar">
            {props.title && <div class="pro-table__title">{props.title}</div>}
            <div class="pro-table__toolbar-right">
              {slots.toolbar?.({
                reload,
                reset,
                loading: loadingComputed.value,
                selectedKeys: getSelectedKeys(),
                clearSelection,
              })}
            </div>
          </div>
        )}

        <ElTable
          ref={tableRef as any}
          data={dataComputed.value}
          rowKey={props.rowKey as any}
          {...props.tableProps}
          v-loading={loadingComputed.value as any}
          onSortChange={onSortChange}
          onSelectionChange={onSelectionChange}
        >
          {props.rowSelection && (
            <ElTableColumn
              type="selection"
              width={props.rowSelection.columnWidth ?? 46}
              fixed={props.rowSelection.fixed as any}
              selectable={props.rowSelection.selectable as any}
              reserveSelection={props.rowSelection.reserveSelection ?? true}
            />
          )}

          {props.expand && (
            <ElTableColumn
              type="expand"
              width={props.expand.width ?? 46}
              fixed={props.expand.fixed as any}
            >
              {{
                default: (scope: any) => slots.expand?.(scope),
              }}
            </ElTableColumn>
          )}

          {visibleColumns.value.map((c) => (
            <ProCol key={colKey(c)} col={c} />
          ))}

          {slots.default?.()}
        </ElTable>

        {pageable.value && pageConfig.value && (
          <div class="pro-table__pagination">
            <ElPagination
              currentPage={pageConfig.value.currentPage}
              pageSize={pageConfig.value.pageSize}
              total={pageConfig.value.total}
              pageSizes={pageConfig.value.pageSizes}
              layout={pageConfig.value.layout}
              onSizeChange={setPageSize}
              onCurrentChange={setPage}
            />
          </div>
        )}
      </div>
    )
  },
})
