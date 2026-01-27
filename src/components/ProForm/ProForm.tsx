import './style.css'
import {
  defineComponent,
  computed,
  reactive,
  ref,
  watch,
  toRaw,
  type PropType,
  useSlots,
} from 'vue'
import {
  ElForm,
  ElRow,
  ElCol,
  ElFormItem,
  ElInput,
  ElSelect,
  ElOption,
  ElRadioGroup,
  ElRadio,
  ElCheckboxGroup,
  ElCheckbox,
  ElSwitch,
  ElDatePicker,
  ElCascader,
  ElButton,
} from 'element-plus'
import type { FormInstance } from 'element-plus'
import type { ProFormItem, ProFormProps, ProFormModel } from './types'

type Model = ProFormModel

function enumOptions(item: ProFormItem): Array<{ value: any; label: string; children?: any[] }> {
  const ve = item.valueEnum
  if (!ve) return []
  if (Array.isArray(ve)) {
    if (ve.some((o) => Array.isArray((o as any)?.children))) return ve as any
    return ve.map((o) => ({ value: o.value, label: o.label ?? o.text ?? String(o.value) }))
  }
  return Object.keys(ve).map((k) => {
    const v = (ve as any)[k]
    if (typeof v === 'string') return { value: k, label: v }
    if (Array.isArray(v?.children)) return { value: k, label: v?.label ?? v?.text ?? String(k), children: v.children }
    return { value: k, label: v?.label ?? v?.text ?? String(k) }
  })
}

function itemKey(item: ProFormItem) {
  return item.field || item.label || Math.random().toString(36).slice(2)
}

