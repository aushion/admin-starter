import './style.css'
import {
  computed,
  defineComponent,
  nextTick,
  reactive,
  ref,
  watch,
  type PropType,
  useSlots,
} from 'vue'
import { ElDialog, ElButton, ElEmpty } from 'element-plus'
import ProForm, { type ProFormItem, type ProFormModel } from '../ProForm'
import type { ProDialogProps, AnyObj } from './types'

export default defineComponent({
  name: 'ProDialog',
  props: {
    modelValue: { type: Boolean as PropType<ProDialogProps['modelValue']>, required: true },

    title: { type: String, default: '' },
    width: { type: [String, Number], default: '600px' },

    appendToBody: { type: Boolean, default: true },
    destroyOnClose: { type: Boolean, default: false },
    closeOnClickModal: { type: Boolean, default: false },
    closeOnPressEscape: { type: Boolean, default: true },
    draggable: { type: Boolean, default: false },

    showFooter: { type: Boolean, default: true },
    okText: { type: String, default: '保存' },
    cancelText: { type: String, default: '取消' },

    formSchema: { type: Array as PropType<ProFormItem[] | null>, default: null },
    formModel: { type: Object as PropType<ProFormModel | null>, default: null },
    formProps: { type: Object as PropType<AnyObj>, default: () => ({}) },

    dialogProps: { type: Object as PropType<AnyObj>, default: () => ({}) },
  },
  emits: ['update:modelValue', 'submit', 'open', 'close'],
  setup(props, { emit, expose }) {
    const slots = useSlots()

    const visible = computed({
      get: () => props.modelValue,
      set: (v: boolean) => emit('update:modelValue', v),
    })

    const payload = ref<AnyObj | null>(null)
    const submitting = ref(false)

    const computedTitle = computed(() => payload.value?.title ?? props.title)

    const formRef = ref<InstanceType<typeof ProForm> | null>(null)
    const localFormModel = reactive<ProFormModel>({})

    watch(
      () => props.formModel,
      (val) => {
        if (!val) return
        Object.keys(localFormModel).forEach((k) => delete localFormModel[k])
        Object.assign(localFormModel, val)
      },
      { immediate: true, deep: true }
    )

    function open(p?: AnyObj) {
      payload.value = p ?? null
      visible.value = true
      emit('open', payload.value)

      if (props.formSchema && props.formModel) {
        const values = p?.values
        if (values && typeof values === 'object') {
          nextTick(() => {
            Object.keys(localFormModel).forEach((k) => delete localFormModel[k])
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
        if (props.formSchema) {
          const ok = await validate()
          if (!ok) return
        }
        const values = props.formSchema ? { ...localFormModel } : {}
        emit('submit', { values, payload: payload.value })
      } finally {
        submitting.value = false
      }
    }

    expose({
      open,
      close,
      submit,
      validate,
      reset,
      payload,
      submitting,
    })

    const renderForm = () => {
      if (!props.formSchema || !props.formModel) return null

      const forwardedSlots: Record<string, any> = {}
      Object.keys(slots).forEach((name) => {
        if (name === 'default' || name === 'footer' || name === 'empty') return
        forwardedSlots[name] = slots[name]
      })

      return (
        <ProForm
          ref={formRef}
          v-model={localFormModel}
          schema={props.formSchema}
          showActions={false}
          v-slots={forwardedSlots}
          {...props.formProps}
        />
      )
    }

    return () => (
      <ElDialog
        v-model={visible.value}
        title={computedTitle.value}
        width={props.width}
        appendToBody={props.appendToBody}
        destroyOnClose={props.destroyOnClose}
        closeOnClickModal={props.closeOnClickModal}
        closeOnPressEscape={props.closeOnPressEscape}
        draggable={props.draggable}
        {...props.dialogProps}
        onClosed={onClosed}
      >
        <div class="pro-dialog__body">
          {slots.default ? (
            slots.default({ payload: payload.value, close, submit, validate })
          ) : props.formSchema && props.formModel ? (
            renderForm()
          ) : (
            <div class="pro-dialog__empty">
              {slots.empty ? slots.empty() : <ElEmpty description="No content" />}
            </div>
          )}
        </div>

        {props.showFooter && (
          <template #footer>
            {slots.footer ? (
              slots.footer({
                payload: payload.value,
                close,
                submit,
                submitting: submitting.value,
                validate,
                reset,
              })
            ) : (
              <>
                <ElButton onClick={close}>{props.cancelText}</ElButton>
                <ElButton type="primary" loading={submitting.value} onClick={submit}>
                  {props.okText}
                </ElButton>
              </>
            )}
          </template>
        )}
      </ElDialog>
    )
  },
})
