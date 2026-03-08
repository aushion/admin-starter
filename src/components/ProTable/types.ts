export type ValueEnum =
  | Record<string | number, string | { text?: string; label?: string; status?: string }>
  | Array<{ value: any; text?: string; label?: string; status?: string }>

export type ProColumnValueType = 'text' | 'tag' | 'date' | 'datetime' | 'money' | 'percent'

export interface ProColumn<T = any> {
  title: string

  /** 特殊列类型：selection / index / expand */
  type?: 'selection' | 'index' | 'expand'

  /** 支持 'a.b.c' */
  dataIndex?: keyof T & string
  /** dataIndex 为空时（如 Actions）请提供 key */
  key?: string

  width?: number | string
  minWidth?: number | string
  fixed?: 'left' | 'right'
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
  ellipsis?: boolean
  showOverflowTooltip?: boolean

  hideInTable?: boolean

  /** type=index 时可自定义序号 */
  index?: number | ((index: number) => number | string)

  /** type=selection 时可单列配置选择行为 */
  reserveSelection?: boolean
  selectable?: (row: T, index: number) => boolean

  valueType?: ProColumnValueType
  valueEnum?: ValueEnum

  /** Vue 风格插槽 */
  slot?: string
  headerSlot?: string

  /** React 风格 JSX */
  render?: (scope: { row: T; column: any; $index: number; cellValue: any }) => any
  headerRender?: (ctx: { column: ProColumn<T> }) => any

  /** 多级表头 */
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

  /** 非 request 模式：受控数据 */
  dataSource?: T[]
  loading?: boolean

  pagination?: false | Partial<ProPagination>

  /** request 模式：自管理 data/loading/pagination/sort */
  request?: RequestFn<T> | null
  requestExtra?: Record<string, any>
  manual?: boolean

  rowSelection?: RowSelection<T> | null
  expand?: ExpandConfig | null

  /** el-table 原生 props 透传 */
  tableProps?: Record<string, any>
}
