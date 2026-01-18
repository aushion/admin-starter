<template>
  <div style="padding:16px">
    <h2>Console（主控台）</h2>

    <div style="display:flex; gap:12px; align-items:flex-end; flex-wrap:wrap">
      <label>
        关键词：
        <input v-model="draft.keyword" placeholder="name/id/type..." />
      </label>

      <label>
        类型：
        <select v-model="draft.type">
          <option value="">全部</option>
          <option value="A">A</option>
          <option value="B">B</option>
        </select>
      </label>

      <button @click="openMapScreen">打开地图大屏</button>
      <button @click="submit">查询并同步到地图</button>
    </div>

    <div style="margin-top:12px">
      <strong>地图点选回传：</strong>
      <span>{{ selectedId || '（暂无）' }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, reactive, ref } from 'vue';
import { createDualChannel } from '@/shared/channel';
import type { DualMsg, Filters } from '@/shared/protocol';

const ch = createDualChannel();
const selectedId = ref<string>('');

const draft = reactive<{ keyword: string; type: string }>({
  keyword: '',
  type: '',
});

function toFilters(): Filters {
  return {
    keyword: draft.keyword.trim(),
    type: draft.type || undefined,
  };
}

function makeRequestId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function openMapScreen() {
  // name 固定，避免开一堆地图窗口
  window.open(
    '/map-ol',
    'MapScreen',
    'popup=yes,width=1400,height=900'
  );
}

function submit() {
  const filters = toFilters();
  const requestId = makeRequestId();
  ch.send({ type: 'QUERY', payload: { requestId, filters } });
}

const off = ch.on((msg: DualMsg) => {
  if (msg.type === 'MAP_READY') {
    // 地图窗口刚打开/刷新，主窗口给它同步当前 filters
    ch.send({ type: 'SYNC_STATE', payload: { filters: toFilters() } });
  }
  if (msg.type === 'MAP_SELECT') {
    selectedId.value = msg.payload.id;
  }
});

onMounted(() => {});
onBeforeUnmount(() => {
  off?.();
  ch.close();
});
</script>
