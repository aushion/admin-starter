<template>
  <div class="p-4">
    <div class="flex flex-col gap-3 mb-4">
      <div class="flex items-center gap-3 flex-wrap">
        <el-input
          v-model="q"
          placeholder="搜索 carbon 图标，比如 dashboard / user / chart"
          clearable
          style="max-width: 420px"
        />
        <div class="text-sm opacity-70">
          共 {{ total }} 个，当前第 {{ page }} / {{ totalPages }} 页
        </div>
      </div>

      <div class="flex items-center gap-3 flex-wrap">
        <el-select v-model="pageSize" size="small" style="width: 140px">
          <el-option :value="24" label="24 / 页" />
          <el-option :value="48" label="48 / 页" />
          <el-option :value="96" label="96 / 页" />
          <el-option :value="160" label="160 / 页" />
        </el-select>

        <el-pagination
          background
          layout="prev, pager, next, jumper"
          :current-page="page"
          :page-size="pageSize"
          :total="total"
          @current-change="onPageChange"
        />
      </div>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
      <button
        v-for="name in pageItems"
        :key="name"
        class="p-3 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-left"
        @click="copy(`i-carbon-${name}`)"
        :title="`i-carbon-${name}`"
      >
        <div class="flex items-center gap-2">
          <span :class="['i-carbon-' + name, 'w-6', 'h-6', 'inline-block']"></span>
          <span class="text-xs opacity-80 break-all">{{ name }}</span>
        </div>
        <div class="mt-2 text-[11px] opacity-60 break-all">i-carbon-{{ name }}</div>
      </button>
    </div>

    <div class="mt-4 flex justify-center">
      <el-pagination
        background
        layout="total, prev, pager, next"
        :current-page="page"
        :page-size="pageSize"
        :total="total"
        @current-change="onPageChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import carbon from '@iconify-json/carbon/icons.json'

const q = ref<string>('')

// 全量 icon 名称
const all = Object.keys((carbon as any).icons || {}).sort()

// 过滤后的列表
const filtered = computed(() => {
  const s = String(q.value ?? '').trim().toLowerCase()
  if (!s) return all
  return all.filter(n => n.includes(s))
})

// 分页状态
const page = ref<number>(1)
const pageSize = ref<number>(48)

// 搜索或 pageSize 变化时，回到第一页
watch([q, pageSize], () => {
  page.value = 1
})

const total = computed(() => filtered.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

const pageItems = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filtered.value.slice(start, start + pageSize.value)
})

function onPageChange(p: number) {
  page.value = p
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
}
</script>
