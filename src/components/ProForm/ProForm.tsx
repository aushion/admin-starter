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
import type { ProFormItem, ProFormProps, ProFormModel, ProFormOption } from './types'
import { useRemoteOptions } from './useRemoteOptions'

function isFn(v: any): v is Function {
  return typeof v === 'function'
}

/** ✅ 稳定 key：不允许随机 key */
function itemKey(item: ProFormItem, index: number) {
  return (item as any).key || item.field || item.label || `__idx_${index}`
}

// 格式化静态 options / valueEnum
function formatOptions(ve: any): ProFormOption[] {
  if (!ve) return []
  if (Array.isArray(ve)) {
    if (ve.some((o) => Array.isArray((o as any)?.children))) return ve as any
    return ve.map((o) => ({ value: o.value, label: o.label ?? o.text ?? String(o.value) }))
  }
  return Object.keys(ve).map((k) => {
    const v = (ve as any)[k]
    if (typeof v === 'string') return { value: k, label: v }
    if (Array.isArray(v?.children))
      return { value: k, label: v?.label ?? v?.text ?? String(k), children: v.children }
    return { value: k, label: v?.label ?? v?.text ?? String(k) }
  })
}

// 安全获取嵌套值 (如 'user.info.name')
function getValueByPath(obj: Record<string, any>, path: string) {
  if (!path || !path.includes('.')) return obj[path]
  return path
    .split('.')
    .reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj)
}

