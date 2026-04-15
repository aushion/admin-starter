<template>
  <div
    class="h-12 flex items-center justify-between px-3 border-b border-gray-200 dark:border-gray-700"
  >
    <div class="font-600">Admin Starter</div>
    <div class="flex items-center gap-2">
      <!-- Dashboard table layout config button — only shown on dashboard page -->
      <el-button v-if="isDashboard" size="small" :icon="GridIcon" @click="openLayoutDialog">
        表格布局
      </el-button>

      <el-dropdown trigger="click" @command="onCommand">
        <span
          class="flex items-center gap-1 cursor-pointer text-sm text-[var(--app-text)] hover:text-[var(--el-color-primary)]"
        >
          <i class="i-carbon-user-avatar-filled" />
          {{ currentUser }}
          <i class="i-carbon-chevron-down text-xs" />
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item disabled>
              <i class="i-carbon-user mr-1" />{{ currentUser }}
            </el-dropdown-item>
            <el-dropdown-item disabled>
              <i class="i-carbon-tag mr-1" />{{ currentRole }}
            </el-dropdown-item>
            <el-dropdown-item divided command="logout">
              <i class="i-carbon-logout mr-1" />退出登录
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <el-switch
        :model-value="isDark"
        inline-prompt
        active-text="Dark"
        inactive-text="Light"
        @change="onToggle"
      />
    </div>
  </div>

  <!-- Table layout config dialog -->
  <el-dialog
    v-model="dialogVisible"
    title="表格布局设置"
    width="360px"
    :close-on-click-modal="true"
    draggable
  >
    <div class="layout-dialog-body">
      <p class="layout-hint">选择右侧面板中显示的表格（至少选 1 个，最多 3 个）</p>
      <el-checkbox-group v-model="pendingTables" class="layout-checkbox-group">
        <el-checkbox
          v-for="opt in tableOptions"
          :key="opt.key"
          :value="opt.key"
          :label="opt.label"
          :disabled="pendingTables.length === 1 && pendingTables.includes(opt.key)"
        />
      </el-checkbox-group>
      <p class="layout-count-label">已选 {{ pendingTables.length }} 个表格</p>
    </div>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :disabled="pendingTables.length === 0" @click="applyLayout">
        确定
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, h, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '@/store/app'
import { usePermissionStore } from '@/store/permission'
import { useAuth } from '@/composables/useAuth'
import { useTagsView } from '@/composables/useTagsView'
import { useDashboardLayoutStore, TABLE_OPTIONS } from '@/store/dashboardLayout'
import type { TableKey } from '@/store/dashboardLayout'

const GridIcon = h('i', { class: 'i-carbon-dashboard' })

const app = useAppStore()
const isDark = computed(() => app.theme === 'dark')
const onToggle = () => app.toggleTheme()

const permission = usePermissionStore()
const currentUser = computed(() => permission.profile?.name ?? '未登录')
const currentRole = computed(() => {
  const roles = permission.profile?.roles ?? []
  const map: Record<string, string> = { admin: '管理员', ops: '运营', viewer: '访客' }
  return roles.map((r) => map[r] || r).join(', ')
})

const router = useRouter()
const route = useRoute()
const { logout } = useAuth()
const { removeAll } = useTagsView()

const isDashboard = computed(() => route.name === 'Dashboard')

// Layout store
const layoutStore = useDashboardLayoutStore()
const tableOptions = TABLE_OPTIONS

// Dialog state
const dialogVisible = ref(false)
const pendingTables = ref<TableKey[]>([])

function openLayoutDialog() {
  pendingTables.value = [...layoutStore.visibleTables]
  dialogVisible.value = true
}

function applyLayout() {
  layoutStore.setVisibleTables(pendingTables.value)
  dialogVisible.value = false
}

const onCommand = (cmd: string) => {
  if (cmd === 'logout') {
    logout()
    permission.resetPermission()
    removeAll()
    router.replace('/login')
  }
}
</script>

<style scoped>
.layout-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.layout-hint {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin: 0;
}

.layout-checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.layout-count-label {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  margin: 0;
}
</style>