export default defineComponent({
  name: 'ProForm',
  props: {
    modelValue: { type: Object as PropType<ProFormProps['modelValue']>, required: true },
    schema: { type: Array as PropType<ProFormProps['schema']>, required: true },
    layout: { type: String as PropType<ProFormProps['layout']>, default: 'horizontal' },
    labelWidth: { type: [Number, String] as PropType<ProFormProps['labelWidth']>, default: 100 },
    gutter: { type: Number, default: 16 },
    defaultColSpan: { type: Number, default: 8 },
    showActions: { type: Boolean, default: true },
    submitText: { type: String, default: '提交' },
    resetText: { type: String, default: '重置' },
    submitOnEnter: { type: Boolean, default: false },
    formProps: { type: Object as PropType<ProFormProps['formProps']>, default: () => ({}) },
  },
  emits: ['update:modelValue', 'submit', 'reset', 'enter'],
  setup(props, { emit, expose }) {
    const slots = useSlots()
    const formRef = ref<FormInstance>()
    const innerModel = reactive<Model>({})

    const labelWidthPx = computed(() =>
      typeof props.labelWidth === 'number' ? `${props.labelWidth}px` : props.labelWidth
    )

    const visibleItems = computed(() =>
      (props.schema ?? []).filter((i) => i.show !== false && i.hidden !== true)
    )

    function syncFromModelValue() {
      const next: Model = { ...(props.modelValue || {}) }
      for (const item of props.schema || []) {
        if (!item.field) continue
        if (next[item.field] === undefined && item.defaultValue !== undefined) {
          next[item.field] = item.defaultValue
        }
      }
      Object.keys(innerModel).forEach((k) => delete innerModel[k])
      Object.assign(innerModel, next)
    }

    watch(
      () => props.modelValue,
      syncFromModelValue,
      { immediate: true, deep: true }
    )

    function commitUpdate() {
      emit('update:modelValue', { ...toRaw(innerModel) })
    }

    function updateField(field: string, value: any) {
      innerModel[field] = value
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
      Object.keys(innerModel).forEach((k) => delete innerModel[k])
      Object.assign(innerModel, next)
      formRef.value?.clearValidate()
      commitUpdate()
      emit('reset', { ...toRaw(innerModel) })
    }

    expose({ validate, submit, reset, formRef })

    const renderControl = (item: ProFormItem) => {
      const common = {
        modelValue: innerModel[item.field],
        'onUpdate:modelValue': (val: any) => updateField(item.field, val),
        ...item.componentProps,
      }

      // 优先 slot 与自定义组件在 JSX 外处理

      if (!item.valueType || item.valueType === 'text') {
        return (
          <ElInput
            {...common}
            clearable
            placeholder={item.placeholder ?? `请输入${item.label ?? ''}`}
            onKeyup={(e: KeyboardEvent) => e.key === 'Enter' && onEnter(item)}
          />
        )
      }

      if (item.valueType === 'textarea') {
        return (
          <ElInput
            {...common}
            type="textarea"
            rows={item.rows ?? 3}
            placeholder={item.placeholder ?? `请输入${item.label ?? ''}`}
          />
        )
      }

      if (item.valueType === 'select') {
        return (
          <ElSelect
            {...common}
            clearable
            placeholder={item.placeholder ?? `请选择${item.label ?? ''}`}
          >
            {enumOptions(item).map((opt) => (
              <ElOption key={String(opt.value)} label={opt.label} value={opt.value} />
            ))}
          </ElSelect>
        )
      }

      if (item.valueType === 'radio') {
        return (
          <ElRadioGroup {...common}>
            {enumOptions(item).map((opt) => (
              <ElRadio key={String(opt.value)} label={opt.value}>
                {opt.label}
              </ElRadio>
            ))}
          </ElRadioGroup>
        )
      }

      if (item.valueType === 'checkbox') {
        return (
          <ElCheckboxGroup {...common}>
            {enumOptions(item).map((opt) => (
              <ElCheckbox key={String(opt.value)} label={opt.value}>
                {opt.label}
              </ElCheckbox>
            ))}
          </ElCheckboxGroup>
        )
      }

      if (item.valueType === 'switch') {
        return <ElSwitch {...common} />
      }

      if (item.valueType === 'date') {
        return (
          <ElDatePicker
            {...common}
            type="date"
            valueFormat="YYYY-MM-DD"
            clearable
            placeholder={item.placeholder ?? `请选择${item.label ?? ''}`}
          />
        )
      }

      if (item.valueType === 'datetime') {
        return (
          <ElDatePicker
            {...common}
            type="datetime"
            valueFormat="YYYY-MM-DD HH:mm:ss"
            clearable
            placeholder={item.placeholder ?? `请选择${item.label ?? ''}`}
          />
        )
      }

      if (item.valueType === 'cascader') {
        return (
          <ElCascader
            {...common}
            options={item.options ?? enumOptions(item)}
            clearable
            placeholder={item.placeholder ?? `请选择${item.label ?? ''}`}
          />
        )
      }

      return (
        <ElInput
          {...common}
          clearable
          placeholder={item.placeholder ?? `请输入${item.label ?? ''}`}
        />
      )
    }

    return () => (
      <div class="pro-form">
        <ElForm
          ref={formRef}
          model={innerModel}
          inline={props.layout === 'inline'}
          labelWidth={labelWidthPx.value as any}
          {...(props.formProps || {})}
        >
          <ElRow gutter={props.gutter}>
            {visibleItems.value.map((item) => {
              const slotName = item.slot
              const fieldSlot = (slots as any)[item.field]
              const namedSlot = slotName ? (slots as any)[slotName] : null

              const renderContent = () => {
                if (namedSlot) return namedSlot({ model: innerModel, field: item.field, item })
                if (fieldSlot) return fieldSlot({ model: innerModel, field: item.field, item })

                if (item.component) {
                  const Comp: any = item.component
                  return (
                    <Comp
                      modelValue={innerModel[item.field]}
                      onUpdate:modelValue={(val: any) => updateField(item.field, val)}
                      {...(item.componentProps || {})}
                    />
                  )
                }

                return renderControl(item)
              }

              return (
                <ElCol key={itemKey(item)} span={item.colSpan ?? props.defaultColSpan}>
                  <ElFormItem label={item.label} prop={item.field} rules={item.rules}>
                    {renderContent()}
                  </ElFormItem>
                </ElCol>
              )
            })}
          </ElRow>

          {props.showActions && (
            <div class="pro-form__actions">
              {slots.actions ? (
                slots.actions({ submit, reset, model: innerModel })
              ) : (
                <>
                  <ElButton type="primary" onClick={submit}>
                    {props.submitText}
                  </ElButton>
                  <ElButton onClick={reset}>{props.resetText}</ElButton>
                </>
              )}
            </div>
          )}
        </ElForm>
      </div>
    )
  },
})
