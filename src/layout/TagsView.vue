<template>
  <div class="h-10 flex items-center px-2 border-b border-gray-200 dark:border-gray-700 bg-[var(--app-bg)]">
    <el-scrollbar class="w-full">
      <div class="flex items-center gap-2 py-1">
        <el-tag
          v-for="tag in views"
          :key="tag.fullPath"
          :effect="isActive(tag) ? 'dark' : 'plain'"
          :closable="!tag.affix"
          @close="onClose(tag)"
          @click="go(tag)"
          class="cursor-pointer select-none"
        >
          {{ tag.title }}
        </el-tag>

        <div class="ml-auto flex items-center gap-2 pr-2">
          <el-dropdown trigger="click">
            <el-button size="small">操作</el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="closeOthers">关闭其它</el-dropdown-item>
                <el-dropdown-item @click="closeAll">关闭全部</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </el-scrollbar>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTagsView, type TagView } from '@/composables/useTagsView'

const route = useRoute()
const router = useRouter()
const tv = useTagsView()

const views = computed(() => tv.views.value)

function isActive(tag: TagView) {
  return tag.fullPath === route.fullPath
}

function go(tag: TagView) {
  router.push(tag.fullPath)
}

function findFallbackPath() {
  // 优先回到最后一个 tag，否则回 dashboard
  const arr = views.value
  return (arr[arr.length - 1]?.fullPath) || '/dashboard'
}

async function onClose(tag: TagView) {
  const active = isActive(tag)
  tv.removeView(tag)
  if (active) {
    await router.push(findFallbackPath())
  }
}

function closeOthers() {
  const current = views.value.find(v => v.fullPath === route.fullPath)
  if (!current) return
  tv.removeOthers(current)
}

async function closeAll() {
  tv.removeAll()
  await router.push(findFallbackPath())
}
</script>
