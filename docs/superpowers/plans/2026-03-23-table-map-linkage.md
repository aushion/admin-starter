# Table-Map Linkage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Dashboard 表格中新增"筛选"和"高亮"按钮，通过 BroadcastChannel 实现与 map-ol 页面的联动：筛选时地图只显示选中点并飞到第一条，高亮时在全量点上叠加高亮标注层。

**Architecture:** Dashboard 通过扩展后的 BroadcastChannel 协议向 map-ol 推送全量 DeviceRow 坐标以及筛选/高亮指令；map-ol 用新的 `useDashboardChannel` composable 订阅频道，维护 `mode`/`allPoints`/`filteredPoints`/`highlightedIds` 状态，驱动热力图层和高亮图层渲染。

**Tech Stack:** Vue 3 + TypeScript, OpenLayers, Element Plus, BroadcastChannel API

---

## File Map

| 文件                                        | 操作 | 职责                                                        |
| ------------------------------------------- | ---- | ----------------------------------------------------------- |
| `src/shared/protocol.ts`                    | 修改 | 追加 4 条 DualMsg 联合类型                                  |
| `src/composables/ol/useDashboardChannel.ts` | 新建 | 订阅 BroadcastChannel，维护地图模式状态                     |
| `src/pages/dashboard/index.vue`             | 修改 | selectedRows 计算属性、按钮 UI、事件处理、MAP_READY 扩展    |
| `src/pages/map-ol/index.vue`                | 修改 | 移除随机数据、接入 channel、highlight VectorLayer、视图飞行 |

---

## Task 1: 扩展协议层

**Files:**

- Modify: `src/shared/protocol.ts`

- [ ] **Step 1: 将 4 条新消息类型追加到 DualMsg 联合类型**

  打开 `src/shared/protocol.ts`，在现有 `DualMsg` 末尾追加：

  ```ts
  export type DualMsg =
    | { type: 'MAP_READY' }
    | { type: 'SYNC_STATE'; payload: { filters: Filters } }
    | { type: 'QUERY'; payload: { requestId: string; filters: Filters } }
    | { type: 'FOCUS'; payload: { id?: string; coord3857?: [number, number]; zoom?: number } }
    | { type: 'MAP_SELECT'; payload: { id: string } }
    | {
        type: 'MAP_SYNC_ROWS'
        payload: { rows: Array<{ id: string; coord3857: [number, number] }> }
      }
    | {
        type: 'MAP_SHOW_SELECTED'
        payload: {
          rows: Array<{ id: string; coord3857: [number, number] }>
          center: [number, number]
        }
      }
    | { type: 'MAP_HIGHLIGHT_SELECTED'; payload: { ids: string[] } }
    | { type: 'MAP_CLEAR_SELECTION' }
  ```

- [ ] **Step 2: 检查 TypeScript 编译无报错**

  ```bash
  cd /Users/aushion/Documents/code/admin-starter && npx tsc --noEmit
  ```

  Expected: 无类型错误（如有其他已存在的错误可忽略，新增部分不应引入新错误）

- [ ] **Step 3: Commit**

  ```bash
  git add src/shared/protocol.ts
  git commit -m "feat(protocol): add MAP_SYNC_ROWS, MAP_SHOW_SELECTED, MAP_HIGHLIGHT_SELECTED, MAP_CLEAR_SELECTION"
  ```

---

## Task 2: 新建 useDashboardChannel composable

**Files:**

- Create: `src/composables/ol/useDashboardChannel.ts`

- [ ] **Step 1: 创建文件，实现 BroadcastChannel 订阅和状态管理**

  新建 `src/composables/ol/useDashboardChannel.ts`：

  ```ts
  import { onUnmounted, ref } from 'vue'
  import type { DualMsg } from '@/shared/protocol'

  const CHANNEL_NAME = 'dual-screen-ol'

  type RawPoint = { id: string; coord3857: [number, number] }

  export function useDashboardChannel() {
    const allPoints = ref<RawPoint[]>([])
    const mode = ref<'normal' | 'filter' | 'highlight'>('normal')
    const filteredPoints = ref<RawPoint[]>([])
    const highlightedIds = ref<Set<string>>(new Set())
    const pendingCenter = ref<[number, number] | null>(null)

    function resetToNormal() {
      mode.value = 'normal'
      filteredPoints.value = []
      highlightedIds.value = new Set()
      pendingCenter.value = null
    }

    const bc = new BroadcastChannel(CHANNEL_NAME)

    bc.onmessage = (e: MessageEvent<DualMsg>) => {
      const msg = e.data
      if (msg.type === 'MAP_SYNC_ROWS') {
        allPoints.value = msg.payload.rows
        if (mode.value !== 'normal') resetToNormal()
        return
      }
      if (msg.type === 'MAP_SHOW_SELECTED') {
        mode.value = 'filter'
        filteredPoints.value = msg.payload.rows
        pendingCenter.value = msg.payload.center
        return
      }
      if (msg.type === 'MAP_HIGHLIGHT_SELECTED') {
        mode.value = 'highlight'
        highlightedIds.value = new Set(msg.payload.ids)
        return
      }
      if (msg.type === 'MAP_CLEAR_SELECTION') {
        resetToNormal()
      }
    }

    // 通知 Dashboard 地图已就绪，触发 MAP_SYNC_ROWS 推送
    bc.postMessage({ type: 'MAP_READY' } satisfies DualMsg)

    onUnmounted(() => {
      bc.close()
    })

    return { allPoints, mode, filteredPoints, highlightedIds, pendingCenter }
  }
  ```

