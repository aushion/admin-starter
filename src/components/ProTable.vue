<template>
  <div class="pro-table">
    <!-- Toolbar -->
    <div v-if="title || $slots.toolbar" class="pro-table__toolbar">
      <div v-if="title" class="pro-table__title">{{ title }}</div>
      <div class="pro-table__toolbar-right">
        <slot
          name="toolbar"
          :reload="reload"
          :reset="reset"
          :loading="loadingComputed"
          :selected-keys="getSelectedKeys()"
          :clear-selection="clearSelection"
        />
      </div>
    </div>

    <el-table
      ref="tableRef"
      v-loading="loadingComputed"
      :data="dataComputed"
      :row-key="rowKey"
      v-bind="tableProps"
      @sort-change="onSortChange"
      @selection-change="onSelectionChange"
    >
      <!-- Selection -->
      <el-table-column
        v-if="rowSelection"
        type="selection"
        :width="rowSelection.columnWidth ?? 46"
        :fixed="rowSelection.fixed"
        :selectable="rowSelection.selectable"
        :reserve-selection="rowSelection.reserveSelection ?? true"
      />

      <!-- Expand -->
      <el-table-column
        v-if="expand"
        type="expand"
        :width="expand.width ?? 46"
        :fixed="expand.fixed"
      >
        <template #default="scope">
          <slot name="expand" v-bind="scope" />
        </template>
      </el-table-column>

      <!-- Columns (recursive) -->
      <template v-for="col in visibleColumns" :key="colKey(col)">
        <ProCol
          :col="col"
          :col-key="colKey"
          :slots="$slots"
          :render-text="renderText"
          :has-status="hasStatus"
          :map-status-type="mapStatusType"
        />
      </template>

      <!-- extra columns -->
      <slot />
    </el-table>

    <!-- Pagination -->
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

<script setup lang="tsx">
import {
  computed,
  defineComponent,
  reactive,
  ref,
  watch,
  watchEffect,
} from "vue";
import { ElTableColumn, ElTag } from "element-plus";
import type { TableInstance } from "element-plus";

/* ===================== Types ===================== */

export type ValueEnum =
  | Record<
      string | number,
      string | { text?: string; label?: string; status?: string }
    >
  | Array<{ value: any; text?: string; label?: string; status?: string }>;

export type ProColumnValueType =
  | "text"
  | "tag"
  | "date"
  | "datetime"
  | "money"
  | "percent";

export interface ProColumn<T = any> {
  title: string;

  /** 叶子列字段（用于 prop/排序/默认取值） */
  dataIndex?: keyof T & string;

  /** 没有 dataIndex 的列（比如 Actions）请提供 key，保证稳定渲染 */
  key?: string;

  width?: number | string;
  minWidth?: number | string;
  fixed?: "left" | "right";
  align?: "left" | "center" | "right";
  sortable?: boolean;
  ellipsis?: boolean;
  showOverflowTooltip?: boolean;

  hideInTable?: boolean;

  valueType?: ProColumnValueType;
  valueEnum?: ValueEnum;

  // slot names（Vue 风格）
  slot?: string;
  headerSlot?: string;

  // React 风格（JSX）
  render?: (scope: {
    row: T;
    column: any;
    $index: number;
    cellValue: any;
  }) => any;
  headerRender?: (ctx: { column: ProColumn<T> }) => any;

  // multi-level header
  children?: ProColumn<T>[];
}

export interface ProPagination {
  currentPage: number;
  pageSize: number;
  total: number;
  pageSizes: number[];
  layout: string;
}

export interface RequestParams {
  currentPage: number;
  pageSize: number;
  sortField?: string;
  sortOrder?: "ascending" | "descending" | null;
  [k: string]: any;
}

export type RequestFn<T> = (params: RequestParams) => Promise<{
  data: T[];
  total: number;
  currentPage?: number;
  pageSize?: number;
}>;

export interface RowSelection<T = any> {
  selectedRowKeys?: Array<string | number>;
  onChange?: (keys: Array<string | number>, rows: T[]) => void;

  fixed?: "left" | "right";
  columnWidth?: number;
  reserveSelection?: boolean;
  selectable?: (row: T, index: number) => boolean;

  // rowKey override
  getRowKey?: (row: T) => string | number;
}

export interface ExpandConfig {
  width?: number;
  fixed?: "left" | "right";
}

/* ===================== Props / Emits ===================== */

