<template>
  <ProForm
    v-model="formModel"
    :schema="schema"
    label-width="140"
    @submit="onSubmit"
  />
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import ProForm, { type ProFormItem } from '@/components/ProForm'

// 模拟接口
async function fetchZones() {
  // return await http.get('/api/zones')
  return [{ id: 'z1', name: 'Zone one' }, { id: 'z2', name: 'Zone two' }]
}

async function fetchCountsByZone(zoneId: string) {
  // return await http.get('/api/counts', { params: { zoneId } })
  if (!zoneId) return []
  const map: Record<string, number[]> = { z1: [1, 2, 3], z2: [10, 20] }
  return (map[zoneId] || []).map((n) => ({ value: n, label: String(n) }))
}

const formModel = reactive({
  zoneId: undefined as string | undefined,
  activityCount: undefined as number | undefined,
})

const schema: ProFormItem[] = [
  {
    field: 'zoneId',
    label: 'Activity zone',
    valueType: 'select',
    request: async () => fetchZones(),
    transformOptions: (raw) =>
      raw.map((x: any) => ({ label: x.name, value: x.id })),
    rules: [{ required: true, message: '请选择区域', trigger: 'change' }],
  },
  {
    field: 'activityCount',
    label: 'Activity count',
    valueType: 'select',
    // 关键：依赖第一个字段
    dependencies: ['zoneId'],
    request: async ({ model }) => fetchCountsByZone(model.zoneId),
    // 依赖变化时默认会清空当前值（clearOnDependenciesChange 默认 true）
    clearOnDependenciesChange: true,
    disabled: ({ model }) => !model.zoneId,
    rules: [{ required: true, message: '请选择次数', trigger: 'change' }],
  },
]

function onSubmit(values: Record<string, any>) {
  console.log('submit:', values)
}
</script>