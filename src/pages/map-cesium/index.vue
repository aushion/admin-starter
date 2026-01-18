<template>
  <el-card>
    <div ref="mapEl" class="h-[70vh] w-full"></div>
  </el-card>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Map from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import OSM from 'ol/source/OSM'

const mapEl = ref<HTMLDivElement | null>(null)

onMounted(() => {
  new Map({
    target: mapEl.value!,
    layers: [new TileLayer({ source: new OSM() })],
    view: new View({
      center: [0, 0],
      zoom: 2,
    }),
  })
})
</script>
