<template>
  <div class="dashboard-page">
    <QueryPanel
      :active-tab="state.activeTab"
      :basic-model="basicFormModel"
      :advanced-model="advancedFormModel"
      @update:active-tab="onActiveTabChange"
      @update:basic-model="onBasicModelChange"
      @update:advanced-model="onAdvancedModelChange"
      @submit="onQuerySubmit"
      @reset="onQueryReset"
    />

    <section class="right-pane">
      <div class="bridge-panel">
        <div class="bridge-title">Map 通信面板（BroadcastChannel 协议示例）</div>
        <div class="bridge-row">
          <span>Map 状态：</span>
          <el-tag size="small" :type="state.mapReady ? 'success' : 'info'">
            {{ state.mapReady ? 'READY' : 'WAITING' }}
          </el-tag>
          <el-button size="small" @click="simulateMapReady">模拟 MAP_READY</el-button>
          <el-button size="small" @click="simulateMapSelect">模拟 MAP_SELECT</el-button>
        </div>
        <div class="bridge-log">{{ state.lastMapEvent || '等待地图消息...' }}</div>
        <div class="bridge-log">Map 最近同步状态: {{ mapMockState.latestFilters || '-' }}</div>
        <div class="bridge-log">Map 最近定位请求: {{ mapMockState.latestFocus || '-' }}</div>
        <div class="bridge-row">
          <el-badge :value="selectedCount" :hidden="selectedCount === 0">
            <el-button
              size="small"
              type="primary"
              :disabled="selectedCount === 0"
              @click="onFilterSelected"
            >
              筛选
            </el-button>
          </el-badge>
          <el-badge :value="selectedCount" :hidden="selectedCount === 0">
            <el-button
              size="small"
              type="warning"
              :disabled="selectedCount === 0"
              @click="onHighlightSelected"
            >
              高亮
            </el-button>
          </el-badge>
          <el-button size="small" @click="onMapClearSelection">重置</el-button>
        </div>
      </div>

      <TablePane
        :active-tab="state.activeTab"
        :visible-tables="layoutStore.visibleTables"
        :basic-title="state.basicTable.title"
        :basic-columns="state.basicTable.columns"
        :basic-data-source="state.basicTable.rows"
        :basic-loading="state.basicTable.loading"
        :basic-collapsed="state.basicTable.collapsed"
        :basic-selected-keys="state.basicTable.selectedKeys"
        :advanced-title="state.advancedTable.title"
        :advanced-columns="state.advancedTable.columns"
        :advanced-data-source="state.advancedTable.rows"
        :advanced-loading="state.advancedTable.loading"
        :advanced-collapsed="state.advancedTable.collapsed"
        :advanced-selected-keys="state.advancedTable.selectedKeys"
        :stats-title="state.statsTable.title"
        :stats-data-source="state.statsTable.rows"
        :stats-loading="state.statsTable.loading"
        :stats-collapsed="state.statsTable.collapsed"
        :focused-id="state.focusedId"
        @toggle-collapse="onToggleCollapse"
        @toggle-stats-collapse="onToggleStatsCollapse"
        @focus-map="onFocusMap"
        @selection-change="onTableSelectionChange"
      />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, toRaw } from 'vue'
import type { ProColumn } from '@/components/ProTable'
import QueryPanel from './components/QueryPanel.vue'
import TablePane from './components/TablePane.vue'
import { createDualChannel } from '@/shared/channel'
import type { DualMsg, GeoBoundsPayload } from '@/shared/protocol'
import type {
  AdvancedQueryForm,
  BasicQueryForm,
  DeviceRow,
  QueryForm,
  QueryTabKey,
  RowStatus,
  StatsRow,
  TabQueryPayload,
  ZoneCode,
} from './types'
import type { ContextMenuItem } from '@/components/ContextMenu'
import { useDashboardLayoutStore } from '@/store/dashboardLayout'
import { fetchDashboardRows } from '@/services/dashboard'

type TableState = {
  title: string
  columns: ProColumn<DeviceRow>[]
  loading: boolean
  filters: QueryForm
  rows: DeviceRow[]
  collapsed: boolean
  selectedKeys: Array<string | number>
}

type StatsTableState = {
  title: string
  rows: StatsRow[]
  loading: boolean
  collapsed: boolean
}

const layoutStore = useDashboardLayoutStore()

