# 前端组件开发规范（Vue3 + TS + TSX）

> 适用于中后台系统 / 组件库 / 高度抽象组件

---

## 一、设计目标

* 提升**组件可维护性**与**长期演进能力**
* 保证 **TypeScript 类型体验（IDE 智能提示）**
* 在 Vue 生态下，合理引入 **TSX / JSX**，避免过度复杂
* 兼容 **VS Code（Volar）** 与 **WebStorm（JetBrains）**

---

## 二、组件形态选型规范（非常重要）

### 2.1 组件形态总原则（一句话）

> **“结构优先用 SFC，渲染器/配置驱动优先用 TSX。”**

---

### 2.2 推荐使用 TSX 的组件类型（必须）

以下组件 **强烈推荐使用纯 `.tsx` 文件**：

* ProTable / ProForm / ProDialog
* 表格列渲染器（columns.render）
* Schema / 配置驱动 UI
* 递归渲染组件（多级表头、树、表单嵌套）
* 需要强类型 props / 泛型推断 / IDE 完整补全的基础组件

**原因：**

* TSX = 原生 TypeScript + JSX，IDE 解析路径最短
* WebStorm 对 `.tsx` props / 泛型提示更稳定
* JSX 写复杂渲染逻辑比 `h()` / template 更清晰

✅ 示例：

```
components/
  ProTable/
    ProTable.tsx
    types.ts
    index.ts
```

---

### 2.3 推荐使用 SFC（.vue）的组件类型（默认）

以下组件 **推荐使用 `.vue` 单文件组件**：

* 页面级组件（views/pages）
* 业务组件（非高度抽象）
* 布局组件（Layout / Header / Sidebar）
* 样式/结构占比高的组件

**原因：**

* Template 结构清晰，团队可读性更高
* scoped style / CSS / 动画支持更自然
* Vue 官方生态与 DevTools 体验最佳

---

### 2.4 SFC + `<script setup lang="tsx">` 的使用边界

该写法 **仅用于“局部 JSX 需求”**，不作为主流形态：

* 少量 render 逻辑
* 局部 slot/render 函数

❌ 不推荐：

* 整个组件都在写 JSX
* 大量递归 / 配置驱动逻辑

**理由：**

* SFC + TSX 会叠加 Vue + TSX 的复杂度
* WebStorm 对该组合的类型提示不如纯 TSX 稳定

---

## 三、组件目录结构规范（强制）

### 3.1 基础组件（Base / Pro）

```
components/
  ProTable/
    ProTable.tsx      # 核心实现（TSX）
    types.ts          # 类型定义（必须导出）
    index.ts          # 统一导出入口
    style.css         # 可选样式
```

### 3.2 index.ts 统一出口（强制）

```ts
import ProTable from './ProTable'
export default ProTable
export * from './types'
```

**禁止直接从实现文件引入：**

```ts
❌ import ProTable from './ProTable/ProTable'
```

---

## 四、TypeScript 类型规范（核心价值）

### 4.1 Props 类型必须显式导出（强制）

```ts
export interface ProTableProps<T = any> {
  columns: ProColumn<T>[]
  request?: RequestFn<T>
  pagination?: false | Partial<ProPagination>
}
```

**禁止仅写在 `defineProps<{}>` 内部而不导出。**

---

### 4.2 渲染器 Props 约定（统一）

```ts
render?: (scope: {
  row: T
  column: any
  $index: number
  cellValue: any
}) => JSX.Element | VNode
```

目标：

* columns.render 使用体验接近 React
* IDE 可完整提示 `row.xxx`

---

### 4.3 dataIndex 规范

* 支持：`dataIndex: 'a.b.c'`
* 不建议在 render 内手动 `row.xxx.xxx`
* 统一通过 `getByPath` 工具函数

---

## 五、ProTable / ProForm 专属规范

### 5.1 columns/schema 设计原则

* **配置即 UI**，避免业务逻辑写进组件
* render > slot > valueEnum > default
* 无 dataIndex 的列必须提供 `key`

---

### 5.2 render 优先级（强制）

1. `column.render`（JSX）
2. `column.slot`（Vue slot）
3. `valueEnum / tag`
4. 默认文本渲染

---

### 5.3 多级表头 / 嵌套规则

* 父列（有 children）**不允许**配置 `prop`
* 叶子列才绑定 `prop / sortable`
* 子列必须作为 `ElTableColumn` 的 children

---

## 六、IDE & 工程配置规范

### 6.1 VS Code

* 使用 Volar
* TypeScript 使用项目内版本

### 6.2 WebStorm（重点）

* Settings → TypeScript → 使用 `node_modules/typescript`
* Vue Language Server = Auto / Volar
* 启用 service-powered type engine
* 优先使用 `.tsx` 编写基础组件

---

## 七、什么时候可以破例？

允许破例，但必须满足：

* 有明确说明（README / 注释）
* 破例能显著降低复杂度

---

## 八、结语（工程共识）

> **TSX 不是为了炫技，而是为了把复杂渲染写得更简单。**
> **SFC 不是落后，而是最适合表达结构与样式。**

这两者不是对立关系，而是分工明确的工具。

---

📌 本规范适用于：

* Vue3 + TypeScript 项目
* 中后台 / 管理系统
* 需要长期维护的组件库
