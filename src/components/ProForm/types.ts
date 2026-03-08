import type { FormItemRule, FormProps } from 'element-plus'

export type ValueEnum =
  | Record<string | number, string | { label?: string; text?: string; status?: string; children?: any[] }>
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

  slot?: string
  component?: any
  componentProps?: Record<string, any>
  options?: any[]
  render?: (ctx: {
    model: ProFormModel
    field: string
    item: ProFormItem
    update: (val: any) => void
  }) => any
}

export type ProFormModel = Record<string, any>

export interface ProFormProps {
  modelValue: ProFormModel
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
}
