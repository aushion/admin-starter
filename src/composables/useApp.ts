import { computed, ref } from 'vue'

/**
 * 模块级单例（composable 共享状态）
 */
const _sidebarCollapsed = ref(false)

export function useApp() {
  const sidebarCollapsed = computed(() => _sidebarCollapsed.value)

  function toggleSidebar() {
    _sidebarCollapsed.value = !_sidebarCollapsed.value
  }

  return {
    sidebarCollapsed,
    toggleSidebar,
  }
}
