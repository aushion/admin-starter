<template>
  <!-- 有子节点：子菜单 -->
  <el-sub-menu v-if="hasChildren" :index="item.key">
    <template #title>
      <span class="flex items-center">
        <span
          v-if="item.icon"
          :class="[item.icon, 'w-5', 'h-5', 'inline-block', 'mr-2', 'align-middle', 'text-current']"
        />

        <span class="align-middle">{{ item.title }}</span>
      </span>
    </template>

    <MenuItem v-for="child in item.children" :key="child.key" :item="child" />
  </el-sub-menu>

  <!-- 叶子节点：菜单项 -->
  <el-menu-item v-else :index="item.path || ''">
    <span class="flex items-center">
      <span
        v-if="item.icon"
        :class="[item.icon, 'w-5', 'h-5', 'inline-block', 'mr-2', 'align-middle', 'text-current']"
      />
      <span class="align-middle">{{ item.title }}</span>
    </span>
  </el-menu-item>
</template>

<script setup lang="ts">
import { computed } from 'vue'

defineOptions({
  name: 'MenuItem',
})

export type MenuItem = {
  key: string
  title: string
  icon?: string
  path?: string
  children?: MenuItem[]
}

const props = defineProps<{
  item: MenuItem
}>()

const hasChildren = computed(
  () => Array.isArray(props.item.children) && props.item.children.length > 0,
)
</script>
