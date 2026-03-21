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
