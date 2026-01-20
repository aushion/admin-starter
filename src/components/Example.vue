<template>
  <div class="example">
    <h2>ProForm 用法示例</h2>
    <p class="example__desc">
      下方展示 ProForm 各种 valueType、插槽、自定义组件、defaultValue、colSpan、layout 等常见用法。
    </p>

    <ProForm
      v-model="formModel"
      :schema="formSchema"
      label-width="160"
      @submit="onSubmit"
      @reset="onReset"
    >
      <!-- field 同名插槽：完全自定义渲染 -->
      <template #customSlot="{ model, field }">
        <el-input
          v-model="model[field]"
          placeholder="通过 slot 自定义内容"
          clearable
        />
      </template>
    </ProForm>

    <div class="example__preview">
      <strong>表单值：</strong>
      <pre>{{ formModel }}</pre>
    </div>

    <h3>Inline 布局（适合搜索条）</h3>
    <ProForm
      v-model="inlineModel"
      :schema="inlineSchema"
      layout="inline"
      :show-actions="true"
      submit-text="查询"
      reset-text="清空"
      @submit="onInlineSubmit"
      @reset="onInlineReset"
    />
  </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import { ElInputNumber } from 'element-plus'
import ProForm, { type ProFormItem } from './ProForm.vue'

const formModel = reactive({
  name: '张三',
  description: '',
  status: 'enabled',
  gender: 'male',
  hobbies: ['music'],
  notify: true,
  birthday: '2025-01-01',
  meetingTime: '',
  age: 18,
  region: [],
  customSlot: ''
})

const formSchema: ProFormItem[] = [
  { field: 'name', label: '文本（text）', valueType: 'text', rules: [{ required: true, message: '请输入姓名', trigger: 'blur' }], placeholder: '请输入姓名', colSpan: 8 },
  { field: 'description', label: '多行（textarea）', valueType: 'textarea', rows: 3, placeholder: '请输入描述', colSpan: 16 },
  {
    field: 'status',
    label: '下拉选择（select）',
    valueType: 'select',
    valueEnum: [
      { value: 'enabled', label: '启用' },
      { value: 'disabled', label: '禁用' }
    ],
    placeholder: '请选择状态',
    colSpan: 8
  },
  {
    field: 'gender',
    label: '单选（radio）',
    valueType: 'radio',
    valueEnum: { male: '男', female: '女' },
    defaultValue: 'male',
    colSpan: 8
  },
  {
    field: 'hobbies',
    label: '多选（checkbox）',
    valueType: 'checkbox',
    valueEnum: [
      { value: 'music', label: '音乐' },
      { value: 'sport', label: '运动' },
      { value: 'travel', label: '旅行' }
    ],
    defaultValue: ['music'],
    colSpan: 8
  },
  {
    field: 'notify',
    label: '开关（switch）',
    valueType: 'switch',
    defaultValue: true,
    componentProps: { activeText: '开', inactiveText: '关' },
    colSpan: 8
  },
  {
    field: 'birthday',
    label: '日期（date）',
    valueType: 'date',
    placeholder: '请选择生日',
    colSpan: 8
  },
  {
    field: 'meetingTime',
    label: '日期时间（datetime）',
    valueType: 'datetime',
    placeholder: '请选择会议时间',
    colSpan: 8
  },
  {
    field: 'age',
    label: '自定义组件（component）',
    component: ElInputNumber,
    componentProps: { min: 0, max: 120, step: 1, controlsPosition: 'right' },
    colSpan: 8
  },
  {
    field: 'region',
    label: '级联选择（cascader）',
    valueType: 'cascader',
    valueEnum: [
      {
        value: 'zhejiang',
        label: '浙江',
        children: [
          { value: 'hangzhou', label: '杭州' },
          { value: 'ningbo', label: '宁波' }
        ]
      },
      {
        value: 'jiangsu',
        label: '江苏',
        children: [
          { value: 'nanjing', label: '南京' },
          { value: 'suzhou', label: '苏州' }
        ]
      }
    ],
    componentProps: {
      clearable: true,
      props: { checkStrictly: true }
    },
    colSpan: 8
  },
  {
    field: 'customSlot',
    label: '插槽（slot）',
    slot: 'customSlot',
    placeholder: '插槽不会使用内置控件',
    colSpan: 16
  }
]

const inlineModel = reactive({
  keyword: '',
  type: '',
  time: ''
})

const inlineSchema: ProFormItem[] = [
  { field: 'keyword', label: '关键词', valueType: 'text' },
  {
    field: 'type',
    label: '类型',
    valueType: 'select',
    valueEnum: { A: '类型 A', B: '类型 B' }
  },
  {
    field: 'time',
    label: '时间',
    valueType: 'date',
    componentProps: { clearable: true }
  }
]

function onSubmit(values: Record<string, any>) {
  Object.assign(formModel, values) // 确保外部 model 实时同步
  console.log('submit formModel', { ...formModel })
}
function onReset() {
  console.log('reset formModel', { ...formModel })
}
function onInlineSubmit() {
  // inline 场景保持实时同步：上方 ProForm 会在提交前 emit 最新值
  console.log('submit inlineModel', { ...inlineModel })
}
function onInlineReset() {
  console.log('reset inlineModel', { ...inlineModel })
}
</script>

<style scoped>
.example {
  padding: 16px;
}
.example__desc {
  margin: 6px 0 12px;
  color: #6b7280;
  font-size: 13px;
}
.example__preview {
  margin: 12px 0 20px;
  padding: 10px 12px;
  border: 1px dashed #d1d5db;
  background: #f9fafb;
  border-radius: 6px;
  font-size: 13px;
  color: #4b5563;
}
pre {
  margin: 6px 0 0;
  white-space: pre-wrap;
}
</style>