- [ ] **Step 2: 检查 TypeScript 编译无报错**

  ```bash
  npx tsc --noEmit
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add src/composables/ol/useDashboardChannel.ts
  git commit -m "feat(composable): add useDashboardChannel for map-dashboard sync"
  ```

---

## Task 3: Dashboard — 逻辑层改动

**Files:**

- Modify: `src/pages/dashboard/index.vue`

- [ ] **Step 1: 在 script setup 中新增 `computed` import，添加 `selectedRows` 和 `selectedCount`**

  在 `src/pages/dashboard/index.vue` 的 script setup 中，`import` 行加入 `computed`：

  ```ts
  import { computed, onMounted, onUnmounted, reactive, toRaw } from 'vue'
  ```

  在 `state` reactive 对象定义之后（约 line 148 之后）添加：

  ```ts
  const selectedRows = computed<DeviceRow[]>(() => {
    const table = state.activeTab === 'basic' ? state.basicTable : state.advancedTable
    const keySet = new Set(table.selectedKeys.map(String))
    return table.rows.filter((r) => keySet.has(String(r.id)))
  })

  const selectedCount = computed(() => selectedRows.value.length)
  ```

- [ ] **Step 2: 修改 `onTableSelectionChange`，移除 FOCUS 自动发送**

  定位现有 `onTableSelectionChange` 函数（约 line 414-433），整个函数目前是：

  ```ts
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
    pageChannel.send({
      type: 'FOCUS',
      payload: { id: String(first.id), coord3857: first.coord3857, zoom: 14 },
    })
  }
  ```

  将整个函数替换为（保留 `table.selectedKeys` 赋值，移除 FOCUS 发送，改为 syncStateToMap）：

  ```ts
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
  ```

- [ ] **Step 3: 扩展 `onPageReceiveMapMessage` 的 MAP_READY 处理，额外发送 MAP_SYNC_ROWS**

  定位现有 MAP_READY 处理块（约 line 436-441）：

  ```ts
  if (msg.type === 'MAP_READY') {
    state.mapReady = true
    state.lastMapEvent = '收到 MAP_READY，已下发 SYNC_STATE'
    syncStateToMap()
    return
  }
  ```

  替换为：

  ```ts
  if (msg.type === 'MAP_READY') {
    state.mapReady = true
    state.lastMapEvent = '收到 MAP_READY，已下发 SYNC_STATE + MAP_SYNC_ROWS'
    syncStateToMap()
    pageChannel.send({
      type: 'MAP_SYNC_ROWS',
      payload: {
        rows: ALL_ROWS.map((r) => ({ id: String(r.id), coord3857: r.coord3857 })),
      },
    })
    return
  }
  ```

- [ ] **Step 4: 新增三个事件处理函数**

  在 `onClearSelection` 之类的现有函数后面追加：

  ```ts
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
  ```

- [ ] **Step 5: 检查 TypeScript 编译无报错**

  ```bash
  npx tsc --noEmit
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add src/pages/dashboard/index.vue
  git commit -m "feat(dashboard): add selectedRows, filter/highlight handlers, extend MAP_READY"
  ```

---

## Task 4: Dashboard — UI 按钮

**Files:**

- Modify: `src/pages/dashboard/index.vue`（template 部分）

- [ ] **Step 1: 在 bridge-panel 的 bridge-row 之后新增按钮行**

  找到 template 中的 `bridge-panel` 区域，在最后一个 `.bridge-log` 的 `</div>` 之后、`</div><!-- bridge-panel -->` 之前插入：

  ```html
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
  ```

