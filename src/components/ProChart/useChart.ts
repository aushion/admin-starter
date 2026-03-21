import { ref, shallowRef, watch, onMounted, onBeforeUnmount, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'
import { useAppStore } from '@/store/app'

export interface UseChartOptions {
  theme?: Ref<'light' | 'dark'>
  autoResize?: boolean
}

export function useChart(el: Ref<HTMLElement | undefined>, options?: UseChartOptions) {
  const appStore = useAppStore()
  const { theme: storeTheme } = storeToRefs(appStore)

  const theme = options?.theme ?? storeTheme
  const autoResize = options?.autoResize ?? true

  const chartInstance = shallowRef<echarts.ECharts>()
  const isReady = ref(false)

  let resizeObserver: ResizeObserver | null = null

  function init() {
    if (!el.value) return
    dispose()
    chartInstance.value = echarts.init(el.value, theme.value)
    isReady.value = true

    if (autoResize) {
      resizeObserver = new ResizeObserver(() => {
        chartInstance.value?.resize()
      })
      resizeObserver.observe(el.value)
    }
  }

  function setOption(option: EChartsOption, notMerge = false) {
    chartInstance.value?.setOption(option, { notMerge })
  }

  function resize() {
    chartInstance.value?.resize()
  }

  function dispose() {
    resizeObserver?.disconnect()
    resizeObserver = null
    if (chartInstance.value) {
      chartInstance.value.dispose()
      chartInstance.value = undefined
      isReady.value = false
    }
  }

  onMounted(() => {
    init()
  })

  // 主题切换时重新初始化
  watch(theme, () => {
    const currentOption = chartInstance.value?.getOption()
    init()
    if (currentOption) {
      setOption(currentOption as EChartsOption, true)
    }
  })

  onBeforeUnmount(() => {
    dispose()
  })

  return {
    chartInstance,
    setOption,
    resize,
    dispose,
    isReady,
  }
}
