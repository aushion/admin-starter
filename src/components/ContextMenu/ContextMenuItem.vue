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
