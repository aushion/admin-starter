import { ref, watch, onBeforeUnmount, type Ref } from 'vue'
import type { EChartsOption } from 'echarts'
import { useChart } from './useChart'
import type { BaseChartProps } from './types'

export function useChartData(
  chartRef: Ref<HTMLElement | undefined>,
  props: BaseChartProps,
  deps: Ref[],
  buildOption: (data: any[]) => EChartsOption,
  getData: () => any[] | undefined,
) {
  const { chartInstance, setOption, isReady } = useChart(chartRef)
  const innerData = ref<any[]>([])
  let refreshTimer: ReturnType<typeof setInterval> | null = null

  async function fetchData() {
    if (props.request) {
      innerData.value = await props.request()
    }
  }

  function render() {
    const sourceData = props.request ? innerData.value : (getData() ?? [])
    if (sourceData.length && isReady.value) {
      setOption(buildOption(sourceData), true)
    }
  }

  // 响应数据和配置变化
  watch([...deps, isReady, innerData], render, { deep: true })

  // loading 状态
  watch(
    () => props.loading,
    (val) => {
      if (!chartInstance.value) return
      val ? chartInstance.value.showLoading() : chartInstance.value.hideLoading()
    },
  )

  // 初始化完成后首次渲染
  watch(isReady, async (ready) => {
    if (ready) {
      if (props.request) await fetchData()
      render()
      setupAutoRefresh()
    }
  })

  function setupAutoRefresh() {
    clearAutoRefresh()
    if (props.request && props.autoRefresh && props.autoRefresh > 0) {
      refreshTimer = setInterval(async () => {
        await fetchData()
        render()
      }, props.autoRefresh)
    }
  }

  function clearAutoRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer)
      refreshTimer = null
    }
  }

  onBeforeUnmount(() => {
    clearAutoRefresh()
  })

  return { chartInstance, setOption, isReady, innerData, fetchData }
}
