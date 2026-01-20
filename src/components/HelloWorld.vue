<template>
  <div>
    <ProForm
      v-model="searchModel"
      :schema="searchSchema"
      :show-actions="true"
      submit-text="查询"
      reset-text="重置"
      @submit="onSearch"
      @reset="onReset"
    />

    <ProTable
      title="用户列表"
      :columns="columns"
      :request="fetchList"
      :request-extra="searchModel"
      :pagination="{ pageSize: 10 }"
      border
      stripe
    >
      <template #action="{ row }">
        <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
        <el-button link type="danger" @click="removeRow(row)">删除</el-button>
      </template>
    </ProTable>

    <el-dialog v-model="visible" :title="editing ? '编辑用户' : '新增用户'" width="600px">
      <ProForm
        ref="editFormRef"
        v-model="formModel"
        :schema="formSchema"
        :show-actions="false"
        label-width="90"
      />
      <template #footer>
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import ProTable, { type ProColumn, type RequestParams } from '@/components/ProTable.vue'
import ProForm, { type ProFormItem } from '@/components/ProForm.vue'

type UserRow = {
  id: number
  name: string
  status: 0 | 1
  createdAt: string
}

const searchModel = reactive<{ name?: string; status?: any }>({
  name: '',
  status: undefined
})

const searchSchema: ProFormItem[] = [
  { field: 'name', label: '姓名', valueType: 'text', colSpan: 6 },
  {
    field: 'status',
    label: '状态',
    valueType: 'select',
    placeholder: '请选择状态',
    colSpan: 6,
    valueEnum: {
      1: '启用',
      0: '禁用'
    }
  }
]

const columns: ProColumn<UserRow>[] = [
  { title: 'ID', dataIndex: 'id', width: 80, sortable: true },
  { title: '姓名', dataIndex: 'name', minWidth: 160, ellipsis: true },
  {
    title: '状态',
    dataIndex: 'status',
    valueType: 'tag',
    valueEnum: {
      1: { text: '启用', status: 'success' },
      0: { text: '禁用', status: 'info' }
    }
  },
  { title: '创建时间', dataIndex: 'createdAt', width: 180, sortable: true },
  { title: '操作', dataIndex: 'id', width: 160, slot: 'action', align: 'center' }
]

// 模拟后端请求
async function fetchList(params: RequestParams) {
  // params: currentPage/pageSize + searchModel + sortField/sortOrder
  const { currentPage, pageSize } = params
  const total = 57

  const data: UserRow[] = Array.from({ length: pageSize }).map((_, i) => {
    const id = (currentPage - 1) * pageSize + i + 1
    return {
      id,
      name: (params.name ? String(params.name) : '用户') + ' ' + id,
      status: id % 2 ? 1 : 0,
      createdAt: '2025-01-01 12:00:00'
    }
  })

  return { data, total }
}

function onSearch() {
  // ProTable 会因为 requestExtra 变化自动 refresh（watchEffect）
}
function onReset() {
  // 同上
}

// 弹窗表单
const visible = ref(false)
const editing = ref(false)
const editFormRef = ref<InstanceType<typeof ProForm> | null>(null)

const formModel = reactive<{ id?: number; name?: string; status?: 0 | 1; remark?: string }>({
  name: '',
  status: 1,
  remark: ''
})

const formSchema: ProFormItem[] = [
  { field: 'name', label: '姓名', valueType: 'text', rules: [{ required: true, message: '请输入姓名', trigger: 'blur' }] },
  { field: 'status', label: '状态', valueType: 'radio', valueEnum: { 1: '启用', 0: '禁用' }, defaultValue: 1 },
  { field: 'remark', label: '备注', valueType: 'textarea', colSpan: 24 }
]

function openEdit(row: UserRow) {
  editing.value = true
  formModel.id = row.id
  formModel.name = row.name
  formModel.status = row.status
  formModel.remark = ''
  visible.value = true
}

function removeRow(row: UserRow) {
  console.log('remove', row)
}

async function save() {
  const ok = await editFormRef.value?.validate().catch(() => false)
  if (!ok) return
  console.log('save', { ...formModel })
  visible.value = false
}
</script>
