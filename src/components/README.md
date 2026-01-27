# Pro 组件手册

面向中后台的配置驱动组件集合，全部通过各自目录的 `index.ts` 导出，保持统一 API 与类型提示。

```
components/
  ProTable/
    ProTable.tsx   # TSX 核心实现
    types.ts       # 显式导出的类型
    index.ts       # 统一出口
    style.css
  ProForm/
    ProForm.tsx
    types.ts
    index.ts
    style.css
  ProDialog/
    ProDialog.tsx
    types.ts
    index.ts
    style.css
```

> 约定：结构优先 SFC，配置/渲染器优先 TSX（详见仓库根目录 `CONTRIBUTING.md`）。

---

## 导入规范（强制）

```ts
import ProTable, { type ProColumn, type RequestParams } from '@/components/ProTable'
import ProForm, { type ProFormItem } from '@/components/ProForm'
import ProDialog, { type ProDialogProps } from '@/components/ProDialog'
```

禁止从实现文件直接引入（如 `./ProTable/ProTable`）。

---

## ProTable

**场景**：列表页、可配置列、支持后端分页/排序、JSX 渲染。

**核心能力**
- `columns.render`（JSX / React 风格）与 `slot/headerSlot`（Vue 风格）双支持
- `valueEnum` 映射（含 `status` -> `ElTag`），`valueType: 'tag'`
- 嵌套多级表头 `children`
- `request` 模式：自动请求 + 分页 + 排序 + 并发保护 + `requestExtra` 依赖刷新
- `rowSelection` 受控选择、`expand` 行展开
- `dataIndex` 支持路径 `'a.b.c'`

**最小示例（request + JSX render）**

```vue
<template>
  <ProTable title="Users" :columns="columns" :request="fetchList" border stripe />
</template>

<script setup lang="tsx">
import ProTable, { type ProColumn, type RequestParams } from '@/components/ProTable'

type User = { id: number; name: string; profile: { email: string } }

const columns: ProColumn<User>[] = [
  { title: 'ID', dataIndex: 'id', width: 80, sortable: true },
  { title: 'Name', dataIndex: 'name', minWidth: 120 },
  {
    title: 'Email',
    dataIndex: 'profile.email',
    render: ({ cellValue }) => (
      <el-link href={`mailto:${cellValue}`} type="primary">
        {cellValue}
      </el-link>
    ),
  },
  {
    title: 'Actions',
    key: 'actions',
    width: 200,
    render: ({ row }) => (
      <>
        <el-button size="small" onClick={() => console.log('edit', row)}>Edit</el-button>
        <el-button size="small" type="danger" onClick={() => console.log('delete', row)}>Delete</el-button>
      </>
    ),
  },
]

const fetchList = async (params: RequestParams) => {
  const { currentPage, pageSize } = params
  const total = 25
  const data: User[] = Array.from({ length: pageSize }).map((_, i) => {
    const id = (currentPage - 1) * pageSize + i + 1
    return { id, name: `User ${id}`, profile: { email: `user${id}@example.com` } }
  })
  return { data, total }
}
</script>
```

**slot/headerSlot 示例（Vue 风格）**

```vue
<ProTable :columns="columns" :data-source="list">
  <template #name="{ row }"><b>{{ row.name }}</b></template>
  <template #nameHeader><span>Name 🔥</span></template>
</ProTable>

const columns = [
  { title: 'Name', dataIndex: 'name' },                   // #name
  { title: 'Name', dataIndex: 'name', headerSlot: 'nameHeader' }, // #nameHeader
]
```

**valueEnum + tag**

```ts
const columns: ProColumn[] = [
  {
    title: 'Status',
    dataIndex: 'status',
    valueType: 'tag',
    valueEnum: {
      1: { text: '启用', status: 'success' },
      0: { text: '禁用', status: 'danger' },
    },
  },
]
```

**展开行 / 行选择**

