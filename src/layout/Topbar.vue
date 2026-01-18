<template>
  <div class="h-12 flex items-center justify-between px-3 border-b border-gray-200 dark:border-gray-700">
    <div class="font-600">Admin Starter</div>
    <div class="flex items-center gap-2">
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
import { useAppStore } from '@/store/app'
const app = useAppStore()
const isDark = computed(() => app.theme === 'dark')
const onToggle = () => app.toggleTheme()
</script>
