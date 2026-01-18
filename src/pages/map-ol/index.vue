<template>
  <div style="width:100vw;height:100vh;position:relative;overflow:hidden">
    <div ref="mapEl" style="width:100%;height:100%"></div>

    <div style="position:absolute;left:12px;top:12px;background:rgba(0,0,0,.55);color:#fff;
                padding:10px 12px;border-radius:10px;max-width:45vw;font-size:12px">
      <div><strong>MapScreen（大屏）</strong></div>
      <div>filters: {{ JSON.stringify(filters) }}</div>
      <div>points: {{ pointCount }}</div>
      <div v-if="loading">loading...</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, shallowRef } from 'vue';
import { createDualChannel } from '@/shared/channel';
import type { DualMsg, Filters } from '@/shared/protocol';
import { throttle } from '@/shared/throttle';
import { extent3857ToBbox4326 } from '@/shared/geo';
import { fetchPoints } from '@/services/mapPoints';

// OpenLayers
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import WebGLPointsLayer from 'ol/layer/WebGLPoints';
import XYZ from 'ol/source/XYZ';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { fromLonLat } from 'ol/proj';
import type { Extent } from 'ol/extent';
import { Style, Circle as CircleStyle, Fill, Stroke } from 'ol/style';

const mapEl = ref<HTMLDivElement | null>(null);
const map = shallowRef<Map | null>(null);

const ch = createDualChannel();

const filters = ref<Filters>({});
const loading = ref(false);
const pointCount = ref(0);

let latestRequestId = '';
let aborter: AbortController | null = null;

// 海量点层（WebGL）
const pointsSource = new VectorSource({ wrapX: false });
const pointsLayer = new WebGLPointsLayer({
  source: pointsSource,
  // WebGLPoints 的样式是“表达式风格”
  // 这里用圆点示例：按 type 上色（你可按业务改）
  style: {
    symbol: {
      symbolType: 'circle',
      size: [
        'interpolate', ['linear'], ['zoom'],
        4, 3,
        10, 6,
        14, 10
      ],
      color: [
        'match', ['get', 'type'],
        'A', 'rgba(0,180,255,0.8)',
        'B', 'rgba(255,120,0,0.8)',
        'rgba(0,255,140,0.75)'
      ],
      opacity: 1,
    },
  } as any,
});

// 高亮层（少量要素，用普通 VectorLayer 画，保证图标/描边效果）
const highlightSource = new VectorSource({ wrapX: false });
const highlightLayer = new VectorLayer({
  source: highlightSource,
  style: new Style({
    image: new CircleStyle({
      radius: 10,
      fill: new Fill({ color: 'rgba(255,255,0,0.25)' }),
      stroke: new Stroke({ color: 'rgba(255,255,0,0.95)', width: 2 }),
    }),
  }),
});

function initMap() {
  const base = new TileLayer({
    source: new XYZ({
      // 你换成你内网 XYZ
      url: 'http://localhost:8080/xyz/{z}/{x}/{y}.png',
      // projection 默认跟 view 走 (EPSG:3857)
    }),
  });

  map.value = new Map({
    target: mapEl.value as HTMLDivElement,
    layers: [base, pointsLayer, highlightLayer],
    view: new View({
      projection: 'EPSG:3857',
      center: [12698529, 2577776], // 随便给个中心，你改成你们默认
      zoom: 10,
    }),
  });

  // 点选：回传 id + 在本地高亮
  map.value.on('singleclick', (evt) => {
    const hit = map.value!.forEachFeatureAtPixel(evt.pixel, (feat) => feat);
    if (!hit) return;

    const id = String(hit.get('id') ?? '');
    if (id) {
      ch.send({ type: 'MAP_SELECT', payload: { id } });
      highlightFeature(hit as Feature);
    }
  });

  // moveend 触发 bbox 查询（节流）
  const onMoveEnd = throttle(() => {
    loadByViewport();
  }, 350);

  map.value.on('moveend', onMoveEnd);
}

function getExtent3857(): Extent | null {
  const m = map.value;
  if (!m) return null;
  return m.getView().calculateExtent(m.getSize());
}

function highlightFeature(feat: Feature) {
  const geom = feat.getGeometry();
  if (!geom) return;

  highlightSource.clear();
  const hf = new Feature({
    id: feat.get('id'),
    geometry: geom.clone(),
  });
  highlightSource.addFeature(hf);
}

async function loadByViewport() {
  if (!filters.value || Object.keys(filters.value).length === 0) return;
  const m = map.value;
  if (!m) return;

  const extent = getExtent3857();
  if (!extent) return;

  // 取消前一次请求
  aborter?.abort();
  aborter = new AbortController();

  loading.value = true;

  // 默认把 bbox 转成 4326 发给后端（常见 lon/lat）
  const bbox4326 = extent3857ToBbox4326(extent);

  const rid = latestRequestId;

  try {
    const rows = await fetchPoints({
      filters: filters.value,
      bbox4326,
      signal: aborter.signal,
    });

    // 丢弃过期响应（用户又发了新查询）
    if (rid !== latestRequestId) return;

    // 构建 features（几万点：尽量字段轻量）
    pointsSource.clear(true);

    const feats = rows.map((r) => {
      const f = new Feature({
        geometry: new Point(fromLonLat([r.lon, r.lat])), // -> EPSG:3857
        id: r.id,
        type: r.type || '',
      });
      return f;
    });

    pointsSource.addFeatures(feats);
    pointCount.value = feats.length;
  } catch (e: any) {
    if (e?.name === 'AbortError') return;
    console.error(e);
  } finally {
    if (rid === latestRequestId) loading.value = false;
  }
}

function applyQuery(requestId: string, nextFilters: Filters) {
  latestRequestId = requestId;
  filters.value = nextFilters;

  // 清空旧数据 + 高亮
  pointsSource.clear(true);
  highlightSource.clear(true);
  pointCount.value = 0;

  loadByViewport();
}

const off = ch.on((msg: DualMsg) => {
  if (msg.type === 'SYNC_STATE') {
    // 地图刚打开：同步 filters，但不生成新 requestId
    filters.value = msg.payload.filters;
    return;
  }

  if (msg.type === 'QUERY') {
    applyQuery(msg.payload.requestId, msg.payload.filters);
    return;
  }

  if (msg.type === 'FOCUS') {
    const m = map.value;
    if (!m) return;
    const v = m.getView();

    if (msg.payload.coord3857) {
      v.animate({ center: msg.payload.coord3857, zoom: msg.payload.zoom ?? v.getZoom() ?? 12, duration: 350 });
    }
  }
});

onMounted(() => {
  initMap();
  ch.send({ type: 'MAP_READY' });
});

onBeforeUnmount(() => {
  off?.();
  aborter?.abort();
  ch.close();
  map.value?.setTarget(undefined as any);
});
</script>
