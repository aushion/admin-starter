<template>
  <router-view />
  <ContextMenu />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useAppStore } from '@/store/app'
import { ContextMenu } from '@/components/ContextMenu'

const app = useAppStore()
onMounted(() => app.initTheme())
</script>
