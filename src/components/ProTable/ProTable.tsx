import './style.css'
import { defineComponent, computed, reactive, ref, watchEffect, useSlots, type PropType } from 'vue'
import { ElTable, ElTableColumn, ElPagination, ElTag } from 'element-plus'
import type { TableInstance } from 'element-plus'
import type {
  ProColumn,
  ProPagination,
  RequestFn,
  RequestParams,
  RowSelection,
  ExpandConfig,
  ProTableProps,
} from './types'

/* ---------------- helpers ---------------- */

function getByPath(obj: any, path?: string) {
  if (!obj || !path) return undefined
  if (!path.includes('.')) return obj?.[path]
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj)
}

function colKey(col: ProColumn<any>) {
  return col.key || col.dataIndex || col.title
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

/* ---------------- component ---------------- */

export default defineComponent({
  name: 'ProTable',
  props: {
    title: { type: String, default: '' },
    columns: { type: Array as PropType<ProColumn<any>[]>, required: true },

    rowKey: { type: [String, Function] as PropType<ProTableProps<any>['rowKey']>, default: 'id' },

    dataSource: { type: Array as PropType<any[]>, default: () => [] },
    loading: { type: Boolean, default: false },

    pagination: {
      type: [Boolean, Object] as PropType<false | Partial<ProPagination>>,
      default: () => ({
        currentPage: 1,
        pageSize: 10,
        total: 0,
        pageSizes: [10, 20, 50, 100],
        layout: 'total, sizes, prev, pager, next, jumper',
      }),
    },

    request: { type: Function as unknown as PropType<RequestFn<any> | null>, default: null },
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
      innerPagination: { ...defaultPage } as ProPagination,
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
      // request 模式以 innerPagination 为准
      if (props.request) return { ...merged, ...state.innerPagination }
      return merged
    })

    const visibleColumns = computed(() =>
      (props.columns ?? []).filter((c) => c.hideInTable !== true),
    )
    const dataComputed = computed(() => (props.request ? state.innerData : props.dataSource))
    const loadingComputed = computed(() => (props.request ? state.innerLoading : props.loading))
    const hasSelectionColumn = computed(() =>
      visibleColumns.value.some((c) => c.type === 'selection'),
    )
    const hasExpandColumn = computed(() => visibleColumns.value.some((c) => c.type === 'expand'))

    function getRowKeyValue(row: any): string | number {
      if (props.rowSelection?.getRowKey) return props.rowSelection.getRowKey(row)
      const rk = props.rowKey
      if (typeof rk === 'function') return rk(row)
      return row?.[rk as any]
    }

    async function fetchData(extra?: Record<string, any>) {
      if (!props.request) return

      const seq = ++state.requestSeq
      state.innerLoading = true

      try {
        const p = pageConfig.value ?? defaultPage
        const params: RequestParams = {
          currentPage: p.currentPage,
          pageSize: p.pageSize,
          ...(props.requestExtra ?? {}),
          ...(extra ?? {}),
        }

        if (state.sorter.field) {
          params.sortField = state.sorter.field
          params.sortOrder = state.sorter.order
        }

        const res = await props.request(params)
        if (seq !== state.requestSeq) return // 防并发覆盖

        state.innerData = res.data ?? []
        state.innerPagination.total = res.total ?? 0
        if (res.currentPage != null) state.innerPagination.currentPage = res.currentPage
        if (res.pageSize != null) state.innerPagination.pageSize = res.pageSize

        emit('loaded', { data: state.innerData, total: state.innerPagination.total })
      } finally {
        if (seq === state.requestSeq) state.innerLoading = false
      }
    }

    // 自动请求：manual=false 时，requestExtra / page / sort 变化自动刷新
    watchEffect(() => {
      if (!props.request) return

      // 初次同步外部 pagination（如果传了 object）
      if (typeof props.pagination === 'object') {
        if (props.pagination.currentPage != null)
          state.innerPagination.currentPage = props.pagination.currentPage
        if (props.pagination.pageSize != null)
          state.innerPagination.pageSize = props.pagination.pageSize
      }

      if (props.manual) return

      // 让 requestExtra 成为依赖
      props.requestExtra && JSON.stringify(props.requestExtra)
      fetchData()
    })

    /* ---------- public methods ---------- */

    async function reload(extra?: Record<string, any>) {
      await fetchData(extra)
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
      } else {
        emit('page-change', page)
      }
    }

    function setPageSize(size: number) {
      if (props.request) {
        state.innerPagination.pageSize = size
        state.innerPagination.currentPage = 1
        fetchData()
      } else {
        emit('page-size-change', size)
      }
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

    /* ---------- handlers ---------- */

    function onSortChange(payload: { prop: string; order: 'ascending' | 'descending' | null }) {
      if (props.request) {
        state.sorter.field = payload.prop
        state.sorter.order = payload.order
        fetchData()
      } else {
        emit('sort-change', payload)
      }
    }

    function onSelectionChange(rows: any[]) {
      const keys = rows.map(getRowKeyValue)
      state.innerSelectedKeys = keys
      emit('update:selectedRowKeys', keys)
      emit('selection-change', { keys, rows })
      props.rowSelection?.onChange?.(keys, rows)
    }

    /* ---------- JSX ProCol (recursive) ---------- */

    const ProCol = (pc: { col: ProColumn<any> }) => {
      const col = pc.col
      const colType = col.type
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
        type: colType,
        prop: isLeaf && !colType ? col.dataIndex : undefined,
        label: col.title,
        width: col.width,
        minWidth: col.minWidth,
        fixed: col.fixed,
        align: col.align ?? 'left',
        sortable: isLeaf && col.sortable && col.dataIndex && !colType ? 'custom' : false,
        showOverflowTooltip: col.ellipsis ?? col.showOverflowTooltip,
      }

      if (colType === 'selection') {
        return (
          <ElTableColumn
            type="selection"
            width={col.width ?? props.rowSelection?.columnWidth ?? 46}
            fixed={(col.fixed ?? props.rowSelection?.fixed) as any}
            selectable={(col.selectable ?? props.rowSelection?.selectable) as any}
            reserveSelection={col.reserveSelection ?? props.rowSelection?.reserveSelection ?? true}
          />
        )
      }

      if (colType === 'index') {
        return (
          <ElTableColumn
            type="index"
            label={col.title}
            width={col.width}
            minWidth={col.minWidth}
            fixed={col.fixed}
            align={col.align ?? 'center'}
            index={col.index as any}
            showOverflowTooltip={col.ellipsis ?? col.showOverflowTooltip}
          />
        )
      }

      if (colType === 'expand') {
        const renderExpand = (scope: any) => {
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
          if (slots.expand) return slots.expand(scope)
          return null
        }

        return (
          <ElTableColumn
            type="expand"
            width={col.width ?? props.expand?.width ?? 46}
            fixed={(col.fixed ?? props.expand?.fixed) as any}
          >
            {{
              default: (scope: any) => renderExpand(scope),
            }}
          </ElTableColumn>
        )
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

              // 1) render（React风格）优先
              if (typeof col.render === 'function') {
                const cellValue = col.dataIndex ? getByPath(scope.row, col.dataIndex) : undefined
                return col.render({
                  row: scope.row,
                  column: scope.column,
                  $index: scope.$index,
                  cellValue,
                })
              }

              // 2) slot（Vue风格）
              const slotFn = cellSlotName && (slots as any)[cellSlotName]
              if (slotFn) return slotFn(scope)

              // 3) valueEnum/tag
              const text = renderText(scope.row, col)
              const shouldTag = !!col.valueEnum && (col.valueType === 'tag' || hasStatus(col))
              if (shouldTag) {
                return (
                  <ElTag size="small" type={mapStatusType(col, scope.row) as any}>
                    {String(text ?? '')}
                  </ElTag>
                )
              }

              // 4) default
              return String(text ?? '')
            },
          }}
        </ElTableColumn>
      )
    }

    /* ---------- render ---------- */

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
          v-loading={loadingComputed.value as any}
          {...props.tableProps}
          on-sort-change={onSortChange as any}
          on-selection-change={onSelectionChange as any}
        >
          {/* selection */}
          {props.rowSelection && !hasSelectionColumn.value && (
            <ElTableColumn
              type="selection"
              width={props.rowSelection.columnWidth ?? 46}
              fixed={props.rowSelection.fixed as any}
              selectable={props.rowSelection.selectable as any}
              reserveSelection={props.rowSelection.reserveSelection ?? true}
            />
          )}

          {/* expand */}
          {props.expand && !hasExpandColumn.value && (
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

          {/* columns */}
          {visibleColumns.value.map((c) => (
            <ProCol key={colKey(c)} col={c} />
          ))}

          {/* extra */}
          {slots.default?.()}
        </ElTable>

        {/* pagination */}
        {pageable.value && pageConfig.value && (
          <div class="pro-table__pagination">
            <ElPagination
              currentPage={pageConfig.value.currentPage}
              pageSize={pageConfig.value.pageSize}
              total={pageConfig.value.total}
              pageSizes={pageConfig.value.pageSizes}
              layout={pageConfig.value.layout}
              on-size-change={setPageSize}
              on-current-change={setPage}
            />
          </div>
        )}
      </div>
    )
  },
})
