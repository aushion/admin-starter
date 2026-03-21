import { defineConfig } from 'vite-plus'
import type { Plugin } from 'vite-plus'
import type { IncomingMessage, ServerResponse } from 'node:http'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import UnoCSS from 'unocss/vite' // ⭐ 关键
import { fileURLToPath, URL } from 'node:url'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// Cesium 需要拷贝静态资源到 dist
const cesiumSource = 'node_modules/cesium/Build/Cesium'
const cesiumBaseUrl = 'cesium'

// ========== Mock 类型 ==========
type MockResponse = { code: 0; message: string; data: any } | { code: number; message: string }

type MockHandler = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  url: string // path with leading slash after /api, e.g. '/auth/login'
  delay?: number
  response: (body: Record<string, any>) => MockResponse
}

// ========== Mock handlers（新增接口在此追加） ==========
const mockHandlers: MockHandler[] = [
  {
    method: 'POST',
    url: '/auth/login',
    delay: 400,
    response(body) {
      if (!body.username) return { code: 400, message: '用户名不能为空' }
      return { code: 0, message: 'ok', data: { token: 'mock-token-admin' } }
    },
  },
  {
    method: 'GET',
    url: '/auth/me',
    delay: 200,
    response() {
      return { code: 0, message: 'ok', data: { id: '1', name: '管理员', roles: ['admin'] } }
    },
  },
]

// ========== Vite 插件 ==========
function mockPlugin(): Plugin {
  return {
    name: 'mock-server',
    order: 'pre',
    configureServer(server) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        if (!req.url?.startsWith('/api/')) return next()

        // '/api/auth/login' → '/auth/login'（保留 leading slash）
        const plainPath = req.url.replace(/^\/api/, '').split('?')[0]
        const method = req.method?.toUpperCase() ?? 'GET'
        const handler = mockHandlers.find((h) => h.method === method && h.url === plainPath)
        if (!handler) return next()

        const needsBody = ['POST', 'PUT', 'PATCH'].includes(method)

        const respond = (body: Record<string, any>) => {
          setTimeout(() => {
            let result
            try {
              result = handler.response(body)
            } catch {
              result = { code: 500, message: 'Mock handler error' }
            }
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(result))
          }, handler.delay ?? 300)
        }

        if (needsBody) {
          const chunks: Buffer[] = []
          req.on('data', (chunk: Buffer) => chunks.push(chunk))
          req.on('end', () => {
            let body: Record<string, any> = {}
            try {
              body = JSON.parse(Buffer.concat(chunks).toString())
            } catch {
              // empty or non-JSON body — default {}
            }
            respond(body)
          })
        } else {
          respond({})
        }
      })
    },
  }
}

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
    '*': 'vp fmt --write',
  },
  plugins: [
    mockPlugin(),
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
