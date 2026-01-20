<template>
  <el-dialog
    v-model="visible"
    :title="computedTitle"
    :width="width"
    :append-to-body="appendToBody"
    :close-on-click-modal="closeOnClickModal"
    :close-on-press-escape="closeOnPressEscape"
    :destroy-on-close="destroyOnClose"
    :draggable="draggable"
    v-bind="dialogProps"
    @closed="onClosed"
  >
    <!-- 内容区：优先 slot，其次内置 ProForm -->
    <div class="pro-dialog__body">
      <slot
        v-if="$slots.default"
        :payload="payload"
        :close="close"
        :submit="submit"
        :validate="validate"
      />
      <ProForm
        v-else-if="formSchema && formModel"
        ref="formRef"
        v-model="localFormModel"
        :schema="formSchema"
        :show-actions="false"
        v-bind="formProps"
      >
        <!-- 透传 ProForm 的字段插槽 -->
        <template v-for="(_, name) in $slots" #[name]="slotProps">
          <slot :name="name" v-bind="slotProps" />
        </template>
      </ProForm>
      <div v-else class="pro-dialog__empty">
        <slot name="empty">
          <el-empty description="No content" />
        </slot>
      </div>
    </div>

    <!-- Footer -->
    <template v-if="showFooter" #footer>
      <slot
        name="footer"
        :payload="payload"
        :close="close"
        :submit="submit"
        :submitting="submitting"
        :validate="validate"
        :reset="reset"
      >
        <el-button @click="close">{{ cancelText }}</el-button>
        <el-button type="primary" :loading="submitting" @click="submit">
          {{ okText }}
        </el-button>
      </slot>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import type { FormInstance } from 'element-plus'
import ProForm, { type ProFormItem } from './ProForm.vue'

type AnyObj = Record<string, any>

const props = withDefaults(defineProps<{
  modelValue: boolean

  title?: string
  width?: string | number

  // dialog 行为
  appendToBody?: boolean
  destroyOnClose?: boolean
  closeOnClickModal?: boolean
  closeOnPressEscape?: boolean
  draggable?: boolean

  // footer
  showFooter?: boolean
  okText?: string
  cancelText?: string

  // 表单模式（可选）
  formSchema?: ProFormItem[] | null
  formModel?: AnyObj | null // 外部表单数据（用于初始化）
  formProps?: AnyObj

  // 自定义额外 props 透传给 el-dialog
  dialogProps?: AnyObj
}>(), {
  title: '',
  width: '600px',

  appendToBody: true,
  destroyOnClose: false,
  closeOnClickModal: false,
  closeOnPressEscape: true,
  draggable: false,

  showFooter: true,
  okText: '保存',
  cancelText: '取消',

  formSchema: null,
  formModel: null,
  formProps: () => ({}),

  dialogProps: () => ({})
})

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void

  // 表单模式时：提交成功会 emit
  (e: 'submit', payload: { values: AnyObj; payload: AnyObj | null }): void

  // 通用钩子
  (e: 'open', payload: AnyObj | null): void
  (e: 'close', payload: AnyObj | null): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const payload = ref<AnyObj | null>(null)
const submitting = ref(false)

const computedTitle = computed(() => {
  // 如果 open(payload) 传了 title，也可以动态覆盖
  return payload.value?.title ?? props.title
})

// 内置表单
const formRef = ref<InstanceType<typeof ProForm> | null>(null)
const localFormModel = reactive<AnyObj>({})

watch(
  () => props.formModel,
  (val) => {
    // 外部变化时同步一份，避免直接改 props
    if (!val) return
    Object.keys(localFormModel).forEach(k => delete localFormModel[k])
    Object.assign(localFormModel, val)
  },
  { immediate: true, deep: true }
)

function open(p?: AnyObj) {
  payload.value = p ?? null
  visible.value = true
  emit('open', payload.value)

  // 如果 open 时传了 values，则覆盖表单初值
  if (props.formSchema && props.formModel) {
    const values = p?.values
    if (values && typeof values === 'object') {
      nextTick(() => {
        Object.keys(localFormModel).forEach(k => delete localFormModel[k])
        Object.assign(localFormModel, { ...props.formModel, ...values })
      })
    }
  }
}

function close() {
  visible.value = false
}

function onClosed() {
  submitting.value = false
  emit('close', payload.value)
  payload.value = null
  // 可选：关闭后清空校验/回填默认
  nextTick(() => {
    formRef.value?.formRef?.clearValidate?.()
  })
}

async function validate() {
  if (!props.formSchema) return true
  const ok = await formRef.value?.validate?.().catch(() => false)
  return !!ok
}

function reset() {
  if (!props.formSchema) return
  formRef.value?.reset?.()
}

async function submit() {
  if (submitting.value) return
  try {
    submitting.value = true

    // 表单模式：先校验
    if (props.formSchema) {
      const ok = await validate()
      if (!ok) return
    }

    // 抛出 submit 事件，让外部做保存（同步/异步都可）
    const values = props.formSchema ? { ...localFormModel } : {}
    emit('submit', { values, payload: payload.value })

    // 如果你希望：外部保存成功后再 close，就让外部控制 visible
    // 这里默认：submit 触发后不自动关，由外部决定
  } finally {
    submitting.value = false
  }
}

// 对外暴露方法（ref 调用）
defineExpose({
  open,
  close,
  submit,
  validate,
  reset,
  payload,
  submitting
})
</script>

<style scoped>
.pro-dialog__body {
  min-height: 40px;
}
.pro-dialog__empty {
  padding: 12px 0;
}
</style>