const menuItems: ContextMenuItem[] = [
  { key: 'view', label: '查看', icon: 'i-mdi-eye' },
  { key: 'edit', label: '编辑', icon: 'i-mdi-pencil' },
  { key: 'delete', label: '删除', icon: 'i-mdi-delete', divided: true },
]
// // Composable 方式
// const { open } = useContextMenu()
// open(event, menuItems, context, onSelect)

function createTableState(defaultTitle: string): TableState {
  return {
    title: defaultTitle,
    columns: [],
    loading: false,
    filters: {},
    rows: [],
    collapsed: false,
    selectedKeys: [],
  }
}

const DASHBOARD_QUERY_LIMIT = 500

const basicFormModel = reactive<BasicQueryForm>({
  keyword: '',
  status: undefined,
  zone: undefined,
  owner: '',
  longitudeMin: undefined,
  longitudeMax: undefined,
  latitudeMin: undefined,
  latitudeMax: undefined,
})

const advancedFormModel = reactive<AdvancedQueryForm>({
  keyword: '',
  status: undefined,
  zone: undefined,
  level: undefined,
  source: undefined,
  startedAt: undefined,
  endedAt: undefined,
  longitudeMin: undefined,
  longitudeMax: undefined,
  latitudeMin: undefined,
  latitudeMax: undefined,
})

const ZONE_LABELS: Record<ZoneCode, string> = { north: '北区', south: '南区', west: '西区' }

function buildStatsRows(rows: DeviceRow[]): StatsRow[] {
  const zones: ZoneCode[] = ['north', 'south', 'west']
  return zones.map((zone) => {
    const group = rows.filter((r) => r.zone === zone)
    return {
      id: zone,
      zone,
      zoneLabel: ZONE_LABELS[zone],
      online: group.filter((r) => r.status === 'online').length,
      offline: group.filter((r) => r.status === 'offline').length,
      total: group.length,
      p1: group.filter((r) => r.level === 'P1').length,
      p2: group.filter((r) => r.level === 'P2').length,
      p3: group.filter((r) => r.level === 'P3').length,
    }
  })
}

const state = reactive({
  activeTab: 'basic' as QueryTabKey,
  focusedId: undefined as number | undefined,
  mapReady: false,
  lastMapEvent: '',
  basicTable: createTableState('基础查询结果表'),
  advancedTable: createTableState('扩展筛选结果表'),
  statsTable: {
    title: '分区统计汇总表',
    rows: buildStatsRows([]),
    loading: false,
    collapsed: false,
  } as StatsTableState,
})

const selectedRows = computed<DeviceRow[]>(() => {
  const table = state.activeTab === 'basic' ? state.basicTable : state.advancedTable
  const keySet = new Set(table.selectedKeys.map(String))
  return table.rows.filter((r) => keySet.has(String(r.id)))
})

const selectedCount = computed(() => selectedRows.value.length)

const pageChannel = createDualChannel()
const mapMockChannel = createDualChannel()

const mapMockState = reactive({
  latestFilters: '',
  latestFocus: '',
})

function toChannelSafe<T>(value: T): T {
  const raw = toRaw(value as any)

  if (Array.isArray(raw)) {
    return raw.map((item) => toChannelSafe(item)) as T
  }

  if (raw && typeof raw === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      out[k] = toChannelSafe(v)
    }
    return out as T
  }

  return raw as T
}

function getTableState(tab: QueryTabKey) {
  return tab === 'basic' ? state.basicTable : state.advancedTable
}

