# ContextMenu Component Design

## Overview

A general-purpose right-click context menu component for the admin-starter project. It provides three layers of API: a `useContextMenu` composable for core state management, a `<ContextMenu />` Vue component for rendering, and a `v-context-menu` directive as syntactic sugar.

The component follows Element Plus visual style (CSS variables), supports dark mode automatically, and can be used anywhere — tables, lists, trees, or any DOM element. Desktop only for v1 (no touch/long-press support).

## Data Structures

```ts
interface ContextMenuItem<T = any> {
  key: string // Unique identifier
  label: string // Display text
  icon?: string // UnoCSS icon class (e.g. 'i-mdi-delete')
  shortcut?: string // Shortcut hint text (display only, e.g. 'Ctrl+C')
  disabled?: boolean | ((context: T) => boolean) // Static or dynamic disable
  hidden?: boolean | ((context: T) => boolean) // Static or dynamic hide
  children?: ContextMenuItem<T>[] // Submenu items (parent items are NOT selectable)
  render?: (context: T) => VNode // Custom render — replaces entire item content (label/icon/shortcut ignored)
  divided?: boolean // Show divider below this item
}

type ContextMenuContext = any // User-provided data passed through all callbacks
```

The `context` parameter is arbitrary data provided by the caller (e.g. `{ row, column }` in a table scenario). It flows through `disabled`, `hidden`, `render` callbacks and the `select` event, so menu items don't need closures over external variables.

**Behavior notes:**

- When `render` is provided, it replaces the entire item content — `label`, `icon`, and `shortcut` are ignored
- Items with `children` are not selectable — clicking them only toggles the submenu

## Architecture

### Three-Layer API

#### 1. Composable — `useContextMenu()`

Core state management as a global singleton. Only one menu can be open at a time.

```ts
const {
  visible, // Ref<boolean>
  position, // Ref<{ x: number, y: number }>
  items, // Ref<ContextMenuItem[]>
  context, // Ref<any>
  open, // (event: MouseEvent, items: ContextMenuItem[], context?: any, onSelect?: SelectHandler) => void
  close, // () => void
} = useContextMenu()

type SelectHandler = (key: string, context: any) => void
```

- `open`: prevents default contextmenu event, records mouse coordinates, sets items, context, and per-callsite `onSelect` handler
- `close`: resets state, called on item click / outside click / Esc / scroll / resize
- Singleton: calling `open` while a menu is visible closes the previous one first
- **Per-callsite select handling**: the `onSelect` callback passed to `open()` is stored internally and invoked when an item is selected, so each callsite handles its own events without needing a global switch statement

#### 2. Component — `<ContextMenu />`

Mounted once in `App.vue`, consumes `useContextMenu()` state.

```vue
<template>
  <router-view />
  <ContextMenu @select="onGlobalSelect" />
</template>
```

Responsibilities:

- Renders via `Teleport` to `<body>` to avoid parent `overflow: hidden` clipping
- Positions based on mouse coordinates with boundary detection
- Recursively renders menu items including submenus
- Handles `disabled`/`hidden`/`render`/`divided`/`icon`/`shortcut` per item
- Styled with Element Plus CSS variables for visual consistency and dark mode support
- Uses `role="menu"` and `role="menuitem"` ARIA attributes
- z-index uses Element Plus's `--el-popup-z-index` to stay above modals/drawers

**Select event flow**: when an item is clicked, the component first invokes the per-callsite `onSelect` (if provided via `open()`), then emits `@select` on the component (for optional global handling).

#### 3. Directive — `v-context-menu`

Syntactic sugar that internally calls `useContextMenu().open`.

```vue
<!-- Simple: just items -->
<div v-context-menu="menuItems">Right click me</div>

<!-- With context and handler -->
<div v-context-menu="{ items: menuItems, context: row, onSelect: handleSelect }">
  {{ row.name }}
</div>
```

Accepts two value shapes:

- `ContextMenuItem[]` — items only, no context
- `{ items, context?, onSelect? }` — items + optional context + optional per-callsite handler

**Lifecycle:**

- `mounted`: binds `contextmenu` event listener on the element
- `updated`: rebinds if the directive value changes (items/context/onSelect)
- `beforeUnmount`: removes the event listener to prevent memory leaks

## Positioning & Boundary Detection

### Primary Menu

Default: opens bottom-right of cursor (menu top-left corner at mouse position).

```
Right edge overflow:  flip to left  (menu top-right at cursor)
Bottom edge overflow: flip to top   (menu bottom-left at cursor)
Both overflow:        flip to top-left (menu bottom-right at cursor)
```

Implementation: render menu with `visibility: hidden` first, measure actual dimensions via `getBoundingClientRect()`, calculate final coordinates, then show. This avoids visual flicker.

When items exceed viewport height even after flipping, apply `max-height` with `overflow-y: auto` as fallback.

### Submenus

Default: expand to the right of parent item. If right edge overflows, expand to the left. Vertical overflow follows the same logic as the primary menu.

