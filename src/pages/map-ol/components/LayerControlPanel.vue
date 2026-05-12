<script setup lang="ts">
import type { OlLayerItem } from '@/composables/ol/useOlLayers'

type LayerKey = string

defineProps<{
  items: OlLayerItem<LayerKey>[]
}>()

const emit = defineEmits<{
  changeVisible: [key: LayerKey, visible: boolean | string | number]
}>()

function formatCount(value: number) {
  return value.toLocaleString()
}
</script>

<template>
  <section class="border-t border-slate-200 pt-3">
    <div class="mb-2 flex items-center justify-between">
      <div class="text-xs font-semibold text-slate-700">图层管理</div>
      <div class="text-[11px] text-slate-400">显示 / 隐藏</div>
    </div>

    <div class="space-y-2">
      <div
        v-for="item in items"
        :key="item.key"
        class="flex items-center justify-between gap-3 rounded-3 bg-slate-50 px-3 py-2"
      >
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span
              class="h-2.5 w-2.5 shrink-0 rounded-full"
              :style="{ backgroundColor: item.color }"
            ></span>
            <span class="truncate text-xs font-semibold text-slate-700">
              {{ item.title }}
            </span>
            <ElTag v-if="item.error" size="small" type="danger">失败</ElTag>
            <ElTag v-else-if="item.loading" size="small" type="warning">加载中</ElTag>
            <ElTag v-else-if="item.loaded" size="small" type="success">已加载</ElTag>
            <ElTag v-else size="small" type="info">未请求</ElTag>
          </div>

          <div class="mt-1 text-[11px] text-slate-500">
            <template v-if="item.loading">
              {{ formatCount(item.renderedCount) }} /
              {{ formatCount(item.totalCount) }}
            </template>
            <template v-else>{{ formatCount(item.loadedCount) }} {{ item.unit }}</template>
          </div>
        </div>

        <ElSwitch
          size="small"
          :model-value="item.visible"
          @change="(value) => emit('changeVisible', item.key, value)"
        />
      </div>
    </div>
  </section>
</template>