function normalizeOptionalNumber(value: unknown): number | undefined {
  if (value === '' || value == null) return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

function normalizeGeoBounds(input: QueryForm) {
  return {
    longitudeMin: normalizeOptionalNumber(input.longitudeMin),
    longitudeMax: normalizeOptionalNumber(input.longitudeMax),
    latitudeMin: normalizeOptionalNumber(input.latitudeMin),
    latitudeMax: normalizeOptionalNumber(input.latitudeMax),
  }
}

function normalizeBasicFilters(input: BasicQueryForm): BasicQueryForm {
  return {
    keyword: (input.keyword || '').trim(),
    status: input.status || undefined,
    zone: input.zone || undefined,
    owner: (input.owner || '').trim(),
    ...normalizeGeoBounds(input),
  }
}

function normalizeAdvancedFilters(input: AdvancedQueryForm): AdvancedQueryForm {
  return {
    keyword: (input.keyword || '').trim(),
    status: input.status || undefined,
    zone: input.zone || undefined,
    level: input.level || undefined,
    source: input.source || undefined,
    startedAt: input.startedAt || undefined,
    endedAt: input.endedAt || undefined,
    ...normalizeGeoBounds(input),
  }
}

function normalizeFiltersByTab(tab: QueryTabKey, value: QueryForm) {
  if (tab === 'basic') return normalizeBasicFilters(value as BasicQueryForm)
  return normalizeAdvancedFilters(value as AdvancedQueryForm)
}

function buildBasicColumns(filters: BasicQueryForm): ProColumn<DeviceRow>[] {
  const keywordTitle = filters.keyword ? `设备名(关键词:${filters.keyword})` : '设备名'
  const ownerTitle = filters.owner ? `负责人(筛选:${filters.owner})` : '负责人'

  return [
    { title: 'ID', dataIndex: 'id', width: 90 },
    { title: keywordTitle, dataIndex: 'name', minWidth: 220 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      valueType: 'tag',
      valueEnum: {
        online: { text: '在线', status: 'success' },
        offline: { text: '离线', status: 'info' },
      },
    },
    {
      title: '区域',
      dataIndex: 'zone',
      width: 110,
      valueEnum: { north: '北区', south: '南区', west: '西区' },
    },
    { title: ownerTitle, dataIndex: 'owner', width: 130 },
    { title: '更新时间', dataIndex: 'updatedAt', width: 190 },
    { title: '操作', key: 'action', width: 120, slot: 'action', align: 'center' },
  ]
}

function buildAdvancedColumns(filters: AdvancedQueryForm): ProColumn<DeviceRow>[] {
  const levelTitle = filters.level ? `优先级(筛选:${filters.level})` : '优先级'
  const sourceTitle = filters.source ? `来源(筛选:${filters.source})` : '来源'

  return [
    { title: 'ID', dataIndex: 'id', width: 90 },
    { title: '设备名', dataIndex: 'name', minWidth: 220 },
    {
      title: levelTitle,
      dataIndex: 'level',
      width: 130,
      valueType: 'tag',
      valueEnum: {
        P1: { text: 'P1', status: 'danger' },
        P2: { text: 'P2', status: 'warning' },
        P3: { text: 'P3', status: 'success' },
      },
    },
    {
      title: sourceTitle,
      dataIndex: 'source',
      width: 130,
      valueEnum: { manual: '手工', api: '接口', import: '导入' },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      valueType: 'tag',
      valueEnum: {
        online: { text: '在线', status: 'success' },
        offline: { text: '离线', status: 'info' },
      },
    },
    { title: '更新时间', dataIndex: 'updatedAt', width: 190 },
    { title: '操作', key: 'action', width: 120, slot: 'action', align: 'center' },
  ]
}

function buildTitle(tab: QueryTabKey, filters: QueryForm) {
  if (tab === 'basic') {
    const f = filters as BasicQueryForm
    return f.keyword ? `基础查询结果表(关键词:${f.keyword})` : '基础查询结果表'
  }
  const f = filters as AdvancedQueryForm
  if (f.level) return `扩展筛选结果表(优先级:${f.level})`
  if (f.source) return `扩展筛选结果表(来源:${f.source})`
  return '扩展筛选结果表'
}

function computeColumnsByTab(tab: QueryTabKey, filters: QueryForm) {
  if (tab === 'basic') return buildBasicColumns(filters as BasicQueryForm)
  return buildAdvancedColumns(filters as AdvancedQueryForm)
}

function syncStateToMap() {
  const basicFilters = toChannelSafe(state.basicTable.filters as Record<string, unknown>)
  const advancedFilters = toChannelSafe(state.advancedTable.filters as Record<string, unknown>)

  const payloadFilters = {
    activeTab: state.activeTab,
    basic: {
      ...basicFilters,
      resultCount: state.basicTable.rows.length,
      collapsed: state.basicTable.collapsed,
      selectedIds: toChannelSafe(state.basicTable.selectedKeys),
    },
    advanced: {
      ...advancedFilters,
      resultCount: state.advancedTable.rows.length,
      collapsed: state.advancedTable.collapsed,
      selectedIds: toChannelSafe(state.advancedTable.selectedKeys),
    },
  }

  pageChannel.send({ type: 'SYNC_STATE', payload: { filters: payloadFilters } })
}

function sendQueryToMap(tab: QueryTabKey, filters: QueryForm, reason: string) {
  pageChannel.send({
    type: 'QUERY',
    payload: {
      requestId: `${Date.now()}-${tab}-${reason}`,
      filters: {
        activeTab: tab,
        ...toChannelSafe(filters as Record<string, unknown>),
      },
    },
  })
}

async function dispatchQuery(tab: QueryTabKey, rawFilters: QueryForm, reason: string) {
  const table = getTableState(tab)
  table.filters = normalizeFiltersByTab(tab, rawFilters)
  table.loading = true
  state.statsTable.loading = true

  state.lastMapEvent = `Page 调度查询: ${reason} (${tab})`

  try {
    const result = await fetchDashboardRows({
      tab,
      filters: table.filters,
      limit: DASHBOARD_QUERY_LIMIT,
    })
    const rows = result.rows
    table.rows = rows
    table.selectedKeys = table.selectedKeys.filter((key) =>
      rows.some((row) => String(row.id) === String(key)),
    )
    table.columns = computeColumnsByTab(tab, table.filters)
    table.title = `${buildTitle(tab, table.filters)}（${rows.length}/${result.total}）`
    table.collapsed = rows.length === 0
    state.statsTable.rows = buildStatsRows(rows)
    state.statsTable.collapsed = rows.length === 0
    sendQueryToMap(tab, table.filters, reason)
  } finally {
    table.loading = false
    state.statsTable.loading = false
    syncStateToMap()
  }
}

function onActiveTabChange(tab: QueryTabKey) {
  state.activeTab = tab
  state.lastMapEvent = `切换查询面板: ${tab}`
}

function onBasicModelChange(value: BasicQueryForm) {
  Object.assign(basicFormModel, value || {})
}

function onAdvancedModelChange(value: AdvancedQueryForm) {
  Object.assign(advancedFormModel, value || {})
}

async function onQuerySubmit(payload: TabQueryPayload) {
  state.activeTab = payload.tab
  await dispatchQuery(payload.tab, payload.values, 'FORM_SUBMIT')
}

async function onQueryReset(payload: TabQueryPayload) {
  state.activeTab = payload.tab
  await dispatchQuery(payload.tab, payload.values, 'FORM_RESET')
}

function onToggleCollapse(payload: { tab: QueryTabKey }) {
  const table = getTableState(payload.tab)
  if (table.rows.length === 0) return
  table.collapsed = !table.collapsed
  syncStateToMap()
}

function onToggleStatsCollapse() {
  if (state.statsTable.rows.length === 0) return
  state.statsTable.collapsed = !state.statsTable.collapsed
}

function onFocusMap(payload: { tab: QueryTabKey; row: DeviceRow }) {
  state.activeTab = payload.tab
  state.focusedId = payload.row.id
  pageChannel.send({
    type: 'FOCUS',
    payload: { id: String(payload.row.id), coord3857: payload.row.coord3857, zoom: 14 },
  })
}

function onTableSelectionChange(payload: {
  tab: QueryTabKey
  payload: { keys: Array<string | number>; rows: DeviceRow[] }
}) {
  const table = getTableState(payload.tab)
  table.selectedKeys = payload.payload.keys

  const first = payload.payload.rows[0]
  if (!first) {
    syncStateToMap()
    return
  }

  state.activeTab = payload.tab
  state.focusedId = first.id
  syncStateToMap()
}

function roundCoord(value: number): number {
  return Number(value.toFixed(6))
}

function applyBoundsToCurrentForm(bounds: GeoBoundsPayload) {
  const normalizedBounds = {
    longitudeMin: roundCoord(Math.min(bounds.longitudeMin, bounds.longitudeMax)),
    longitudeMax: roundCoord(Math.max(bounds.longitudeMin, bounds.longitudeMax)),
    latitudeMin: roundCoord(Math.min(bounds.latitudeMin, bounds.latitudeMax)),
    latitudeMax: roundCoord(Math.max(bounds.latitudeMin, bounds.latitudeMax)),
  }

  state.lastMapEvent = `收到地图框选范围：${normalizedBounds.longitudeMin},${normalizedBounds.latitudeMin} - ${normalizedBounds.longitudeMax},${normalizedBounds.latitudeMax}`

  if (state.activeTab === 'basic') {
    Object.assign(basicFormModel, normalizedBounds)
    void dispatchQuery('basic', { ...basicFormModel }, 'MAP_BOUNDS_SELECT')
    return
  }

  Object.assign(advancedFormModel, normalizedBounds)
  void dispatchQuery('advanced', { ...advancedFormModel }, 'MAP_BOUNDS_SELECT')
}

function onPageReceiveMapMessage(msg: DualMsg) {
  if (msg.type === 'MAP_READY') {
    state.mapReady = true
    state.lastMapEvent = '收到 MAP_READY，已下发 SYNC_STATE + QUERY'
    syncStateToMap()
    const table = getTableState(state.activeTab)
    sendQueryToMap(state.activeTab, table.filters, 'MAP_READY')
    return
  }

  if (msg.type === 'MAP_SELECT') {
    const selectedId = Number(msg.payload.id)
    const allVisibleRows = [...state.basicTable.rows, ...state.advancedTable.rows]
    const hit = allVisibleRows.find((row) => row.id === selectedId)
    if (!hit) return

    state.lastMapEvent = `收到 MAP_SELECT: ${selectedId}，由 Page 反向调度查询`

    if (state.activeTab === 'basic') {
      basicFormModel.keyword = hit.name
      basicFormModel.status = undefined
      basicFormModel.zone = undefined
      basicFormModel.owner = ''
      void dispatchQuery('basic', { ...basicFormModel }, 'MAP_SELECT')
      return
    }

    advancedFormModel.keyword = hit.name
    advancedFormModel.status = undefined
    advancedFormModel.zone = undefined
    advancedFormModel.level = undefined
    advancedFormModel.source = undefined
    void dispatchQuery('advanced', { ...advancedFormModel }, 'MAP_SELECT')
    return
  }

  if (msg.type === 'MAP_BOUNDS_SELECT') {
    applyBoundsToCurrentForm(msg.payload)
  }
}

function onMapMockReceiveMessage(msg: DualMsg) {
  if (msg.type === 'SYNC_STATE') {
    mapMockState.latestFilters = JSON.stringify(msg.payload.filters)
    return
  }
  if (msg.type === 'FOCUS') {
    mapMockState.latestFocus = JSON.stringify(msg.payload)
  }
}

function simulateMapReady() {
  mapMockChannel.send({ type: 'MAP_READY' })
}

function simulateMapSelect() {
  const activeTable = getTableState(state.activeTab)
  const target = activeTable.rows[0]?.id ?? 1
  mapMockChannel.send({ type: 'MAP_SELECT', payload: { id: String(target) } })
}

function onFilterSelected() {
  const rows = selectedRows.value
  if (!rows.length) return
  const first = rows[0] as DeviceRow
  pageChannel.send({
    type: 'MAP_SHOW_SELECTED',
    payload: {
      rows: rows.map((r) => ({ id: String(r.id), coord3857: r.coord3857 })),
      center: first.coord3857,
    },
  })
}

function onHighlightSelected() {
  const rows = selectedRows.value
  if (!rows.length) return
  pageChannel.send({
    type: 'MAP_HIGHLIGHT_SELECTED',
    payload: { ids: rows.map((r) => String(r.id)) },
  })
}

function onMapClearSelection() {
  pageChannel.send({ type: 'MAP_CLEAR_SELECTION' })
}

onMounted(() => {
  pageChannel.on(onPageReceiveMapMessage)
  mapMockChannel.on(onMapMockReceiveMessage)
  mapMockChannel.send({ type: 'MAP_READY' })

  state.basicTable.columns = buildBasicColumns({})
  state.advancedTable.columns = buildAdvancedColumns({})
  state.basicTable.collapsed = true
  state.advancedTable.collapsed = true
  syncStateToMap()
  void dispatchQuery('basic', { ...basicFormModel }, 'INITIAL_LOAD')
})

onUnmounted(() => {
  pageChannel.close()
  mapMockChannel.close()
})
</script>

<style scoped>
.dashboard-page {
  display: grid;
  grid-template-columns: 420px minmax(0, 1fr);
  gap: 16px;
  height: calc(100vh - 140px);
}

.bridge-panel {
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  background: #fff;
}

.right-pane {
  display: flex;
  flex-direction: column;
  padding: 14px;
  gap: 12px;
  overflow: hidden;
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  background: #fff;
}

.bridge-title {
  margin-bottom: 4px;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.bridge-panel {
  margin-bottom: 12px;
  padding: 10px 12px;
}

.bridge-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--el-text-color-regular);
}

.bridge-log {
  border-radius: 6px;
  background: var(--el-fill-color-light);
  padding: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 6px;
}

.bridge-log:last-child {
  margin-bottom: 0;
}

@media (max-width: 1300px) {
  .dashboard-page {
    grid-template-columns: 1fr;
    min-height: auto;
  }
}
</style>
