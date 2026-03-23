<template>
  <div
    class="h-12 flex items-center justify-between px-3 border-b border-gray-200 dark:border-gray-700"
  >
    <div class="font-600">Admin Starter</div>
    <div class="flex items-center gap-2">
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
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/store/app'
import { usePermissionStore } from '@/store/permission'
import { useAuth } from '@/composables/useAuth'
import { useTagsView } from '@/composables/useTagsView'

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
const { logout } = useAuth()
const { removeAll } = useTagsView()

const onCommand = (cmd: string) => {
  if (cmd === 'logout') {
    logout()
    permission.resetPermission()
    removeAll()
    router.replace('/login')
  }
}
</script>
