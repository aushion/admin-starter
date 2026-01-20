<template>
  <div class="pro-form">
    <el-form
      ref="formRef"
      :model="innerModel"
      :inline="layout === 'inline'"
      :label-width="labelWidthPx"
      v-bind="formProps"
    >
      <el-row :gutter="gutter">
        <el-col
          v-for="item in visibleItems"
          :key="itemKey(item)"
          :span="item.colSpan ?? defaultColSpan"
        >
          <el-form-item  :label="item.label" :prop="item.field" :rules="item.rules">
            <!-- 1) schema.slot -->
            <slot
              v-if="item.slot && $slots[item.slot]"
              :name="item.slot"
              :model="innerModel"
              :field="item.field"
              :item="item"
            />
            <!-- 2) field 同名插槽 -->
            <slot
              v-else-if="$slots[item.field]"
              :name="item.field"
              :model="innerModel"
              :field="item.field"
              :item="item"
            />
            <!-- 3) 自定义组件 -->
            <component
              v-else-if="item.component"
              :is="item.component"
              v-model="innerModel[item.field]"
              v-bind="item.componentProps"
            />
            <!-- 4) 内置控件 -->
            <template v-else>
              <el-input
                v-if="!item.valueType || item.valueType === 'text'"
                v-model="innerModel[item.field]"
                v-bind="item.componentProps"
                :placeholder="item.placeholder ?? `请输入${item.label ?? ''}`"
                @keyup.enter="onEnter(item)"
                clearable
              />
              <el-input
                v-else-if="item.valueType === 'textarea'"
                v-model="innerModel[item.field]"
                type="textarea"
                :rows="item.rows ?? 3"
                v-bind="item.componentProps"
                :placeholder="item.placeholder ?? `请输入${item.label ?? ''}`"
              />
              <el-select
                v-else-if="item.valueType === 'select'"
                v-model="innerModel[item.field]"
                v-bind="item.componentProps"
                :placeholder="item.placeholder ?? `请选择${item.label ?? ''}`"
                clearable
              >
                <el-option
                  v-for="opt in enumOptions(item)"
                  :key="String(opt.value)"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
              <el-radio-group
                v-else-if="item.valueType === 'radio'"
                v-model="innerModel[item.field]"
                v-bind="item.componentProps"
              >
                <el-radio
                  v-for="opt in enumOptions(item)"
                  :key="String(opt.value)"
                  :label="opt.value"
                >
                  {{ opt.label }}
                </el-radio>
              </el-radio-group>
              <el-checkbox-group
                v-else-if="item.valueType === 'checkbox'"
                v-model="innerModel[item.field]"
                v-bind="item.componentProps"
              >
                <el-checkbox
                  v-for="opt in enumOptions(item)"
                  :key="String(opt.value)"
                  :label="opt.value"
                >
                  {{ opt.label }}
                </el-checkbox>
              </el-checkbox-group>
              <el-switch
                v-else-if="item.valueType === 'switch'"
                v-model="innerModel[item.field]"
                v-bind="item.componentProps"
              />
              <el-date-picker
                v-else-if="item.valueType === 'date'"
                v-model="innerModel[item.field]"
                type="date"
                value-format="YYYY-MM-DD"
                v-bind="item.componentProps"
                :placeholder="item.placeholder ?? `请选择${item.label ?? ''}`"
                clearable
              />
              <el-date-picker
                v-else-if="item.valueType === 'datetime'"
                v-model="innerModel[item.field]"
                type="datetime"
                value-format="YYYY-MM-DD HH:mm:ss"
                v-bind="item.componentProps"
                :placeholder="item.placeholder ?? `请选择${item.label ?? ''}`"
                clearable
              />
              <el-cascader
                v-else-if="item.valueType === 'cascader'"
                v-model="innerModel[item.field]"
                :options="item.options ?? enumOptions(item)"
                v-bind="item.componentProps"
                :placeholder="item.placeholder ?? `请选择${item.label ?? ''}`"
                clearable
              />
              <el-input
                v-else
                v-model="innerModel[item.field]"
                v-bind="item.componentProps"
                :placeholder="item.placeholder ?? `请输入${item.label ?? ''}`"
                clearable
              />
            </template>
          </el-form-item>
        </el-col>
      </el-row>

      <div v-if="showActions" class="pro-form__actions">
        <slot name="actions" :submit="submit" :reset="reset" :model="innerModel">
          <el-button type="primary" @click="submit">{{ submitText }}</el-button>
          <el-button @click="reset">{{ resetText }}</el-button>
        </slot>
      </div>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch, toRaw } from 'vue'
