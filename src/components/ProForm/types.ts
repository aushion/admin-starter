export type ProFormModel = Record<string, any>

export type ProFormLayout = 'horizontal' | 'inline'

export type ProValueType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'switch'
  | 'date'
  | 'datetime'
  | 'cascader'

export type ProFormOption = {
  label: string
  value: any
  children?: ProFormOption[]
  disabled?: boolean
}

export type ProFormItem = {
  /** 必填：字段名，支持 path：a.b.c */
  field: string
  label?: string

  valueType?: ProValueType
  placeholder?: string
  colSpan?: number
  defaultValue?: any

  show?: boolean | ((ctx: { model: ProFormModel }) => boolean)
  hidden?: boolean | ((ctx: { model: ProFormModel }) => boolean)
  disabled?: boolean | ((ctx: { model: ProFormModel }) => boolean)
  readonly?: boolean | ((ctx: { model: ProFormModel }) => boolean)

  rules?: any

  /** 插槽名：默认 item.slot || item.field */
  slot?: string
  /** label 插槽名 */
  labelSlot?: string

  /** JSX render */
  render?: (ctx: {
    model: ProFormModel
    field: string
    item: ProFormItem
    schema: ProFormItem
    value: any
    setValue: (val: any) => void
    disabled?: boolean
    readonly?: boolean
    update: (val: any) => void
  }) => any

  /** 自定义组件 */
  component?: any
  componentProps?: Record<string, any>

  /** 静态 options */
  options?: any
  valueEnum?: any

  /** ✅ 远程 options */
  request?: (ctx: { model: ProFormModel }) => Promise<any>
  dependencies?: string[]
  clearOnDependenciesChange?: boolean | ((ctx: { model: ProFormModel }) => boolean)

  /** ✅ 将 request 返回值转换为 ProFormOption[] */
  transformOptions?: (raw: any, ctx: { model: ProFormModel; item: ProFormItem }) => ProFormOption[]
}

export type ProFormProps = {
  modelValue: ProFormModel
  schema: ProFormItem[]
  layout?: ProFormLayout
  labelWidth?: number | string
  gutter?: number
  defaultColSpan?: number
  showActions?: boolean
  submitText?: string
  resetText?: string
  submitOnEnter?: boolean
  formProps?: Record<string, any>
}
