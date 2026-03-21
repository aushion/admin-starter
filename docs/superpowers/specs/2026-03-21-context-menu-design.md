# ContextMenu Component Design

## Overview

A general-purpose right-click context menu component for the admin-starter project. It provides three layers of API: a `useContextMenu` composable for core state management, a `<ContextMenu />` Vue component for rendering, and a `v-context-menu` directive as syntactic sugar.

The component follows Element Plus visual style (CSS variables), supports dark mode automatically, and can be used anywhere — tables, lists, trees, or any DOM element.

## Data Structures

```ts
interface ContextMenuItem {
  key: string // Unique identifier
  label: string // Display text
  icon?: string // UnoCSS icon class (e.g. 'i-mdi-delete')
  shortcut?: string // Shortcut hint text (display only, e.g. 'Ctrl+C')
  disabled?: boolean | ((context: any) => boolean) // Static or dynamic disable
  hidden?: boolean | ((context: any) => boolean) // Static or dynamic hide
  children?: ContextMenuItem[] // Submenu items
  render?: (context: any) => VNode // Custom render function
  divided?: boolean // Show divider below this item
}

type ContextMenuContext = any // User-provided data passed through all callbacks
```

The `context` parameter is arbitrary data provided by the caller (e.g. `{ row, column }` in a table scenario). It flows through `disabled`, `hidden`, `render` callbacks and the `select` event, so menu items don't need closures over external variables.

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
  open, // (event: MouseEvent, items: ContextMenuItem[], context?: any) => void
  close, // () => void
} = useContextMenu()
```

- `open`: prevents default contextmenu event, records mouse coordinates, sets items and context
- `close`: resets state, called on item click / outside click / Esc / scroll / resize
- Singleton: calling `open` while a menu is visible closes the previous one first

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

#### 3. Directive — `v-context-menu`

Syntactic sugar that internally calls `useContextMenu().open`.

```vue
<!-- Simple: just items -->
<div v-context-menu="menuItems">Right click me</div>

<!-- With context -->
<div v-context-menu="{ items: menuItems, context: row }">
  {{ row.name }}
</div>
```

Accepts two value shapes:

- `ContextMenuItem[]` — items only, no context
- `{ items: ContextMenuItem[], context: any }` — items + context

## Positioning & Boundary Detection

### Primary Menu

Default: opens bottom-right of cursor (menu top-left corner at mouse position).

```
Right edge overflow:  flip to left  (menu top-right at cursor)
Bottom edge overflow: flip to top   (menu bottom-left at cursor)
Both overflow:        flip to top-left (menu bottom-right at cursor)
```

Implementation: render menu with `visibility: hidden` first, measure actual dimensions via `getBoundingClientRect()`, calculate final coordinates, then show. This avoids visual flicker.

### Submenus

Default: expand to the right of parent item. If right edge overflows, expand to the left. Vertical overflow follows the same logic as the primary menu.

## Interaction Rules

| Trigger                         | Behavior                                 |
| ------------------------------- | ---------------------------------------- |
| Click menu item (not disabled)  | Close menu + emit `select(key, context)` |
| Click outside menu              | Close menu                               |
| Press Escape                    | Close menu                               |
| Window resize / scroll          | Close menu                               |
| Right-click elsewhere           | Close current, open new                  |
| Hover parent item with children | Open submenu                             |
| Mouse leaves submenu area       | Close submenu after 150ms delay          |

The 150ms delay on submenu close prevents accidental dismissal when the user moves their cursor from the parent item toward the submenu.

## File Structure

```
src/components/ContextMenu/
├── ContextMenu.vue        # Main component (Teleport + recursive rendering)
├── ContextMenuItem.vue    # Single menu item (recursive, handles submenu expand)
├── useContextMenu.ts      # Composable (global singleton state + open/close)
├── directive.ts           # v-context-menu directive definition
├── types.ts               # ContextMenuItem and related type definitions
├── style.css              # Styles using Element Plus CSS variables
└── index.ts               # Unified exports
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
  // Global handler (optional, can also handle per-callsite via composable)
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
  )
}
```

### Directive (convenient)

```vue
<template>
  <div v-context-menu="{ items: menuItems, context: rowData }">Content here</div>
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

## Constraints & Decisions

- **Global singleton**: only one context menu visible at a time — this matches native OS behavior and simplifies state management
- **No keyboard navigation in v1**: focus is on mouse interaction; keyboard nav (arrow keys to move between items) can be added later
- **Submenu depth**: technically unlimited recursion, but practically designed for 2 levels (menu + one submenu). Deeper nesting is a UX anti-pattern
- **No animation in v1**: menu appears/disappears instantly. CSS transitions can be added later without API changes