- [ ] **Step 2: 检查 TypeScript 编译无报错**

  ```bash
  npx tsc --noEmit
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add src/pages/dashboard/index.vue
  git commit -m "feat(dashboard): add filter/highlight/reset buttons with el-badge"
  ```

---

## Task 5: map-ol — 移除随机数据，接入 Dashboard Channel

**Files:**

- Modify: `src/pages/map-ol/index.vue`

- [ ] **Step 1: 移除随机数据生成相关代码**

  在 `src/pages/map-ol/index.vue` script setup 中，**整体删除**以下内容：
  - `POINT_COUNT` 常量（`const POINT_COUNT = 10000`）
  - `HEAT_HIDE_ZOOM`、`GRID_BASE_PIXEL`、`GRID_MIN_SIZE_M`、`GRID_MAX_SIZE_M` 保留（仍用于框选功能）
  - `ClusterSeed` type
  - `BEIJING_CLUSTERS` 数组常量
  - `gaussianRandom` 函数
  - `kmToLat` 函数
  - `kmToLon` 函数
  - `pickCluster` 函数
  - `generateBeijingRandomPoints` 函数
  - `refresh` 函数

  同时在 template 中删除"刷新 N 点"按钮：

  ```html
  <!-- 删除这一行 -->
  <ElButton size="small" @click="refresh">刷新 {{ POINT_COUNT }} 点</ElButton>
  ```

- [ ] **Step 2: 引入 `useDashboardChannel` 并新增 `rowToHeatPointEx` 工具函数**

  在 script setup 的 import 区域，将现有的 `import { fromLonLat } from 'ol/proj'` 修改为：

  ```ts
  import { fromLonLat, toLonLat } from 'ol/proj'
  ```

  然后新增：

  ```ts
  import { useDashboardChannel } from '@/composables/ol/useDashboardChannel'
  ```

  在 `HeatPointEx` 类型定义之后（原 line 50-53 区域）添加工具函数：

  ```ts
  function rowToHeatPointEx(row: { id: string; coord3857: [number, number] }): HeatPointEx {
    const [x3857, y3857] = row.coord3857
    const [lon, lat] = toLonLat([x3857, y3857]) as [number, number]
    return { id: Number(row.id), lon, lat, x3857, y3857, weight: 0.5, clusterPeak: 1 }
  }
  ```

- [ ] **Step 3: 初始化 channel composable，改写 basePoints/targetPoints 驱动逻辑**

  移除原来的 `basePoints` 和 `targetPoints` 的 ref 声明及赋值逻辑。改为：

  ```ts
  const { allPoints, mode, filteredPoints, highlightedIds, pendingCenter } = useDashboardChannel()

  const basePoints = computed<HeatPointEx[]>(() => allPoints.value.map(rowToHeatPointEx))

  // targetPoints 兼顾 channel 模式和框选模式：
  // - filter 模式：只显示 channel 下发的点（不受框选影响）
  // - normal/highlight 模式：显示 basePoints，如有框选则在框内过滤（保留原有框选热力行为）
  const targetPoints = computed<HeatPointEx[]>(() => {
    if (mode.value === 'filter') return filteredPoints.value.map(rowToHeatPointEx)
    const pts = basePoints.value
    const geom = draw.geometry.value
    if (geom) return pts.filter((p) => geom.intersectsCoordinate([p.x3857, p.y3857]))
    return pts
  })
  ```

  注意：`useOlHeatPoints` 的 `points` 选项原本接受 `targetPoints`（一个 ref），现在改为传入这个 computed ref，无需修改 `useOlHeatPoints` 调用签名（`computed` 实现了 `Ref<T>` 接口，`unref` 和 `watch` 均兼容）。

  修改 `applySelection` 函数（`targetPoints` 已由 computed 驱动，函数只负责触发网格重建）：

  ```ts
  function applySelection() {
    if (!draw.geometry.value) {
      syncLayerByZoom()
      return
    }
    rebuildGridHeat()
    syncLayerByZoom()
  }
  ```

  同时更新 `clearSelection`（移除原来的 `targetPoints.value = basePoints.value.slice()` 赋值）：

  ```ts
  function clearSelection() {
    draw.clear()
    gridSource.clear(true)
    gridCellCount.value = 0
    gridCellSize.value = 0
    syncLayerByZoom()
  }
  ```

  `watch(map, ...)` 内部的 `refresh()` 调用改为 `syncLayerByZoom()`（数据由 channel 驱动，无需主动刷新）。

- [ ] **Step 4: 检查 TypeScript 编译无报错**

  ```bash
  npx tsc --noEmit
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add src/pages/map-ol/index.vue src/composables/ol/useDashboardChannel.ts
  git commit -m "feat(map-ol): replace random data with dashboard channel data"
  ```

