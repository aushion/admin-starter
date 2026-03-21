<template>
  <div ref="chartRef" :style="{ width, height }" />
</template>

<script setup lang="ts">
import { ref, toRefs } from 'vue'
import type { EChartsOption } from 'echarts'
import { useChartData } from './useChartData'
import type { PieChartProps } from './types'

const props = withDefaults(defineProps<PieChartProps>(), {
  width: '100%',
  height: '400px',
  roseType: false,
})

const chartRef = ref<HTMLDivElement>()
const { data, nameField, valueField, radius, roseType, option } = toRefs(props)

useChartData(
  chartRef,
  props,
  [data, nameField, valueField, radius, roseType, option],
  (sourceData) => {
    const pieData = sourceData.map((item) => ({
      name: item[nameField.value],
      value: item[valueField.value],
    }))

    const base: EChartsOption = {
      tooltip: { trigger: 'item' },
      legend: { orient: 'horizontal', bottom: 0 },
      series: [
        {
          type: 'pie',
          radius: radius.value ?? ['0', '75%'],
          roseType: roseType.value ? 'area' : undefined,
          data: pieData,
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
          },
          label: { show: true, formatter: '{b}: {d}%' },
        },
      ],
    }

    return option.value ? { ...base, ...option.value } : base
  },
  () => data.value,
)
</script>
