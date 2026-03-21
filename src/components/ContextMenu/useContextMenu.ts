import { ref } from 'vue'
import type { ContextMenuItem, SelectHandler } from './types'

// Global singleton state — shared across all useContextMenu() calls
const visible = ref(false)
const position = ref({ x: 0, y: 0 })
const items = ref<ContextMenuItem[]>([])
const context = ref<any>(null)
const onSelectHandler = ref<SelectHandler | null>(null)

function open(
  event: MouseEvent,
  menuItems: ContextMenuItem[],
  ctx?: any,
  onSelect?: SelectHandler,
) {
  event.preventDefault()
  event.stopPropagation()

  items.value = menuItems
  context.value = ctx ?? null
  onSelectHandler.value = onSelect ?? null
  position.value = { x: event.clientX, y: event.clientY }
  visible.value = true
}

function close() {
  visible.value = false
  items.value = []
  context.value = null
  onSelectHandler.value = null
}

function handleSelect(key: string) {
  onSelectHandler.value?.(key, context.value)
  close()
}

export function useContextMenu() {
  return {
    visible,
    position,
    items,
    context,
    onSelectHandler,
    open,
    close,
    handleSelect,
  }
}
