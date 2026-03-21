<template>
  <div class="flex flex-col gap-4">
    <el-card header="折线图 - LineChart">
      <LineChart
        :data="lineData"
        x-field="month"
        :y-field="['sales', 'profit']"
        smooth
        height="350px"
      />
    </el-card>

    <el-card header="面积图 - LineChart (area)">
      <LineChart
        :data="lineData"
        x-field="month"
        :y-field="['sales', 'profit']"
        smooth
        area
        stack
        height="350px"
      />
    </el-card>

    <el-card header="柱状图 - BarChart">
      <BarChart :data="barData" x-field="category" :y-field="['2024', '2025']" height="350px" />
    </el-card>

    <el-card header="堆叠柱状图 - BarChart (stack)">
      <BarChart
        :data="barData"
        x-field="category"
        :y-field="['2024', '2025']"
        stack
        height="350px"
      />
    </el-card>

    <el-card header="饼图 - PieChart">
      <div class="flex">
        <PieChart
          :data="pieData"
          name-field="name"
          value-field="value"
          width="50%"
          height="350px"
        />
        <PieChart
          :data="pieData"
          name-field="name"
          value-field="value"
          :radius="['40%', '70%']"
          width="50%"
          height="350px"
        />
      </div>
    </el-card>

    <el-card header="散点图 - ScatterChart">
      <ScatterChart
        :data="scatterData"
        x-field="height"
        y-field="weight"
        color-field="gender"
        height="350px"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { LineChart, BarChart, PieChart, ScatterChart } from '@/components/ProChart'

const lineData = [
  { month: '1月', sales: 120, profit: 40 },
  { month: '2月', sales: 200, profit: 80 },
  { month: '3月', sales: 150, profit: 60 },
  { month: '4月', sales: 80, profit: 30 },
  { month: '5月', sales: 270, profit: 120 },
  { month: '6月', sales: 310, profit: 150 },
]

const barData = [
  { category: '电子', 2024: 430, 2025: 510 },
  { category: '服装', 2024: 320, 2025: 380 },
  { category: '食品', 2024: 280, 2025: 310 },
  { category: '家居', 2024: 190, 2025: 240 },
  { category: '运动', 2024: 150, 2025: 220 },
]

const pieData = [
  { name: '直接访问', value: 335 },
  { name: '邮件营销', value: 210 },
  { name: '联盟广告', value: 274 },
  { name: '视频广告', value: 235 },
  { name: '搜索引擎', value: 400 },
]

const scatterData = Array.from({ length: 60 }, (_, i) => ({
  height: 155 + Math.random() * 35,
  weight: 45 + Math.random() * 45,
  gender: i < 30 ? '男' : '女',
}))
</script>
