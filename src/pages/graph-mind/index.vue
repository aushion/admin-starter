<template>
  <el-card>
    <div
      ref="container"
      class="h-[70vh] w-full border border-gray-200 dark:border-gray-700 rounded"
    ></div>
  </el-card>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Graph } from '@antv/x6'

const container = ref<HTMLDivElement | null>(null)

onMounted(() => {
  const graph = new Graph({
    container: container.value!,
    grid: true,
  })

  const root = graph.addNode({ x: 320, y: 200, width: 160, height: 50, label: 'Root' })
  const a = graph.addNode({ x: 120, y: 120, width: 140, height: 44, label: 'Topic A' })
  const b = graph.addNode({ x: 520, y: 120, width: 140, height: 44, label: 'Topic B' })

  graph.addEdge({ source: root, target: a })
  graph.addEdge({ source: root, target: b })
})
</script>
