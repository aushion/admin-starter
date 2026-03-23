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

新增 4 条消息类型：

```ts
// 推送全量设备点：Dashboard onMounted 及每次查询完成后发送
{ type: 'MAP_SYNC_ROWS'; payload: { rows: Array<{ id: string; coord3857: [number, number] }> } }

// 筛选模式：地图只显示这些点，视图飞到 center（第一条数据的坐标）
{ type: 'MAP_SHOW_SELECTED'; payload: { rows: Array<{ id: string; coord3857: [number, number] }>; center: [number, number] } }

// 高亮模式：全量点不变，选中 id 对应点叠加高亮样式
{ type: 'MAP_HIGHLIGHT_SELECTED'; payload: { ids: string[] } }

// 重置：取消筛选或高亮，恢复 normal 模式
{ type: 'MAP_CLEAR_SELECTION' }
```

---

## Dashboard 端

**文件**: `src/pages/dashboard/index.vue`

### 新增计算属性

- `selectedRows`：当前激活 tab 的已选行（从 `state.basicTable` / `state.advancedTable` 的 selectedKeys 和 rows 派生）
- `selectedCount`：`selectedRows.length`，用于 el-badge value

### UI 按钮

在 `bridge-panel` 的 `bridge-row` 区域新增操作按钮：

```
[ el-badge(count) 筛选 ]  [ el-badge(count) 高亮 ]  [ 重置 ]
```

- badge 值 = `selectedCount`，当值为 0 时隐藏（`:hidden="selectedCount === 0"`）
- 筛选、高亮按钮在 `selectedCount === 0` 时 disabled

### 事件处理

- `onFilterSelected()`：取 `selectedRows`，发送 `MAP_SHOW_SELECTED`，center 为第一条的 coord3857
- `onHighlightSelected()`：发送 `MAP_HIGHLIGHT_SELECTED`，payload 为所有选中行的 id（string）
- `onClearSelection()`：发送 `MAP_CLEAR_SELECTION`

### 同步时机

- `onMounted`：额外发一条 `MAP_SYNC_ROWS`（全量 ALL_ROWS）
- `dispatchQuery` 完成后：重新发 `MAP_SYNC_ROWS`（查询结果 rows），保证地图数据随查询更新

---

## Map 端

### 新增 Composable

**文件**: `src/composables/ol/useDashboardChannel.ts`

封装 BroadcastChannel 订阅，`onUnmounted` 时关闭 channel。对外暴露：

| ref              | 类型                                                    | 说明                              |
| ---------------- | ------------------------------------------------------- | --------------------------------- |
| `allPoints`      | `Ref<Array<{id: string; coord3857: [number, number]}>>` | 收到 MAP_SYNC_ROWS 时更新         |
| `mode`           | `Ref<'normal' \| 'filter' \| 'highlight'>`              | 当前地图模式                      |
| `filteredPoints` | `Ref<Array<{id: string; coord3857: [number, number]}>>` | 筛选模式下的点集合                |
| `highlightedIds` | `Ref<Set<string>>`                                      | 高亮模式下的 id 集合              |
| `pendingCenter`  | `Ref<[number, number] \| null>`                         | 筛选后需飞到的坐标，消费后置 null |

消息处理逻辑：

- `MAP_SYNC_ROWS` → 更新 `allPoints`，mode 为 normal 时同时更新地图点层
- `MAP_SHOW_SELECTED` → 设 mode='filter'，更新 `filteredPoints`，设 `pendingCenter`
- `MAP_HIGHLIGHT_SELECTED` → 设 mode='highlight'，更新 `highlightedIds`
- `MAP_CLEAR_SELECTION` → 重置 mode='normal'，清空 filteredPoints / highlightedIds / pendingCenter

### map-ol/index.vue 改动

**文件**: `src/pages/map-ol/index.vue`

**移除**：`generateBeijingRandomPoints`、`BEIJING_CLUSTERS`、随机数据生成相关逻辑及常量（POINT_COUNT、gaussianRandom 等）

**新增**：引入 `useDashboardChannel`

图层渲染规则：

| mode        | `targetPoints`（热力/点图层数据）         | 高亮 VectorLayer                     |
| ----------- | ----------------------------------------- | ------------------------------------ |
| `normal`    | `allPoints`（转换为 HeatPoint 格式）      | 隐藏                                 |
| `filter`    | `filteredPoints`（转换为 HeatPoint 格式） | 隐藏                                 |
| `highlight` | `allPoints`                               | 显示，仅渲染 `highlightedIds` 内的点 |

**高亮图层**：新增一个 VectorLayer，zIndex 高于热力点层，feature 为高亮点位坐标，样式为黄色描边大五角星（`RegularShape`，radius=12，points=5）。

**视图飞行**：watch `pendingCenter`，变化且非 null 时调用：

```ts
map.value?.getView().animate({ center: pendingCenter.value, zoom: 14, duration: 600 })
```

动画结束后将 `pendingCenter` 置 null。

---

## 数据转换

DeviceRow 的 `coord3857` 直接用于地图坐标，无需投影转换（已是 EPSG:3857）。

转为 HeatPoint 格式时：

- `id` = `row.id`（string → number 或保持 string，依 HeatPoint 类型）
- `lon` / `lat`：可从 coord3857 反投影（`toLonLat`），或置 0（popup 中若不需要展示则省略）
- `weight` = 0.5（固定值，DeviceRow 无权重字段）
- `x3857` / `y3857` = coord3857[0] / coord3857[1]

---

## 边界情况

- 地图页尚未打开时 Dashboard 发送消息：BroadcastChannel 无需响应，地图打开后收不到历史消息。地图初始化完成后通过发送 `MAP_READY` 触发 Dashboard 重新推送 `MAP_SYNC_ROWS`（现有协议已支持）。
- 筛选/高亮后用户继续在表格操作（改变选中项）：badge 数字实时更新，但地图不自动跟随，需用户再次点击按钮主动触发。
- `selectedRows` 为空时点击筛选/高亮按钮：按钮 disabled，不发送消息。