---

## Task 6: map-ol — 高亮图层 + 视图飞行

**Files:**

- Modify: `src/pages/map-ol/index.vue`

- [ ] **Step 1: 新增高亮 VectorLayer（在 map watch 块内初始化）**

  在 script setup 中声明高亮图层 ref 和 source（放在 `gridSource` 附近）：

  ```ts
  const highlightSource = new VectorSource()
  const highlightLayer = shallowRef<VectorLayer<VectorSource> | null>(null)
  ```

  在 `watch(map, ...)` 的 callback 中，`gridLayer` 初始化之后追加：

  ```ts
  const highlightStyle = new Style({
    image: new RegularShape({
      points: 5,
      radius: 12,
      radius2: 5,
      angle: 0,
      fill: new Fill({ color: 'rgba(255, 220, 0, 0.95)' }),
      stroke: new Stroke({ color: 'rgba(234, 88, 12, 0.95)', width: 2 }),
    }),
  })

  const highlightLayerInst = new VectorLayer({
    source: highlightSource,
    zIndex: 50,
    visible: false,
    style: highlightStyle,
  })

  highlightLayer.value = highlightLayerInst
  olMap.addLayer(highlightLayerInst)
  ```

  在 `onUnmounted` 中追加清理：

  ```ts
  if (highlightLayer.value) olMap.removeLayer(highlightLayer.value)
  highlightLayer.value = null
  highlightSource.clear(true)
  ```

- [ ] **Step 2: 添加 `Point` import，然后 watch `mode` 和 `highlightedIds` 来更新高亮图层**

  首先在 script setup 的 import 区域，将现有的：

  ```ts
  import { fromExtent as polygonFromExtent } from 'ol/geom/Polygon'
  ```

  改为：

  ```ts
  import Point from 'ol/geom/Point'
  import { fromExtent as polygonFromExtent } from 'ol/geom/Polygon'
  ```

  然后在 script setup 中（放在其他 watch 之后）追加：

  ```ts
  watch(
    [mode, highlightedIds, basePoints],
    ([m, ids]) => {
      if (!highlightLayer.value) return

      if (m !== 'highlight' || ids.size === 0) {
        highlightSource.clear(true)
        highlightLayer.value.setVisible(false)
        return
      }

      const features = basePoints.value
        .filter((p) => ids.has(String(p.id)))
        .map((p) => {
          const f = new Feature({ geometry: new Point([p.x3857, p.y3857]) })
          f.setId(p.id)
          return f
        })

      highlightSource.clear(true)
      highlightSource.addFeatures(features)
      highlightLayer.value.setVisible(true)
    },
    { deep: false },
  )
  ```

- [ ] **Step 3: watch `pendingCenter` 触发视图飞行**

  追加 watch（放在上一个 watch 之后）：

  ```ts
  watch(pendingCenter, (center) => {
    if (!center || !map.value) return
    map.value.getView().animate({ center, zoom: 14, duration: 600 }, () => {
      pendingCenter.value = null
    })
  })
  ```

- [ ] **Step 4: 检查 TypeScript 编译无报错**

  ```bash
  npx tsc --noEmit
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add src/pages/map-ol/index.vue
  git commit -m "feat(map-ol): add highlight layer and pendingCenter fly-to animation"
  ```

---

## Task 7: 手动验证

这些验证需在浏览器中人工确认（BroadcastChannel 跨页通信无法自动化测试）：

- [ ] **验证 1：地图初始化**
  - 打开 Dashboard 页和 map-ol 页（同浏览器，不同标签）
  - map-ol 页应显示约 1000 个点位（北京区域线性排列）

- [ ] **验证 2：筛选功能**
  - 在 Dashboard 表格中勾选若干行（>0）
  - badge 数字应显示勾选数量
  - 点击"筛选"按钮
  - map-ol 地图应只显示勾选行的点，并飞到第一条坐标

- [ ] **验证 3：高亮功能**
  - 在 Dashboard 表格中勾选若干行
  - 点击"高亮"按钮
  - map-ol 地图应显示所有点，勾选行对应点变为黄色五角星

- [ ] **验证 4：重置功能**
  - 在筛选或高亮状态下点击"重置"
  - map-ol 地图恢复显示全量点，高亮层消失

- [ ] **验证 5：按钮 disabled 状态**
  - 未勾选任何行时，"筛选"和"高亮"按钮应为 disabled 状态

- [ ] **Step: Final commit**

  ```bash
  git add -A
  git commit -m "feat: table-map linkage - filter and highlight selected rows on map"
  ```