// 安全设置嵌套值（支持自动创建数组/对象）
function setValueByPath(obj: Record<string, any>, path: string, value: any) {
  if (!path) return
  if (!path.includes('.')) {
    obj[path] = value
    return
  }
  const keys = path.split('.')
  const lastKey = keys.pop()!
  let current = obj as any

  keys.forEach((key, index) => {
    if (current[key] === undefined || current[key] === null) {
      const nextKey = keys[index + 1] || lastKey
      current[key] = !isNaN(Number(nextKey)) ? [] : {}
    }
    current = current[key]
  })
  current[lastKey] = value
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
    const innerModel = reactive<ProFormModel>({})

    let isInitializing = false

    const labelWidthPx = computed(() =>
      typeof props.labelWidth === 'number' ? `${props.labelWidth}px` : props.labelWidth,
    )

    const visibleItems = computed(() =>
      (props.schema ?? []).filter((i) => {
        const showOk = isFn(i.show) ? !!i.show({ model: innerModel }) : i.show !== false
        const hiddenOk = isFn(i.hidden) ? !!i.hidden({ model: innerModel }) : i.hidden === true
        return showOk && !hiddenOk
      }),
    )

    function isDisabled(item: ProFormItem) {
      return isFn(item.disabled) ? !!item.disabled({ model: innerModel }) : !!item.disabled
    }
    function isReadonly(item: ProFormItem) {
      return isFn(item.readonly) ? !!item.readonly({ model: innerModel }) : !!item.readonly
    }

    function commitUpdate() {
      // ✅ 不用 JSON 深拷贝，避免吞 Date/File/undefined/BigInt
      emit('update:modelValue', { ...toRaw(innerModel) })
    }

    function updateField(field: string, value: any) {
      setValueByPath(innerModel, field, value)
      commitUpdate()
    }

    // ✅ 远程 options（抽离）
    const { optionsMap: remoteOptionsMap, loadingMap: remoteLoadingMap } = useRemoteOptions({
      schema: () => props.schema,
      model: innerModel,
      getValueByPath,
      updateField,
      isInitializing: () => isInitializing,
    })

    const getFinalOptions = (item: ProFormItem) => {
      if (remoteOptionsMap[item.field]) return remoteOptionsMap[item.field]
      if (item.options) return formatOptions(item.options)
      return formatOptions(item.valueEnum)
    }

    // ✅ modelValue 回显：不 deep watch + 不 delete 清空（避免打断输入/焦点丢失）
    watch(
      () => props.modelValue,
      (v) => {
        isInitializing = true
        const next: any = v ? { ...(v as any) } : {}

        // 补默认值（只补 schema 顶层，不做递归爆炸）
        for (const item of props.schema || []) {
          if (!item?.field) continue
          const cur = getValueByPath(next, item.field)
          if (cur === undefined && (item as any).defaultValue !== undefined) {
            setValueByPath(next, item.field, (item as any).defaultValue)
          }
        }

        // 温和同步：删除 next 中不存在的顶层 key（可选但推荐）
        for (const k of Object.keys(innerModel)) {
          if (!(k in next)) delete (innerModel as any)[k]
        }
        Object.assign(innerModel, next)

        queueMicrotask(() => (isInitializing = false))
      },
      { immediate: true },
    )

    async function validate() {
      return await formRef.value?.validate()
    }

    function reset() {
      formRef.value?.resetFields()
      emit('reset', { ...toRaw(innerModel) })
    }

    async function submit() {
      const ok = await formRef.value?.validate().catch(() => false)
      if (!ok) return
      commitUpdate()
      emit('submit', { ...toRaw(innerModel) })
    }

    function onEnter(item: ProFormItem) {
      if (props.submitOnEnter) submit()
      emit('enter', { item, model: { ...toRaw(innerModel) } })
    }

    expose({ validate, submit, reset, formRef })

    // 渲染控件
    const renderControl = (item: ProFormItem) => {
      const currentValue = getValueByPath(innerModel, item.field)

      const common: any = {
        modelValue: currentValue,
        'onUpdate:modelValue': (val: any) => updateField(item.field, val),
        ...item.componentProps,
        disabled: isDisabled(item) || (item.componentProps as any)?.disabled,
        readonly: isReadonly(item) || (item.componentProps as any)?.readonly,
      }

      // 1) Slot（item.slot 优先，否则 field 同名）
      const slotName = item.slot || item.field
      const namedSlot = (slots as any)[slotName]
      if (namedSlot) {
        return namedSlot({
          model: innerModel,
          field: item.field,
          item,
          value: currentValue,
          setValue: (val: any) => updateField(item.field, val),
          disabled: common.disabled,
          readonly: common.readonly,
        })
      }

      // 2) Render（JSX）
      if (typeof item.render === 'function') {
        return item.render({
          model: innerModel,
          field: item.field,
          item,
          schema: item,
          value: currentValue,
          setValue: (val: any) => updateField(item.field, val),
          disabled: common.disabled,
          readonly: common.readonly,
          update: (val: any) => updateField(item.field, val),
        })
      }

      // 3) 自定义 Component
      if (item.component) {
        const Comp: any = item.component
        return <Comp {...common} />
      }

      // 4) 内置映射
      const placeholder =
        item.placeholder ??
        `请${
          ['select', 'cascader', 'date', 'datetime'].includes(item.valueType || '')
            ? '选择'
            : '输入'
        }${item.label ?? ''}`

      switch (item.valueType) {
        case 'textarea':
          return (
            <ElInput
              {...common}
              type="textarea"
              rows={(item as any).rows ?? 3}
              placeholder={placeholder}
            />
          )
        case 'select':
          return (
            <ElSelect
              {...common}
              clearable
              loading={remoteLoadingMap[item.field]}
              placeholder={placeholder}
            >
              {(getFinalOptions(item) || []).map((opt: ProFormOption) => (
                <ElOption
                  key={String(opt.value)}
                  label={opt.label}
                  value={opt.value}
                  disabled={opt.disabled}
                />
              ))}
            </ElSelect>
          )
        case 'radio':
          return (
            <ElRadioGroup {...common}>
              {(getFinalOptions(item) || []).map((opt: ProFormOption) => (
                <ElRadio key={String(opt.value)} label={opt.value}>
                  {opt.label}
                </ElRadio>
              ))}
            </ElRadioGroup>
          )
        case 'checkbox':
          return (
            <ElCheckboxGroup {...common}>
              {(getFinalOptions(item) || []).map((opt: ProFormOption) => (
                <ElCheckbox key={String(opt.value)} label={opt.value}>
                  {opt.label}
                </ElCheckbox>
              ))}
            </ElCheckboxGroup>
          )
        case 'switch':
          return <ElSwitch {...common} />
        case 'date':
          return (
            <ElDatePicker
              {...common}
              type="date"
              valueFormat="YYYY-MM-DD"
              clearable
              placeholder={placeholder}
            />
          )
        case 'datetime':
          return (
            <ElDatePicker
              {...common}
              type="datetime"
              valueFormat="YYYY-MM-DD HH:mm:ss"
              clearable
              placeholder={placeholder}
            />
          )
        case 'cascader':
          return (
            <ElCascader
              {...common}
              options={getFinalOptions(item) || []}
              clearable
              placeholder={placeholder}
            />
          )
        case 'text':
        default:
          return (
            <ElInput
              {...common}
              clearable
              placeholder={placeholder}
              onKeyup={(e: KeyboardEvent) => e.key === 'Enter' && onEnter(item)}
            />
          )
      }
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
            {visibleItems.value.map((item, idx) => {
              const key = itemKey(item, idx)

              return (
                <ElCol key={key} span={item.colSpan ?? props.defaultColSpan}>
                  <ElFormItem prop={item.field} rules={item.rules}>
                    {{
                      label: () => {
                        const labelSlotFn = item.labelSlot ? (slots as any)[item.labelSlot] : null
                        return labelSlotFn ? labelSlotFn({ item, model: innerModel }) : item.label
                      },
                      default: () => renderControl(item),
                    }}
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
