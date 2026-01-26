<template>
  <div style="padding: 16px">
    <ProTable
      title="Users"
      :columns="columns"
      :request="fetchList"
      :row-selection="rowSelection"
      :expand="{ width: 46 }"
      border
      stripe
    >
      <template #toolbar="{ reload, reset }">
        <el-button @click="reset">Reset</el-button>
        <el-button type="primary" @click="reload">Reload</el-button>
      </template>

      <template #expand="{ row }">
        <div style="padding: 12px;">
          <div><b>Expanded Row</b></div>
          <div>ID: {{ row.id }}</div>
          <div>Email: {{ row.email }}</div>
        </div>
      </template>
    </ProTable>
  </div>
</template>

<script setup lang="tsx">
import { ref } from 'vue'
import ProTable, { type ProColumn, type RequestParams, type RowSelection } from '@/components/ProTable.vue'
 
type User = {
  id: number
  name: string
  email: string
}

const selectedKeys = ref<Array<number | string>>([])

const rowSelection: RowSelection<User> = {
  selectedRowKeys: selectedKeys.value,
  onChange: (keys) => {
    selectedKeys.value = keys
    console.log('selected keys:', keys)
  }
}

const columns: ProColumn<User>[] = [
  { title: 'ID', dataIndex: 'id', width: 80, sortable: true },
  { title: 'Name', dataIndex: 'name', minWidth: 140 },
  {
    title: 'Email',
    dataIndex: 'email',
    render: ({ cellValue }) => (
      <el-link href={`mailto:${cellValue}`} type="primary">
        {cellValue}
      </el-link>
    )
  },
  {
    title: 'Actions',
    key: 'actions',
    width: 220,
    render: ({ row }) => (
      <>
        <el-button size="small" onClick={() => handleEdit(row)}>Edit</el-button>
        <el-button size="small" type="danger" onClick={() => handleDelete(row)}>Delete</el-button>
      </>
    )
  }
]

// mock request
async function fetchList(params: RequestParams) {
  console.log('request params:', params)
  const { currentPage, pageSize } = params
  const total = 25

  const data: User[] = Array.from({ length: pageSize }).map((_, i) => {
    const id = (currentPage - 1) * pageSize + i + 1
    return {
      id,
      name: `User ${id}`,
      email: `user${id}@example.com`
    }
  })

  return { data, total }
}

function handleEdit(row: User) {
  console.log('edit:', row)
}

function handleDelete(row: User) {
  console.log('delete:', row)
}
</script>
