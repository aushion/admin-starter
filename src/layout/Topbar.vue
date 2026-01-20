<template>
  <div class="h-12 bg-blue flex items-center justify-between px-3 border-b border-gray-200 dark:border-gray-700">
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
      <el-tag type="info" size="small">{{ currentUser }}</el-tag>
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
  const allowed = route.matched.every(r => permission.canAccess(r.meta))
  if (!allowed) router.replace('/403')
}
</script>
