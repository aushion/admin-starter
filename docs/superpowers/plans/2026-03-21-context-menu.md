# ContextMenu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a general-purpose right-click context menu component with three API layers (composable, component, directive).

**Architecture:** Global singleton composable manages state, a Vue component renders the menu via Teleport to `<body>`, and a directive provides syntactic sugar. The menu auto-positions to avoid viewport edges, supports submenus, icons, shortcuts, dynamic disable/hide, and custom render.

**Tech Stack:** Vue 3 (SFC `<script setup>`), TypeScript, Element Plus CSS variables, UnoCSS icons

**Spec:** `docs/superpowers/specs/2026-03-21-context-menu-design.md`

---

## File Map

| File                                             | Responsibility                                                                                                                                                |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/ContextMenu/types.ts`            | `ContextMenuItem<T>`, `SelectHandler`, directive value types                                                                                                  |
| `src/components/ContextMenu/useContextMenu.ts`   | Global singleton state (`visible`, `position`, `items`, `context`), `open()`, `close()`, `handleSelect()`                                                     |
| `src/components/ContextMenu/ContextMenuItem.vue` | Single menu item: icon, label, shortcut, divider, disabled state, submenu expand on hover with 150ms delay, custom render                                     |
| `src/components/ContextMenu/ContextMenu.vue`     | Root menu container: Teleport to body, boundary-aware positioning, recursive ContextMenuItem rendering, ARIA roles, global event listeners, select event flow |
| `src/components/ContextMenu/directive.ts`        | `v-context-menu` directive: mounted/updated/beforeUnmount lifecycle, normalizes value to `{ items, context, onSelect }`                                       |
| `src/components/ContextMenu/style.css`           | All styles using Element Plus CSS variables, BEM naming, dark mode support                                                                                    |
| `src/components/ContextMenu/index.ts`            | Re-exports: `useContextMenu`, `ContextMenu` (component), `contextMenuDirective`, all types                                                                    |
| `src/App.vue`                                    | Mount `<ContextMenu />` globally                                                                                                                              |
| `src/main.ts`                                    | Register `v-context-menu` directive                                                                                                                           |

---

### Task 1: Types

**Files:**

- Create: `src/components/ContextMenu/types.ts`

- [ ] **Step 1: Create types file**

```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ContextMenu/types.ts
git commit -m "feat(context-menu): add type definitions"
```

---

### Task 2: Composable — `useContextMenu`

**Files:**

- Create: `src/components/ContextMenu/useContextMenu.ts`

- [ ] **Step 1: Implement singleton composable**

```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ContextMenu/useContextMenu.ts
git commit -m "feat(context-menu): add useContextMenu composable"
```

---

### Task 3: Styles

**Files:**

- Create: `src/components/ContextMenu/style.css`

- [ ] **Step 1: Create styles with Element Plus CSS variables**

```css
.context-menu {
  position: fixed;
  z-index: var(--el-popup-z-index, 2000);
  min-width: 160px;
  padding: 4px 0;
  background-color: var(--el-bg-color-overlay, #fff);
  border: 1px solid var(--el-border-color-lighter, #e4e7ed);
  border-radius: var(--el-border-radius-base, 4px);
  box-shadow: var(--el-box-shadow-light, 0 2px 12px rgba(0, 0, 0, 0.1));
  user-select: none;
  max-height: calc(100vh - 20px);
  overflow-y: auto;
}

.context-menu__item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  font-size: var(--el-font-size-base, 14px);
  color: var(--el-text-color-primary, #303133);
  cursor: pointer;
  line-height: 1.4;
  white-space: nowrap;
}

.context-menu__item:hover {
  background-color: var(--el-fill-color-light, #f5f7fa);
}

.context-menu__item--disabled {
  color: var(--el-text-color-placeholder, #a8abb2);
  cursor: not-allowed;
}

.context-menu__item--disabled:hover {
  background-color: transparent;
}

.context-menu__item--has-children::after {
  content: '';
  margin-left: auto;
  border: 4px solid transparent;
  border-left-color: var(--el-text-color-secondary, #909399);
}

.context-menu__icon {
  font-size: 16px;
  flex-shrink: 0;
}

.context-menu__label {
  flex: 1;
}

.context-menu__shortcut {
  margin-left: 24px;
  font-size: 12px;
  color: var(--el-text-color-secondary, #909399);
  flex-shrink: 0;
}

.context-menu__divider {
  height: 1px;
  margin: 4px 0;
  background-color: var(--el-border-color-lighter, #e4e7ed);
}

.context-menu__submenu {
  position: absolute;
  top: -4px;
  left: 100%;
  overflow-y: visible;
}

.context-menu__submenu--left {
  left: auto;
  right: 100%;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ContextMenu/style.css
git commit -m "feat(context-menu): add styles"
```

---

### Task 4: ContextMenuItem component

**Files:**

- Create: `src/components/ContextMenu/ContextMenuItem.vue`

- [ ] **Step 1: Create ContextMenuItem.vue**

```vue
<template>
  <template v-if="!isHidden">
    <div
      :class="itemClasses"
      role="menuitem"
      :aria-disabled="isDisabled || undefined"
      @click.stop="onClick"
      @mouseenter="onMouseEnter"
      @mouseleave="onMouseLeave"
    >
      <!-- Custom render replaces everything -->
      <template v-if="item.render">
        <component :is="() => item.render!(context)" />
      </template>
      <!-- Default: icon + label + shortcut -->
      <template v-else>
        <span v-if="item.icon" :class="['context-menu__icon', item.icon]" />
        <span class="context-menu__label">{{ item.label }}</span>
        <span v-if="item.shortcut" class="context-menu__shortcut">{{ item.shortcut }}</span>
      </template>
    </div>

    <!-- Divider below item -->
    <div v-if="item.divided" class="context-menu__divider" />

    <!-- Submenu (recursive) -->
    <div
      v-if="hasChildren && showSubmenu"
      ref="submenuRef"
      :class="[
        'context-menu',
        'context-menu__submenu',
        { 'context-menu__submenu--left': flipLeft },
      ]"
      role="menu"
      @mouseenter="onSubmenuEnter"
      @mouseleave="onMouseLeave"
    >
      <ContextMenuItem
        v-for="child in visibleChildren"
        :key="child.key"
        :item="child"
        :context="context"
        @select="(key: string) => emit('select', key)"
      />
    </div>
  </template>
</template>

<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'
import type { ContextMenuItem as MenuItemType } from './types'

const props = defineProps<{
  item: MenuItemType
  context: any
}>()

const emit = defineEmits<{
  select: [key: string]
}>()

const showSubmenu = ref(false)
const flipLeft = ref(false)
const submenuRef = ref<HTMLElement>()
let closeTimer: ReturnType<typeof setTimeout> | null = null

const hasChildren = computed(
  () => Array.isArray(props.item.children) && props.item.children.length > 0,
)

const isHidden = computed(() => {
  const h = props.item.hidden
  if (typeof h === 'function') return h(props.context)
  return !!h
})

const isDisabled = computed(() => {
  const d = props.item.disabled
  if (typeof d === 'function') return d(props.context)
  return !!d
})

const visibleChildren = computed(() => {
  if (!props.item.children) return []
  return props.item.children.filter((child) => {
    const h = child.hidden
    if (typeof h === 'function') return !h(props.context)
    return !h
  })
})

const itemClasses = computed(() => [
  'context-menu__item',
  {
    'context-menu__item--disabled': isDisabled.value,
    'context-menu__item--has-children': hasChildren.value,
  },
])

function clearCloseTimer() {
  if (closeTimer) {
    clearTimeout(closeTimer)
    closeTimer = null
  }
}

function onClick() {
  if (isDisabled.value) return
  if (hasChildren.value) {
    // Toggle submenu on click
    showSubmenu.value = !showSubmenu.value
    return
  }
  emit('select', props.item.key)
}

async function onMouseEnter() {
  clearCloseTimer()
  if (hasChildren.value) {
    showSubmenu.value = true
    await nextTick()
    checkSubmenuFlip()
  }
}

function onSubmenuEnter() {
  clearCloseTimer()
}

function onMouseLeave() {
  if (hasChildren.value) {
    closeTimer = setTimeout(() => {
      showSubmenu.value = false
      flipLeft.value = false
    }, 150)
  }
}

function checkSubmenuFlip() {
  if (!submenuRef.value) return
  const rect = submenuRef.value.getBoundingClientRect()
  flipLeft.value = rect.right > window.innerWidth
}
</script>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ContextMenu/ContextMenuItem.vue
git commit -m "feat(context-menu): add ContextMenuItem component"
```

---

### Task 5: ContextMenu root component

**Files:**

- Create: `src/components/ContextMenu/ContextMenu.vue`

- [ ] **Step 1: Create ContextMenu.vue**

```vue
<template>
  <Teleport to="body">
    <div v-if="visible" ref="menuRef" class="context-menu" role="menu" :style="menuStyle">
      <ContextMenuItem
        v-for="item in visibleItems"
        :key="item.key"
        :item="item"
        :context="context"
        @select="onItemSelect"
      />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick, onBeforeUnmount } from 'vue'
import { useContextMenu } from './useContextMenu'
import ContextMenuItem from './ContextMenuItem.vue'
import './style.css'

const emit = defineEmits<{
  select: [key: string, context: any]
}>()

const { visible, position, items, context, handleSelect } = useContextMenu()

const menuRef = ref<HTMLElement>()
const adjustedPos = ref({ x: 0, y: 0 })
const isPositioned = ref(false)

const visibleItems = computed(() =>
  items.value.filter((item) => {
    const h = item.hidden
    if (typeof h === 'function') return !h(context.value)
    return !h
  }),
)

const menuStyle = computed(() => ({
  left: `${adjustedPos.value.x}px`,
  top: `${adjustedPos.value.y}px`,
  visibility: isPositioned.value ? 'visible' : 'hidden',
}))

function onItemSelect(key: string) {
  emit('select', key, context.value)
  handleSelect(key)
}

// --- Boundary-aware positioning ---
async function updatePosition() {
  isPositioned.value = false
  await nextTick()

  const el = menuRef.value
  if (!el) return

  const rect = el.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight

  let x = position.value.x
  let y = position.value.y

  // Flip horizontal
  if (x + rect.width > vw) {
    x = Math.max(0, x - rect.width)
  }
  // Flip vertical
  if (y + rect.height > vh) {
    y = Math.max(0, y - rect.height)
  }

  adjustedPos.value = { x, y }
  isPositioned.value = true
}

// --- Global event listeners ---
function onClickOutside(e: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
    useContextMenu().close()
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    useContextMenu().close()
  }
}

function onScrollOrResize() {
  useContextMenu().close()
}

function addListeners() {
  document.addEventListener('click', onClickOutside, true)
  document.addEventListener('contextmenu', onClickOutside, true)
  document.addEventListener('keydown', onKeydown)
  window.addEventListener('scroll', onScrollOrResize, true)
  window.addEventListener('resize', onScrollOrResize)
}

function removeListeners() {
  document.removeEventListener('click', onClickOutside, true)
  document.removeEventListener('contextmenu', onClickOutside, true)
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('scroll', onScrollOrResize, true)
  window.removeEventListener('resize', onScrollOrResize)
}

watch(visible, (val) => {
  if (val) {
    addListeners()
    updatePosition()
  } else {
    removeListeners()
    isPositioned.value = false
  }
})

onBeforeUnmount(() => {
  removeListeners()
})
</script>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ContextMenu/ContextMenu.vue
git commit -m "feat(context-menu): add ContextMenu root component"
```

---

### Task 6: Directive

**Files:**

- Create: `src/components/ContextMenu/directive.ts`

- [ ] **Step 1: Create directive**

```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ContextMenu/directive.ts
git commit -m "feat(context-menu): add v-context-menu directive"
```

---

### Task 7: Index exports

**Files:**

- Create: `src/components/ContextMenu/index.ts`

- [ ] **Step 1: Create index.ts**

```ts
export { default as ContextMenu } from './ContextMenu.vue'
export { useContextMenu } from './useContextMenu'
export { contextMenuDirective } from './directive'
export type { ContextMenuItem, SelectHandler, ContextMenuDirectiveValue } from './types'
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ContextMenu/index.ts
git commit -m "feat(context-menu): add index exports"
```

---

### Task 8: Integration — App.vue + main.ts

**Files:**

- Modify: `src/App.vue`
- Modify: `src/main.ts`

- [ ] **Step 1: Add ContextMenu to App.vue**

Current `App.vue`:

```vue
<template>
  <router-view />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useAppStore } from '@/store/app'

const app = useAppStore()
onMounted(() => app.initTheme())
</script>
```

Change to:

```vue
<template>
  <router-view />
  <ContextMenu />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useAppStore } from '@/store/app'
import { ContextMenu } from '@/components/ContextMenu'

const app = useAppStore()
onMounted(() => app.initTheme())
</script>
```

Note: The global `@select` handler on `<ContextMenu />` is optional. Per-callsite handlers via `open()` are the primary pattern. Add `@select` only if global handling is needed later.

- [ ] **Step 2: Register directive in main.ts**

Add after `app.directive('permission', permissionDirective)`:

```ts
import { contextMenuDirective } from '@/components/ContextMenu'
app.directive('context-menu', contextMenuDirective)
```

- [ ] **Step 3: Commit**

```bash
git add src/App.vue src/main.ts
git commit -m "feat(context-menu): integrate globally in App.vue and main.ts"
```

---

### Task 9: Verify in browser

- [ ] **Step 1: Run `vp dev` and open the app**

- [ ] **Step 2: Add a quick test in any existing page**

Temporarily add a right-click handler to a page (e.g., dashboard) using `useContextMenu().open()` with sample items including:

- Normal items with icons
- A disabled item
- An item with a divider
- A submenu with 2 children
- A dynamically hidden item

- [ ] **Step 3: Verify all behaviors**

Checklist:

- Menu appears at cursor position on right-click
- Menu flips when near screen edges (right, bottom, both)
- Disabled items show disabled style, don't trigger select
- Hidden items are not rendered
- Submenu expands on hover, closes with delay
- Click on parent item toggles submenu
- Click outside closes menu
- Esc closes menu
- Scrolling closes menu
- Right-click elsewhere closes current, opens new
- Dark mode toggle shows correct colors
- `onSelect` callback fires with correct key and context
- ARIA attributes present: `role="menu"` on container, `role="menuitem"` on items

- [ ] **Step 4: Remove test code, commit final state**

```bash
git add -A
git commit -m "feat(context-menu): complete implementation and verification"
```
