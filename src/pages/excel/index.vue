<template>
  <el-card>
    <el-button type="primary" @click="onExport">导出 Excel</el-button>
    Example 组件示例：
    <Example />
  </el-card>
</template>

<script setup lang="ts">
import { exportToExcel } from '@/utils/excel'
import Example from '@/components/Example.vue'

const rows = [
  { id: 1, name: 'Alice', score: 98 },
  { id: 2, name: 'Bob', score: 88 },
]

function onExport() {
  exportToExcel(rows, {
    filename: 'scores.xlsx',
    header: [
      { key: 'id', title: 'ID' },
      { key: 'name', title: '姓名' },
      { key: 'score', title: '分数' },
    ],
  })
}
</script>
