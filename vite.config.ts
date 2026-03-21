import { defineConfig } from 'vite-plus'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import UnoCSS from 'unocss/vite' // ⭐ 关键
import { fileURLToPath, URL } from 'node:url'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// Cesium 需要拷贝静态资源到 dist
const cesiumSource = 'node_modules/cesium/Build/Cesium'
const cesiumBaseUrl = 'cesium'

export default defineConfig({
  // 格式化配置 (Oxfmt - Prettier 兼容)
  fmt: {
    semi: false,
    singleQuote: true,
    trailingComma: 'all',
    printWidth: 100,
    tabWidth: 2,
    ignorePatterns: ['**/*.tsx'],
  },
  // 代码检查配置 (Oxlint)
  lint: {
    ignorePatterns: ['dist/**', 'public/**', 'node_modules/**'],
    plugins: ['typescript', 'vue', 'import', 'unicorn', 'promise'],
    categories: {
      correctness: 'error',
      suspicious: 'warn',
      perf: 'warn',
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'warn',
      'typescript/no-explicit-any': 'warn',
      'vue/no-unused-refs': 'warn',
    },
    options: {
      typeAware: true,
    },
  },
  // pre-commit 钩子
  staged: {
    '*': 'vp check --fix',
  },
  plugins: [
    vue(),
    vueJsx(),
    UnoCSS(), // ⭐ 关键
    viteStaticCopy({
      targets: [
        { src: `${cesiumSource}/Workers`, dest: cesiumBaseUrl },
        { src: `${cesiumSource}/Assets`, dest: cesiumBaseUrl },
        { src: `${cesiumSource}/Widgets`, dest: cesiumBaseUrl },
        { src: `${cesiumSource}/ThirdParty`, dest: cesiumBaseUrl },
      ],
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  define: {
    // Cesium 会用到
    CESIUM_BASE_URL: JSON.stringify(`/${cesiumBaseUrl}/`),
  },
})