## Interaction Rules

| Trigger                                     | Behavior                                                   |
| ------------------------------------------- | ---------------------------------------------------------- |
| Click menu item (not disabled, no children) | Close menu + invoke onSelect + emit `select(key, context)` |
| Click parent item (has children)            | Toggle submenu (does NOT emit select)                      |
| Click outside menu                          | Close menu                                                 |
| Press Escape                                | Close menu                                                 |
| Window resize                               | Close menu                                                 |
| Any scroll (capture phase)                  | Close menu                                                 |
| Right-click elsewhere                       | Close current, open new                                    |
| Hover parent item with children             | Open submenu                                               |
| Mouse leaves submenu area                   | Close submenu after 150ms delay                            |

The 150ms delay on submenu close prevents accidental dismissal when the user moves their cursor from the parent item toward the submenu.

**Scroll handling**: the `scroll` listener is bound on `window` with `{ capture: true }` to catch scroll events from nested containers (e.g., a table body with `overflow: auto`), not just window-level scrolls.

## File Structure

```
src/components/ContextMenu/
├── ContextMenu.vue        # Main component (Teleport + recursive rendering)
├── ContextMenuItem.vue    # Single menu item (recursive, handles submenu expand)
├── useContextMenu.ts      # Composable (global singleton state + open/close)
├── directive.ts           # v-context-menu directive definition
├── types.ts               # ContextMenuItem and related type definitions
├── style.css              # Styles using Element Plus CSS variables
└── index.ts               # Unified exports (component, composable, directive, types)
```

## Integration

### App.vue — Mount global component

```vue
<template>
  <router-view />
  <ContextMenu @select="onSelect" />
</template>

<script setup lang="ts">
import ContextMenu from '@/components/ContextMenu/ContextMenu.vue'

function onSelect(key: string, context: any) {
  // Optional global handler — most cases use per-callsite onSelect instead
}
</script>
```

### main.ts — Register directive

```ts
import { contextMenuDirective } from '@/components/ContextMenu'
app.directive('context-menu', contextMenuDirective)
```

## Usage Examples

### Composable (most flexible)

```ts
import { useContextMenu } from '@/components/ContextMenu'

const { open } = useContextMenu()

function onRowContextMenu(row: any, col: any, event: MouseEvent) {
  open(
    event,
    [
      { key: 'edit', label: '编辑', icon: 'i-mdi-pencil' },
      { key: 'copy', label: '复制', icon: 'i-mdi-content-copy', shortcut: 'Ctrl+C' },
      { key: 'delete', label: '删除', icon: 'i-mdi-delete', disabled: row.locked, divided: true },
      {
        key: 'more',
        label: '更多',
        children: [
          { key: 'export', label: '导出' },
          { key: 'print', label: '打印' },
        ],
      },
    ],
    { row, col },
    (key, ctx) => {
      // Per-callsite handler
      if (key === 'edit') editRow(ctx.row)
      if (key === 'delete') deleteRow(ctx.row)
    },
  )
}
```

### Directive (convenient)

```vue
<template>
  <div v-context-menu="{ items: menuItems, context: rowData, onSelect: handleSelect }">
    Content here
  </div>
</template>
```

### Dynamic menu items

```ts
const menuItems: ContextMenuItem[] = [
  {
    key: 'approve',
    label: '审批',
    hidden: (ctx) => ctx.row.status !== 'pending',
  },
  {
    key: 'delete',
    label: '删除',
    disabled: (ctx) => !ctx.row.canDelete,
  },
]
```

## Styling

- Uses Element Plus CSS variables: `--el-bg-color-overlay`, `--el-text-color-primary`, `--el-border-color-lighter`, `--el-box-shadow-light`, `--el-fill-color-light` (hover), etc.
- Dark mode works automatically through Element Plus CSS variable system
- BEM-like class naming: `.context-menu`, `.context-menu__item`, `.context-menu__divider`, `.context-menu__submenu`
- Menu width: `min-width: 160px`, auto-expand based on content
- Border radius, padding, font size follow Element Plus defaults
- z-index: uses `var(--el-popup-z-index, 2000)` to layer above modals and drawers
- ARIA: menu container uses `role="menu"`, each item uses `role="menuitem"`

## Constraints & Decisions

- **Global singleton**: only one context menu visible at a time — this matches native OS behavior and simplifies state management
- **Desktop only in v1**: no touch/long-press support; can be added later without API changes
- **No keyboard navigation in v1**: focus is on mouse interaction; keyboard nav (arrow keys to move between items) can be added later
- **Submenu depth**: technically unlimited recursion, but practically designed for 2 levels (menu + one submenu). Deeper nesting is a UX anti-pattern
- **No animation in v1**: menu appears/disappears instantly. CSS transitions can be added later without API changes
- **Parent items not selectable**: items with `children` only toggle submenu, they do not emit `select`
- **render replaces all**: when `render` is provided, `label`/`icon`/`shortcut` are ignored
