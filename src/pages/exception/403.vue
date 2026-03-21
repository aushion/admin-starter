<template>
  <div
    class="min-h-screen flex items-center justify-center bg-[var(--app-bg)] text-[var(--app-text)]"
  >
    <el-result icon="warning" title="无权限访问" sub-title="当前账号没有访问该页面的权限">
      <template #extra>
        <div class="flex items-center justify-center gap-3">
          <el-button type="primary" @click="$router.replace('/')">回到首页</el-button>
          <el-button @click="$router.back()">返回</el-button>
        </div>
      </template>
    </el-result>
  </div>
</template>

<script setup lang="ts">
defineOptions({
  name: 'ForbiddenPage',
})
</script>
