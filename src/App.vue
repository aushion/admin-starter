<template>
  <router-view />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useAppStore } from '@/store/app'


const app = useAppStore()
onMounted(() => app.initTheme())
</script>