import type { FormInstance, FormProps, FormItemRule } from 'element-plus'

export type ValueEnum =
  | Record<string | number, string | { label?: string; text?: string; status?: string }>
  | Array<{ value: any; label?: string; text?: string; status?: string; children?: any[] }>

export type ProFormValueType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'switch'
  | 'date'
  | 'datetime'
  | 'cascader'

export interface ProFormItem {
  field: string
  label?: string
  valueType?: ProFormValueType
  valueEnum?: ValueEnum
  rules?: FormItemRule[] | FormItemRule
  placeholder?: string
  colSpan?: number
  show?: boolean
  hidden?: boolean
  defaultValue?: any
  rows?: number

  // 覆盖渲染
  slot?: string
  component?: any
  componentProps?: Record<string, any>
  options?: any[] // 级联/选择等可直接传 options
}

type Model = Record<string, any>

const props = withDefaults(defineProps<{
  modelValue: Model
  schema: ProFormItem[]
  layout?: 'horizontal' | 'inline'
  labelWidth?: number | string
  gutter?: number
  defaultColSpan?: number
  showActions?: boolean
  submitText?: string
  resetText?: string
  submitOnEnter?: boolean
  formProps?: Partial<FormProps>
}>(), {
  layout: 'horizontal',
  labelWidth: 100,
  gutter: 16,
  defaultColSpan: 8,
  showActions: true,
  submitText: '提交',
  resetText: '重置',
  submitOnEnter: false,
  formProps: () => ({})
})

const emit = defineEmits<{
  (e: 'update:modelValue', v: Model): void
  (e: 'submit', v: Model): void
  (e: 'reset', v: Model): void
  (e: 'enter', payload: { item: ProFormItem; model: Model }): void
}>()

const formRef = ref<FormInstance>()

const innerModel = reactive<Model>({})

const labelWidthPx = computed(() =>
  typeof props.labelWidth === 'number' ? `${props.labelWidth}px` : props.labelWidth
)

const visibleItems = computed(() =>
  (props.schema ?? []).filter(i => i.show !== false && i.hidden !== true)
)

function itemKey(item: ProFormItem) {
  return item.field || item.label || Math.random().toString(36).slice(2)
}

function enumOptions(item: ProFormItem): Array<{ value: any; label: string; children?: any[] }> {
  const ve = item.valueEnum
  if (!ve) return []
  if (Array.isArray(ve)) {
    // 级联等需要 children 结构时直接透传
    if (ve.some(o => Array.isArray((o as any)?.children))) return ve as any
    return ve.map(o => ({ value: o.value, label: (o.label ?? o.text ?? String(o.value)) }))
  }
  return Object.keys(ve).map(k => {
    const v = (ve as any)[k]
    if (typeof v === 'string') return { value: k, label: v }
    if (Array.isArray(v?.children)) return { value: k, label: v?.label ?? v?.text ?? String(k), children: v.children }
    return { value: k, label: v?.label ?? v?.text ?? String(k) }
  })
}

function syncFromModelValue() {
  const next: Model = { ...(props.modelValue || {}) }
  for (const item of props.schema || []) {
    if (!item.field) continue
    if (next[item.field] === undefined && item.defaultValue !== undefined) {
      next[item.field] = item.defaultValue
    }
  }
  // 覆盖 reactive
  Object.keys(innerModel).forEach(k => delete innerModel[k])
  Object.assign(innerModel, next)
}

watch(() => props.modelValue, syncFromModelValue, { immediate: true, deep: true })

function commitUpdate() {
  emit('update:modelValue', { ...toRaw(innerModel) })
}

function onEnter(item: ProFormItem) {
  if (props.submitOnEnter) submit()
  emit('enter', { item, model: { ...toRaw(innerModel) } })
}

async function validate() {
  return await formRef.value?.validate()
}

async function submit() {
  const ok = await formRef.value?.validate().catch(() => false)
  if (!ok) return
  commitUpdate()
  emit('submit', { ...toRaw(innerModel) })
}

function reset() {
  const next: Model = {}
  for (const item of props.schema || []) {
    if (!item.field) continue
    next[item.field] = item.defaultValue !== undefined ? item.defaultValue : undefined
  }
  Object.keys(innerModel).forEach(k => delete innerModel[k])
  Object.assign(innerModel, next)
  formRef.value?.clearValidate()
  commitUpdate()
  emit('reset', { ...toRaw(innerModel) })
}

// 给外部 ref 使用
defineExpose({
  validate,
  submit,
  reset,
  formRef
})
</script>

<style scoped>
.pro-form__actions {
  margin-top: 8px;
}
</style>
