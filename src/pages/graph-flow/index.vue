<template>
  <el-card>
    <div class="flex gap-2 mb-2">
      <el-button @click="addNode">新增节点</el-button>
      <el-button @click="undo">撤销</el-button>
      <el-button @click="redo">重做</el-button>
    </div>
    <div
      ref="container"
      class="h-[70vh] w-full border border-gray-200 dark:border-gray-700 rounded"
    ></div>
  </el-card>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Graph } from '@antv/x6'
import { History } from '@antv/x6-plugin-history'
import { Keyboard } from '@antv/x6-plugin-keyboard'

const container = ref<HTMLDivElement | null>(null)
let graph: Graph

onMounted(() => {
  graph = new Graph({
    container: container.value!,
    grid: true,
    background: { color: 'transparent' },
    selecting: { enabled: true, rubberband: true, showNodeSelectionBox: true },
  })

  graph.use(new History())
  graph.use(new Keyboard())

  graph.bindKey(['meta+z', 'ctrl+z'], () => graph.undo())
  graph.bindKey(['meta+shift+z', 'ctrl+shift+z'], () => graph.redo())

  graph.addNode({ x: 80, y: 80, width: 120, height: 44, label: 'Start' })
})

function addNode() {
  graph.addNode({
    x: 80 + Math.random() * 300,
    y: 80 + Math.random() * 200,
    width: 140,
    height: 50,
    label: 'Node',
  })
}
function undo() {
  graph.undo()
}
function redo() {
  graph.redo()
}
</script>
