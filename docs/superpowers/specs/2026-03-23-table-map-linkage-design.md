# 表格-地图联动设计文档

**日期**: 2026-03-23
**状态**: 已批准

---

## 背景

Dashboard 页面（`src/pages/dashboard/index.vue`）有一个多选表格，`map-ol` 页面（`src/pages/map-ol/index.vue`）展示地图热力点。两者通过 BroadcastChannel (`dual-screen-ol`) 通信。

目标：在 Dashboard 新增"筛选"和"高亮"两个按钮，实现表格选中数据与地图的双向联动。地图默认渲染 Dashboard 的 DeviceRow 设备坐标点，替代原有随机热力数据。

---

## 协议层

**文件**: `src/shared/protocol.ts`

`MAP_READY` 已存在于 `DualMsg` 联合类型中，无需新增。将以下 4 条消息类型追加到 `DualMsg` 联合类型中：

```ts
| { type: 'MAP_SYNC_ROWS'; payload: { rows: Array<{ id: string; coord3857: [number, number] }> } }
| { type: 'MAP_SHOW_SELECTED'; payload: { rows: Array<{ id: string; coord3857: [number, number] }>; center: [number, number] } }
| { type: 'MAP_HIGHLIGHT_SELECTED'; payload: { ids: string[] } }
| { type: 'MAP_CLEAR_SELECTION' }
```

- `MAP_SYNC_ROWS`：推送全量设备点，仅在收到 `MAP_READY` 时发送（见 Dashboard 同步时机）
- `MAP_SHOW_SELECTED`：筛选模式，地图只显示这些点，视图飞到 center（第一条数据的坐标）
- `MAP_HIGHLIGHT_SELECTED`：高亮模式，全量点不变，选中 id 对应点叠加高亮样式
- `MAP_CLEAR_SELECTION`：重置，取消筛选或高亮，恢复 normal 模式

---

## Dashboard 端

**文件**: `src/pages/dashboard/index.vue`

### `selectedRows` 计算属性

派生逻辑（需注意 `selectedKeys` 类型为 `Array<string | number>`，`DeviceRow.id` 为 `number`）：

```ts
const selectedRows = computed<DeviceRow[]>(() => {
  const table = state.activeTab === 'basic' ? state.basicTable : state.advancedTable
  const keySet = new Set(table.selectedKeys.map(String))
  return table.rows.filter((r) => keySet.has(String(r.id)))
})
const selectedCount = computed(() => selectedRows.value.length)
```

### UI 按钮

在 `bridge-panel` 新增一排按钮区域，显示在现有 `bridge-row` 之后：

```
[ el-badge(count) 筛选 ]  [ el-badge(count) 高亮 ]  [ 重置 ]
```

- badge 值 = `selectedCount`，当值为 0 时隐藏（`:hidden="selectedCount === 0"`）
- 筛选、高亮按钮在 `selectedCount === 0` 时 disabled

### 事件处理

- `onFilterSelected()`：取 `selectedRows.value`，发送 `MAP_SHOW_SELECTED`，center 为第一条的 coord3857
- `onHighlightSelected()`：发送 `MAP_HIGHLIGHT_SELECTED`，payload.ids = selectedRows.value.map(r => String(r.id))
- `onClearSelection()`：发送 `MAP_CLEAR_SELECTION`

### 同步时机

**`MAP_SYNC_ROWS` 始终携带全量 `ALL_ROWS`**（1000 条静态设备数据），不随查询筛选缩减。查询只影响表格展示内容，不影响地图的基础点集。

发送时机：

- `onPageReceiveMapMessage` 收到 `MAP_READY` 时：在已有的 `syncStateToMap()` 之外，额外发送一次 `MAP_SYNC_ROWS`（ALL_ROWS）

注：`onMounted` 中已有 `mapMockChannel.send({ type: 'MAP_READY' })` 会触发上述路径，无需在 `onMounted` 中额外单独发送 `MAP_SYNC_ROWS`，避免重复发送。

### onTableSelectionChange 处理

现有 `onTableSelectionChange` 在每次选中变化时自动发送 `FOCUS` 消息（地图飞行）。为避免与"筛选"按钮的 center 飞行冲突，**移除 `onTableSelectionChange` 中的 `pageChannel.send(FOCUS)` 调用**，仅更新 `table.selectedKeys` 和 `state.focusedId`，保留 `syncStateToMap()`。飞行操作改为由用户主动点击按钮触发。

---

## Map 端

### 新增 Composable

**文件**: `src/composables/ol/useDashboardChannel.ts`

封装 BroadcastChannel 订阅，`onUnmounted` 时关闭 channel。对外暴露：

| ref              | 类型                                                    | 说明                                     |
| ---------------- | ------------------------------------------------------- | ---------------------------------------- |
| `allPoints`      | `Ref<Array<{id: string; coord3857: [number, number]}>>` | 收到 MAP_SYNC_ROWS 时更新                |
| `mode`           | `Ref<'normal' \| 'filter' \| 'highlight'>`              | 当前地图模式                             |
| `filteredPoints` | `Ref<Array<{id: string; coord3857: [number, number]}>>` | 筛选模式下的点集合                       |
| `highlightedIds` | `Ref<Set<string>>`                                      | 高亮模式下的 id 集合                     |
| `pendingCenter`  | `Ref<[number, number] \| null>`（可写 Ref）             | 筛选后需飞到的坐标，map-ol 消费后置 null |

