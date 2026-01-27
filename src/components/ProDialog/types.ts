import type { ProFormItem, ProFormModel } from '../ProForm'

export type AnyObj = Record<string, any>

export interface ProDialogProps {
  modelValue: boolean

  title?: string
  width?: string | number

  appendToBody?: boolean
  destroyOnClose?: boolean
  closeOnClickModal?: boolean
  closeOnPressEscape?: boolean
  draggable?: boolean

  showFooter?: boolean
  okText?: string
  cancelText?: string

  formSchema?: ProFormItem[] | null
  formModel?: ProFormModel | null
  formProps?: AnyObj

  dialogProps?: AnyObj
}

export interface ProDialogExpose {
  open: (payload?: AnyObj) => void
  close: () => void
  submit: () => Promise<void> | void
  validate: () => Promise<boolean>
  reset: () => void
  payload: import('vue').Ref<AnyObj | null>
  submitting: import('vue').Ref<boolean>
}
