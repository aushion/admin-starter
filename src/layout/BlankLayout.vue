<template>
  <RouterView />
</template>

<script setup lang="ts"></script>

<style scoped>
/* 可选：如果你希望大屏永远无滚动条 */
:global(html, body, #app) {
  height: 100%;
  margin: 0;
}
</style>
