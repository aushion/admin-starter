<template>
  <div ref="chartRef" :style="{ width, height }" />
</template>

<script setup lang="ts">
import { ref, toRefs } from 'vue'
import type { EChartsOption } from 'echarts'
import { useChartData } from './useChartData'
import type { CartesianChartProps } from './types'

const props = withDefaults(defineProps<CartesianChartProps>(), {
  width: '100%',
  height: '400px',
  smooth: false,
  stack: false,
  area: false,
})

const chartRef = ref<HTMLDivElement>()
const { data, xField, yField, smooth, stack, area, option } = toRefs(props)

useChartData(
  chartRef,
  props,
  [data, xField, yField, smooth, stack, area, option],
  (sourceData) => {
    const fields = Array.isArray(yField.value) ? yField.value : [yField.value]
    const xData = sourceData.map((item) => item[xField.value])

    const series = fields.map((field) => ({
      type: 'line' as const,
      name: field,
      data: sourceData.map((item) => item[field]),
      smooth: smooth.value,
      stack: stack.value ? 'total' : undefined,
      areaStyle: area.value ? {} : undefined,
    }))

    const base: EChartsOption = {
      tooltip: { trigger: 'axis' },
      legend: fields.length > 1 ? {} : undefined,
      xAxis: { type: 'category', data: xData },
      yAxis: { type: 'value' },
      series,
    }

    return option.value ? { ...base, ...option.value } : base
  },
  () => data.value,
)
</script>
