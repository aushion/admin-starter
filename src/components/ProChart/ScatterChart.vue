<template>
  <div ref="chartRef" :style="{ width, height }" />
</template>

<script setup lang="ts">
import { ref, toRefs } from 'vue'
import type { EChartsOption } from 'echarts'
import { useChartData } from './useChartData'
import type { ScatterChartProps } from './types'

const props = withDefaults(defineProps<ScatterChartProps>(), {
  width: '100%',
  height: '400px',
})

const chartRef = ref<HTMLDivElement>()
const { data, xField, yField, sizeField, colorField, option } = toRefs(props)

function toPoint(item: any): number[] {
  const point = [item[xField.value], item[yField.value]]
  if (sizeField.value) point.push(item[sizeField.value])
  return point
}

useChartData(
  chartRef,
  props,
  [data, xField, yField, sizeField, colorField, option],
  (sourceData) => {
    const sizeSymbol = sizeField.value ? (val: number[]) => Math.sqrt(val[2]) * 2 : undefined

    const tooltipFormatter = (params: any) => {
      const d = params.data
      let text = params.seriesName ? `${params.seriesName}<br/>` : ''
      text += `${xField.value}: ${d[0]}<br/>${yField.value}: ${d[1]}`
      if (sizeField.value) text += `<br/>${sizeField.value}: ${d[2]}`
      return text
    }

    let series: any[]

    if (colorField.value) {
      const groups = new Map<string, any[]>()
      for (const item of sourceData) {
        const key = String(item[colorField.value])
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key)!.push(item)
      }
      series = Array.from(groups.entries()).map(([name, items]) => ({
        type: 'scatter',
        name,
        data: items.map(toPoint),
        ...(sizeSymbol ? { symbolSize: sizeSymbol } : {}),
      }))
    } else {
      series = [
        {
          type: 'scatter',
          data: sourceData.map(toPoint),
          ...(sizeSymbol ? { symbolSize: sizeSymbol } : {}),
        },
      ]
    }

    const base: EChartsOption = {
      tooltip: { trigger: 'item', formatter: tooltipFormatter },
      legend: colorField.value ? {} : undefined,
      xAxis: { type: 'value', name: xField.value },
      yAxis: { type: 'value', name: yField.value },
      series,
    }

    return option.value ? { ...base, ...option.value } : base
  },
  () => data.value,
)
</script>
