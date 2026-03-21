import type { EChartsOption } from 'echarts'

export interface BaseChartProps {
  width?: string
  height?: string
  loading?: boolean
  request?: () => Promise<any[]>
  autoRefresh?: number
  option?: EChartsOption
}

export interface CartesianChartProps extends BaseChartProps {
  data?: any[]
  xField: string
  yField: string | string[]
  smooth?: boolean
  stack?: boolean
  area?: boolean
}

export interface PieChartProps extends BaseChartProps {
  data?: any[]
  nameField: string
  valueField: string
  radius?: string | [string, string]
  roseType?: boolean
}

export interface ScatterChartProps extends BaseChartProps {
  data?: any[]
  xField: string
  yField: string
  sizeField?: string
  colorField?: string
}
