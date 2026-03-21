import type { Directive } from 'vue'
import type { ContextMenuItem, ContextMenuDirectiveValue } from './types'
import { useContextMenu } from './useContextMenu'

function normalize(value: ContextMenuItem[] | ContextMenuDirectiveValue) {
  if (Array.isArray(value)) {
    return { items: value, context: undefined, onSelect: undefined }
  }
  return value
}

export const contextMenuDirective: Directive = {
  mounted(el: HTMLElement, binding) {
    const handler = (event: MouseEvent) => {
      const { items, context, onSelect } = normalize(binding.value)
      useContextMenu().open(event, items, context, onSelect)
    }
    el.addEventListener('contextmenu', handler)
    ;(el as any).__ctxMenuHandler = handler
  },
  updated(el: HTMLElement, binding) {
    if (binding.value === binding.oldValue) return
    const oldHandler = (el as any).__ctxMenuHandler
    if (oldHandler) {
      el.removeEventListener('contextmenu', oldHandler)
    }
    const handler = (event: MouseEvent) => {
      const { items, context, onSelect } = normalize(binding.value)
      useContextMenu().open(event, items, context, onSelect)
    }
    el.addEventListener('contextmenu', handler)
    ;(el as any).__ctxMenuHandler = handler
  },
  beforeUnmount(el: HTMLElement) {
    const handler = (el as any).__ctxMenuHandler
    if (handler) {
      el.removeEventListener('contextmenu', handler)
      delete (el as any).__ctxMenuHandler
    }
  },
}