const props = withDefaults(
  defineProps<{
    title?: string;
    columns: ProColumn<any>[];

    rowKey?: string | ((row: any) => string | number);

    // controlled mode
    dataSource?: any[];
    loading?: boolean;
    pagination?: false | Partial<ProPagination>;

    // request mode
    request?: RequestFn<any> | null;
    requestExtra?: Record<string, any>;

    // request control
    manual?: boolean;

    // selection/expand
    rowSelection?: RowSelection<any> | null;
    expand?: ExpandConfig | null;

    // el-table passthrough
    tableProps?: Record<string, any>;
  }>(),
  {
    title: "",
    rowKey: "id",
    dataSource: () => [],
    loading: false,
    pagination: () => ({
      currentPage: 1,
      pageSize: 10,
      total: 0,
      pageSizes: [10, 20, 50, 100],
      layout: "total, sizes, prev, pager, next, jumper",
    }),
    request: null,
    requestExtra: () => ({}),
    manual: false,
    rowSelection: null,
    expand: null,
    tableProps: () => ({}),
  },
);

const emit = defineEmits<{
  // controlled mode
  (e: "page-change", page: number): void;
  (e: "page-size-change", size: number): void;
  (e: "sort-change", payload: { prop: string; order: any }): void;

  // selection
  (e: "update:selectedRowKeys", keys: Array<string | number>): void;
  (
    e: "selection-change",
    payload: { keys: Array<string | number>; rows: any[] },
  ): void;

  // request lifecycle
  (e: "loaded", payload: { data: any[]; total: number }): void;
}>();

/* ===================== State ===================== */

const defaultPage: ProPagination = {
  currentPage: 1,
  pageSize: 10,
  total: 0,
  pageSizes: [10, 20, 50, 100],
  layout: "total, sizes, prev, pager, next, jumper",
};

const state = reactive({
  innerLoading: false,
  innerData: [] as any[],
  innerPagination: { ...defaultPage } as ProPagination,
  sorter: { field: null as string | null, order: null as any },
  innerSelectedKeys: [] as Array<string | number>,
  requestSeq: 0,
});

const tableRef = ref<TableInstance>();

const pageable = computed(
  () => props.pagination !== false && props.pagination !== null,
);

const pageConfig = computed<ProPagination | null>(() => {
  if (!pageable.value) return null;

  const merged = {
    ...defaultPage,
    ...(typeof props.pagination === "object" ? props.pagination : {}),
  };

  // request mode: internal pagination is source of truth
  if (props.request) return { ...merged, ...state.innerPagination };

  // controlled mode
  return merged;
});

const visibleColumns = computed(() =>
  (props.columns ?? []).filter((c) => c.hideInTable !== true),
);

const dataComputed = computed(() =>
  props.request ? state.innerData : (props.dataSource ?? []),
);
const loadingComputed = computed(() =>
  props.request ? state.innerLoading : !!props.loading,
);

/* ===================== Helpers ===================== */

function colKey(col: ProColumn<any>) {
  return col.key || col.dataIndex || col.title;
}

function enumLookup(col: ProColumn<any>, raw: any) {
  const ve = col.valueEnum;
  if (!ve) return null;
  if (Array.isArray(ve))
    return ve.find((x) => String(x.value) === String(raw)) ?? null;
  return (ve as any)[raw] ?? null;
}

function hasStatus(col: ProColumn<any>) {
  const ve = col.valueEnum;
  if (!ve) return false;
  if (Array.isArray(ve)) return ve.some((x) => !!x.status);
  return Object.keys(ve).some((k) => !!(ve as any)[k]?.status);
}

function mapStatusType(col: ProColumn<any>, row: any) {
  const raw = col.dataIndex ? row?.[col.dataIndex] : undefined;
  const found = enumLookup(col, raw);
  if (!found || typeof found === "string") return "";
  return found.status ?? "";
}

function renderText(row: any, col: ProColumn<any>) {
  const raw = col.dataIndex ? row?.[col.dataIndex] : undefined;
  const ve = col.valueEnum;
  if (!ve) return raw;

  const found = enumLookup(col, raw);
  if (!found) return raw;
  if (typeof found === "string") return found;
  return found.text ?? found.label ?? raw;
}

function getRowKeyValue(row: any): string | number {
  if (props.rowSelection?.getRowKey) return props.rowSelection.getRowKey(row);

  const rk = props.rowKey;
  if (typeof rk === "function") return rk(row);
  return row?.[rk];
}

/* ===================== Request Mode ===================== */