```vue
<ProTable :columns="columns" :data-source="list" :expand="{ width: 46 }" :row-selection="rowSelection">
  <template #expand="{ row }">
    <div style="padding:12px"><b>Detail</b><pre>{{ row }}</pre></div>
  </template>
</ProTable>

const rowSelection = {
  selectedRowKeys,
  onChange: (keys) => (selectedRowKeys = keys),
}
```

**暴露方法（ref）**

```vue
<ProTable ref="tableRef" ... />

tableRef.value?.reload()
tableRef.value?.reset()
tableRef.value?.setPage(2)
tableRef.value?.setPageSize(50)
tableRef.value?.clearSelection()
tableRef.value?.getSelectedKeys()
```

---

## ProForm

**场景**：查询表单、弹窗内编辑表单、配置驱动表单。

**核心能力**
- `schema` 数组描述字段；`valueType`：text/textarea/select/radio/checkbox/switch/date/datetime/cascader
- `valueEnum` 生成 options；支持自定义 `component` 或 `slot`（字段同名或 `item.slot`）
- `defaultValue` 自动回填；`colSpan` + `gutter` 控制布局；`layout` 支持 inline
- 事件：`submit`、`reset`、`enter`；暴露 `validate/submit/reset` 方法

**最小示例**

```vue
<ProForm v-model="form" :schema="schema" @submit="onSubmit" />

const form = reactive({ name: '', status: 'enabled' })
const schema: ProFormItem[] = [
  { field: 'name', label: '姓名', valueType: 'text', rules: [{ required: true, message: '请输入姓名' }] },
  {
    field: 'status',
    label: '状态',
    valueType: 'select',
    valueEnum: [
      { value: 'enabled', label: '启用' },
      { value: 'disabled', label: '禁用' },
    ],
    colSpan: 8,
  },
]
```

**自定义渲染优先级**
1) `item.slot`（或字段同名 slot）  
2) `item.component`（自定义组件，透传 `componentProps`，使用 v-model）  
3) 内置控件按 `valueType` 渲染

**事件与方法**

```ts
// 事件
@submit(values)  // 通过 validate 后触发
@reset(values)   // 重置为 defaultValue
@enter({ item, model }) // 某字段回车

// ref 方法
formRef.value?.validate()
formRef.value?.submit()
formRef.value?.reset()
```

---

## ProDialog

**场景**：统一弹窗，支持内置表单模式或自定义内容。

**核心能力**
- 通过 `v-model` 控制可见；`open(payload?)`/`close()`/`submit()`/`validate()`/`reset()` 暴露
- 可直接嵌入 ProForm：`formSchema + formModel + formProps`
- Footer 可自定义 slot；默认提供「取消/保存」按钮；`payload`/`submitting` 以 ref 暴露

**最小示例（表单模式）**

```vue
<ProDialog
  ref="dialogRef"
  v-model="visible"
  title="编辑"
  :form-schema="schema"
  :form-model="model"
  @submit="onSubmit"
/>

const schema: ProFormItem[] = [
  { field: 'name', label: '姓名', valueType: 'text', rules: [{ required: true, message: '必填' }] },
]
const model = reactive({ name: '' })

const onSubmit = ({ values, payload }) => {
  console.log('save', values, payload)
}
```

**自定义内容模式**

```vue
<ProDialog v-model="visible" title="自定义">
  <template #default="{ close }">
    <p>任何自定义内容</p>
    <el-button @click="close">关闭</el-button>
  </template>
</ProDialog>
```

**调用 open(payload)**

```ts
dialogRef.value?.open({ title: '编辑用户', values: { name: '张三' } })
```

---

## 开发约定
- Pro 组件使用 TSX；类型必须在 `types.ts` 中显式导出。
- 统一从 `index.ts` 引入，避免直接访问实现文件。
- 无 `dataIndex` 的列/字段需提供唯一 `key`。
- 保持组件无业务耦合：只做渲染与轻量状态管理，业务逻辑放到调用方。
