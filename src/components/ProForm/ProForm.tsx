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

function isFn(v: any): v is Function {
  return typeof v === 'function'
}

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

/** ✅ 稳定 key：不允许随机 key（否则会重建控件导致输入丢失） */
function itemKey(item: ProFormItem) {
  return (item as any).key || item.field || item.label
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

    /** ✅ show/hidden 支持函数联动 */
    function isVisible(item: ProFormItem) {
      const show = (item as any).show
      const hidden = (item as any).hidden
      const showOk = isFn(show) ? !!show({ model: innerModel }) : show !== false
      const hiddenOk = isFn(hidden) ? !!hidden({ model: innerModel }) : hidden === true
      return showOk && !hiddenOk
    }

    /** ✅ disabled/readonly 支持函数联动 */
    function isDisabled(item: ProFormItem) {
      const d = (item as any).disabled
      return isFn(d) ? !!d({ model: innerModel }) : !!d
    }
    function isReadonly(item: ProFormItem) {
      const r = (item as any).readonly
      return isFn(r) ? !!r({ model: innerModel }) : !!r
    }

    const visibleItems = computed(() => (props.schema ?? []).filter((i) => isVisible(i)))

    function applyDefaults(next: Model) {
      for (const item of props.schema || []) {
        if (!item.field) continue
        if (next[item.field] === undefined && (item as any).defaultValue !== undefined) {
          next[item.field] = (item as any).defaultValue
        }
      }
      return next
    }

    /** ✅ 同步：不 deep watch + 不 delete 清空（避免打断输入/光标抖动） */
    watch(
      () => props.modelValue,
      (v) => {
        const next: Model = applyDefaults({ ...(v || {}) } as any)
        Object.assign(innerModel, next)
      },
      { immediate: true }
    )

    function commitUpdate() {
      emit('update:modelValue', { ...toRaw(innerModel) })
    }

    /** ✅ 关键：实时同步到 v-model（避免父组件拿不到最新值） */
    function updateField(field: string, value: any) {
      innerModel[field] = value
      commitUpdate()
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
      // 已经实时 commit，这里再 commit 也没副作用
      commitUpdate()
      emit('submit', { ...toRaw(innerModel) })
    }

    function reset() {
      const next: Model = {}
      for (const item of props.schema || []) {
        if (!item.field) continue
        next[item.field] = (item as any).defaultValue !== undefined ? (item as any).defaultValue : undefined
      }
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
        disabled: isDisabled(item) || (item.componentProps as any)?.disabled,
        readonly: isReadonly(item) || (item.componentProps as any)?.readonly,
      }

      if (!item.valueType || item.valueType === 'text') {
        return (
          <ElInput
            {...common}
            clearable
            placeholder={item.placeholder ?? `请输入${item.label ?? ''}`}
            onKeydown={(e: KeyboardEvent | Event) => {
              if (e instanceof KeyboardEvent && e.key === 'Enter') {
                onEnter(item)
              }
            }}
          />
        )
      }

      if (item.valueType === 'textarea') {
        return (
          <ElInput
            {...common}
            type="textarea"
            rows={(item as any).rows ?? 3}
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
            options={(item as any).options ?? enumOptions(item)}
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
              const key = itemKey(item)
              if (!key) {
                // 开发期提示：避免随机 key
                console.warn('[ProForm] schema item should have `field` or `key` or `label`:', item)
              }

              const slotName = item.slot
              const fieldSlot = (slots as any)[item.field]
              const namedSlot = slotName ? (slots as any)[slotName] : null

              const renderContent = () => {
                // slot（Vue风格）
                if (namedSlot) {
                  return namedSlot({
                    model: innerModel,
                    field: item.field,
                    item,
                    value: innerModel[item.field],
                    setValue: (val: any) => updateField(item.field, val),
                    disabled: isDisabled(item),
                    readonly: isReadonly(item),
                  })
                }
                if (fieldSlot) {
                  return fieldSlot({
                    model: innerModel,
                    field: item.field,
                    item,
                    value: innerModel[item.field],
                    setValue: (val: any) => updateField(item.field, val),
                    disabled: isDisabled(item),
                    readonly: isReadonly(item),
                  })
                }

                // render（JSX 自由渲染）
                if (typeof item.render === 'function') {
                  // ✅ 兼容旧签名 update(val)
                  const legacyCtx = {
                    model: innerModel,
                    field: item.field,
                    item,
                    update: (val: any) => updateField(item.field, val),
                  }

                  // ✅ 新标准 ctx：value / setValue / disabled / readonly
                  const ctx = {
                    model: innerModel,
                    field: item.field,
                    item,
                    schema: item,
                    value: innerModel[item.field],
                    setValue: (val: any) => updateField(item.field, val),
                    disabled: isDisabled(item),
                    readonly: isReadonly(item),
                    update: (val: any) => updateField(item.field, val), // 仍提供
                  }

                  // 大多数人会用新 ctx，但旧 ctx 也不炸
                  return (item.render as any)(ctx) ?? (item.render as any)(legacyCtx)
                }

                // component（自定义组件）
                if (item.component) {
                  const Comp: any = item.component
                  return (
                    <Comp
                      modelValue={innerModel[item.field]}
                      onUpdate:modelValue={(val: any) => updateField(item.field, val)}
                      {...(item.componentProps || {})}
                      disabled={isDisabled(item)}
                      readonly={isReadonly(item)}
                    />
                  )
                }

                // builtin
                return renderControl(item)
              }

              return (
                <ElCol key={key} span={item.colSpan ?? props.defaultColSpan}>
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