消息处理逻辑：

- `MAP_SYNC_ROWS` → 更新 `allPoints`。若 mode 为 `'filter'` 或 `'highlight'`，**重置回 normal 模式**（filter/highlight 的点集可能已过期），清空 filteredPoints/highlightedIds/pendingCenter
- `MAP_SHOW_SELECTED` → 设 `mode='filter'`，更新 `filteredPoints`，设 `pendingCenter`
- `MAP_HIGHLIGHT_SELECTED` → 设 `mode='highlight'`，更新 `highlightedIds`（用 `new Set(ids)`）
- `MAP_CLEAR_SELECTION` → 重置 `mode='normal'`，清空 filteredPoints / highlightedIds / pendingCenter

composable 内部还需发送 `MAP_READY`，通知 Dashboard 推送初始数据：在 composable 创建时（或调用 `init()` 方法时）通过同一 BroadcastChannel 发送 `{ type: 'MAP_READY' }`。

### map-ol/index.vue 改动

**文件**: `src/pages/map-ol/index.vue`

**移除**：`generateBeijingRandomPoints`、`BEIJING_CLUSTERS`、随机数据生成相关逻辑及常量（`POINT_COUNT`、`gaussianRandom`、`kmToLat`、`kmToLon`、`pickCluster` 等）。同时**移除** `refresh()` 函数及模板中的"刷新 N 点"按钮，因为随机数据生成被取消后该按钮无意义。`basePoints`、`targetPoints` 的初始化改由 channel 数据驱动。

**新增**：引入 `useDashboardChannel`

图层渲染规则：

| mode        | `targetPoints`（热力/点图层数据）     | 高亮 VectorLayer                     |
| ----------- | ------------------------------------- | ------------------------------------ |
| `normal`    | `allPoints` 转为 `HeatPointEx[]`      | 隐藏                                 |
| `filter`    | `filteredPoints` 转为 `HeatPointEx[]` | 隐藏                                 |
| `highlight` | `allPoints` 转为 `HeatPointEx[]`      | 显示，仅渲染 `highlightedIds` 内的点 |

watch `mode`、`allPoints`、`filteredPoints`、`highlightedIds` 变化时重新计算 `targetPoints` 并更新高亮图层 features。

**高亮图层**：新增一个 VectorLayer，`zIndex: 50`（高于已有 grid 层的 34），feature 为高亮点位坐标，样式为黄色描边大五角星（`RegularShape`，`radius: 12`，`points: 5`，`fill: yellow`，`stroke: orange`）。

**视图飞行**：watch `pendingCenter`，变化且非 null 时调用 `animate`，在完成回调中将 `pendingCenter` 置 null：

```ts
watch(pendingCenter, (center) => {
  if (!center || !map.value) return
  map.value.getView().animate({ center, zoom: 14, duration: 600 }, () => {
    pendingCenter.value = null
  })
})
```

---

## 数据转换

DeviceRow 的 `coord3857` 直接用于地图坐标，无需投影转换（已是 EPSG:3857）。

转为 `HeatPointEx` 格式时（**必须是 `HeatPointEx`**，因 `applySelection` 访问 `p.x3857` / `p.y3857`）。

**`rowToHeatPointEx` 函数放在 `map-ol/index.vue` 内部**（而非 composable 中），因为 `HeatPointEx` 是该文件的本地类型，无需跨文件导出：

```ts
import { toLonLat } from 'ol/proj'

// 放在 map-ol/index.vue 的 script setup 中
function rowToHeatPointEx(row: { id: string; coord3857: [number, number] }): HeatPointEx {
  const [x3857, y3857] = row.coord3857
  const [lon, lat] = toLonLat([x3857, y3857]) as [number, number]
  return {
    id: Number(row.id),
    lon,
    lat,
    x3857,
    y3857,
    weight: 0.5,
    clusterPeak: 1,
  }
}
```

`lon`/`lat` 必须通过 `toLonLat` 反投影，不可置 0，否则 hover popup 显示坐标错误。

`useDashboardChannel` composable 仅暴露原始 `{ id: string; coord3857: [number, number] }` 数据，由 `map-ol/index.vue` 调用 `rowToHeatPointEx` 完成转换。

---

## 边界情况

- **地图页晚于 Dashboard 打开**：地图 composable 创建时发送 `MAP_READY`，Dashboard 的 `onPageReceiveMapMessage` 收到后发送 `MAP_SYNC_ROWS`（全量），地图正常初始化。
- **筛选/高亮后收到新 MAP_SYNC_ROWS**：重置回 normal 模式，避免旧的 filter/highlight 点集与新数据不一致。
- **筛选/高亮后用户继续在表格操作（改变选中项）**：badge 数字实时更新，地图不自动跟随，需用户再次点击按钮主动触发。
- **selectedRows 为空时**：按钮 disabled，不发送消息。
- **地图页未打开时 Dashboard 发送消息**：BroadcastChannel 无响应，地图打开后发 `MAP_READY` 触发重新推送，无遗漏。
