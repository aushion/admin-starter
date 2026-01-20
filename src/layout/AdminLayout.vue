<template>
  <div class="flex bg-[var(--app-bg)] text-[var(--app-text)]">
    <Sidebar />
    <div class="flex-1 flex flex-col min-w-0">
      <Topbar />
      <TagsView />

      <main class="flex-1 p-3 overflow-auto">
        <!-- ✅ 可选 keep-alive：默认开启，但要求 route.name 为 string 且页面组件有 name（见第5节） -->
        <router-view v-slot="{ Component, route }">
          <keep-alive :include="cachedNames">
            <component :is="Component" :key="route.fullPath" />
          </keep-alive>
        </router-view>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import Sidebar from './Sidebar.vue'
import Topbar from './Topbar.vue'
import TagsView from './TagsView.vue'
import { useTagsView } from '@/composables/useTagsView'

const { cachedNames } = useTagsView()
</script>