async function fetchData() {
  if (!props.request) return;

  const seq = ++state.requestSeq;
  state.innerLoading = true;

  try {
    const p = pageConfig.value ?? defaultPage;
    const params: RequestParams = {
      currentPage: p.currentPage,
      pageSize: p.pageSize,
      ...(props.requestExtra ?? {}),
    };
    if (state.sorter.field) {
      params.sortField = state.sorter.field;
      params.sortOrder = state.sorter.order;
    }

    const res = await props.request(params);

    // 防并发覆盖：只接收最新请求
    if (seq !== state.requestSeq) return;

    state.innerData = res.data ?? [];
    state.innerPagination.total = res.total ?? 0;
    if (res.currentPage != null)
      state.innerPagination.currentPage = res.currentPage;
    if (res.pageSize != null) state.innerPagination.pageSize = res.pageSize;

    emit("loaded", {
      data: state.innerData,
      total: state.innerPagination.total,
    });
  } finally {
    // 同样避免老请求结束时把 loading 关掉
    if (seq === state.requestSeq) state.innerLoading = false;
  }
}

watchEffect(() => {
  if (!props.request) return;

  // sync initial page from props.pagination
  if (typeof props.pagination === "object") {
    const { currentPage, pageSize } = props.pagination;
    if (currentPage != null) state.innerPagination.currentPage = currentPage;
    if (pageSize != null) state.innerPagination.pageSize = pageSize;
  }

  if (!props.manual) {
    // 让 requestExtra 成为依赖（变更自动刷新）
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    props.requestExtra && JSON.stringify(props.requestExtra);
    fetchData();
  }
});

/* ===================== Public Methods ===================== */

async function reload(extra?: Record<string, any>) {
  if (!props.request) return;
  if (extra && Object.keys(extra).length) {
    // 临时 extra 覆盖（不污染 requestExtra）
    const p = pageConfig.value ?? defaultPage;
    const params: RequestParams = {
      currentPage: p.currentPage,
      pageSize: p.pageSize,
      ...(props.requestExtra ?? {}),
      ...extra,
    };
    if (state.sorter.field) {
      params.sortField = state.sorter.field;
      params.sortOrder = state.sorter.order;
    }

    const seq = ++state.requestSeq;
    state.innerLoading = true;
    try {
      const res = await props.request(params);
      if (seq !== state.requestSeq) return;
      state.innerData = res.data ?? [];
      state.innerPagination.total = res.total ?? 0;
      if (res.currentPage != null)
        state.innerPagination.currentPage = res.currentPage;
      if (res.pageSize != null) state.innerPagination.pageSize = res.pageSize;
      emit("loaded", {
        data: state.innerData,
        total: state.innerPagination.total,
      });
    } finally {
      if (seq === state.requestSeq) state.innerLoading = false;
    }
    return;
  }

  await fetchData();
}

function reset() {
  // reset sort + page
  state.sorter.field = null;
  state.sorter.order = null;
  if (props.request) {
    state.innerPagination.currentPage = 1;
    fetchData();
  } else {
    emit("sort-change", { prop: "", order: null });
    emit("page-change", 1);
  }
}

function setPage(page: number) {
  if (props.request) {
    state.innerPagination.currentPage = page;
    fetchData();
  } else {
    emit("page-change", page);
  }
}

function setPageSize(size: number) {
  if (props.request) {
    state.innerPagination.pageSize = size;
    state.innerPagination.currentPage = 1;
    fetchData();
  } else {
    emit("page-size-change", size);
  }
}

function clearSelection() {
  tableRef.value?.clearSelection?.();
  state.innerSelectedKeys = [];
  emit("update:selectedRowKeys", []);
  emit("selection-change", { keys: [], rows: [] });
  props.rowSelection?.onChange?.([], []);
}

function getSelectedKeys() {
  return [...state.innerSelectedKeys];
}

defineExpose({
  reload,
  reset,
  setPage,
  setPageSize,
  clearSelection,
  getSelectedKeys,
  tableRef,
  state,
});

/* ===================== Pagination & Sort ===================== */

function onSizeChange(size: number) {
  setPageSize(size);
}

function onCurrentChange(page: number) {
  setPage(page);
}

function onSortChange(payload: {
  column: any;
  prop: string;
  order: "ascending" | "descending" | null;
}) {
  if (props.request) {
    state.sorter.field = payload.prop;
    state.sorter.order = payload.order;
    fetchData();
  } else {
    emit("sort-change", payload);
  }
}

/* ===================== Selection ===================== */

