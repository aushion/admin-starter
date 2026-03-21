<template>
  <div
    class="h-12 bg-blue flex items-center justify-between px-3 border-b border-gray-200 dark:border-gray-700"
  >
    <div class="font-600">Admin Starter</div>
    <div class="flex items-center gap-2">
      <el-select
        size="small"
        style="width: 140px"
        :model-value="currentPreset"
        @change="onPresetChange"
      >
        <el-option label="管理员" value="admin" />
        <el-option label="运营" value="ops" />
        <el-option label="访客" value="viewer" />
      </el-select>
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
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '@/store/app'
import { usePermissionStore, type PresetKey } from '@/store/permission'
import { useAuth } from '@/composables/useAuth'

const app = useAppStore()
const isDark = computed(() => app.theme === 'dark')
const onToggle = () => app.toggleTheme()

const permission = usePermissionStore()
const currentPreset = computed(() => permission.currentKey)
const currentUser = computed(() => permission.profile.name)

const router = useRouter()
const route = useRoute()
const onPresetChange = (value: PresetKey) => {
  permission.switchPreset(value)
  const allowed = route.matched.every((r) => permission.canAccess(r.meta))
  if (!allowed) router.replace('/403')
}

const { logout } = useAuth()
const onCommand = (cmd: string) => {
  if (cmd === 'logout') {
    logout()
    router.replace('/login')
  }
}
</script>
