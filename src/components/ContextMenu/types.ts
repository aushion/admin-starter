import type { VNode } from 'vue'

export interface ContextMenuItem<T = any> {
  key: string
  label: string
  icon?: string
  shortcut?: string
  disabled?: boolean | ((context: T) => boolean)
  hidden?: boolean | ((context: T) => boolean)
  children?: ContextMenuItem<T>[]
  render?: (context: T) => VNode
  divided?: boolean
}

export type SelectHandler = (key: string, context: any) => void

export interface ContextMenuDirectiveValue {
  items: ContextMenuItem[]
  context?: any
  onSelect?: SelectHandler
}