watch(
  () => props.rowSelection?.selectedRowKeys,
  (keys) => {
    if (!props.rowSelection) return;
    if (Array.isArray(keys)) state.innerSelectedKeys = [...keys];
  },
  { immediate: true, deep: true },
);

function onSelectionChange(rows: any[]) {
  if (!props.rowSelection) return;
  const keys = rows.map(getRowKeyValue);
  state.innerSelectedKeys = keys;
  emit("update:selectedRowKeys", keys);
  emit("selection-change", { keys, rows });
  props.rowSelection.onChange?.(keys, rows);
}

/* ===================== Recursive Column Renderer ===================== */

import { useSlots, type Slots } from "vue";

// 你原来 ProCol 的 props 结构不变（继续兼容你现有传参）
const ProCol = defineComponent({
  name: "ProCol",
  props: {
    col: { type: Object as () => ProColumn<any>, required: true },
    colKey: {
      type: Function as unknown as () => (c: ProColumn<any>) => string,
      required: true,
    },

    // 仍然兼容你现在的“slots 透传”方式
    // 但如果外部没传，就回退到 useSlots()
    slots: { type: Object as any, required: false },

    renderText: { type: Function as any, required: true },
    hasStatus: { type: Function as any, required: true },
    mapStatusType: { type: Function as any, required: true },
  },
  setup(p) {
    const innerSlots = useSlots();
    const slots = computed(() => (p.slots ?? innerSlots) as Slots);

    return () => {
      const col = p.col;
      const hasChildren =
        Array.isArray(col.children) && col.children.length > 0;

      const headerSlotName =
        col.headerSlot || (col.dataIndex ? `${col.dataIndex}Header` : "");

      const cellSlotName = col.slot || col.dataIndex || "";

      // ✅ 父列（有 children）通常不应该传 prop/sortable，避免 el-table-column 行为怪
      const isLeaf = !hasChildren;

      const columnProps: any = {
        // 只有叶子列才给 prop
        prop: isLeaf ? col.dataIndex : undefined,
        label: col.title,
        width: col.width,
        minWidth: col.minWidth,
        fixed: col.fixed,
        align: col.align ?? "left",
        sortable: isLeaf && col.sortable && col.dataIndex ? "custom" : false,
        showOverflowTooltip: col.ellipsis ?? col.showOverflowTooltip,
      };

      const Header = (scope: any) => {
        // React 风格 headerRender
        if (typeof col.headerRender === "function") {
          return col.headerRender({ column: col });
        }
        // Vue 风格 headerSlot
        const fn = headerSlotName && (slots.value as any)[headerSlotName];
        return fn ? fn(scope) : col.title;
      };

      // ✅ 多级表头：子列作为 ElTableColumn children（default: () => columns）
      if (hasChildren) {
        return (
          <ElTableColumn {...columnProps}>
            {{
              header: (scope: any) => <>{Header(scope)}</>,
              default: () =>
                col.children!.map((child) => (
                  <ProCol
                    key={p.colKey(child)}
                    col={child}
                    colKey={p.colKey}
                    slots={slots.value as any}
                    renderText={p.renderText}
                    hasStatus={p.hasStatus}
                    mapStatusType={p.mapStatusType}
                  />
                )),
            }}
          </ElTableColumn>
        );
      }

      // ✅ 叶子列：default(scope) 渲染 cell
      return (
        <ElTableColumn {...columnProps}>
          {{
            header: (scope: any) => <>{Header(scope)}</>,
            default: (scope: any) => {
              if (!scope?.row) return null;

              // 1) render 优先（React 风格）
              if (typeof col.render === "function") {
                const cellValue = col.dataIndex
                  ? scope.row?.[col.dataIndex]
                  : undefined;
                return col.render({
                  row: scope.row,
                  column: scope.column,
                  $index: scope.$index,
                  cellValue,
                });
              }

              // 2) slot 次之（Vue 风格）
              const slotFn = cellSlotName && (slots.value as any)[cellSlotName];
              if (slotFn) return slotFn(scope);

              // 3) valueEnum/tag
              const rt =
                typeof p.renderText === "function" ? p.renderText : () => "";
              const text = rt(scope.row, col);

              const shouldTag =
                !!col.valueEnum &&
                (col.valueType === "tag" || p.hasStatus(col));

              if (shouldTag) {
                const type = p.mapStatusType(col, scope.row);
                return (
                  <ElTag size="small" type={type as any}>
                    {String(text ?? "")}
                  </ElTag>
                );
              }

              // 4) default
              return String(text ?? "");
            },
          }}
        </ElTableColumn>
      );
    };
  },
});
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
