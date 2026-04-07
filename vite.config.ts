import { defineConfig } from 'vite-plus'
import type { Plugin } from 'vite-plus'
import type { IncomingMessage, ServerResponse } from 'node:http'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import UnoCSS from 'unocss/vite' // ⭐ 关键
import legacy from '@vitejs/plugin-legacy'
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
  response: (body: Record<string, any>, req?: IncomingMessage) => MockResponse
}

// ========== Mock 用户数据 ==========
type MockUser = {
  id: string
  name: string
  roles: string[]
  permissions: string[]
  token: string
}

const MOCK_USERS: Record<string, MockUser> = {
  admin: {
    id: '1',
    name: '管理员',
    roles: ['admin'],
    permissions: ['*'],
    token: 'mock-token-admin',
  },
  ops: {
    id: '2',
    name: '运营',
    roles: ['ops'],
    permissions: [
      'dashboard:view',
      'dashboard:open-map',
      'dashboard:query',
      'charts:view',
      'charts:export',
      'map:cesium',
      'map:ol',
      'excel:view',
    ],
    token: 'mock-token-ops',
  },
  viewer: {
    id: '3',
    name: '访客',
    roles: ['viewer'],
    permissions: ['dashboard:view'],
    token: 'mock-token-viewer',
  },
}

const MOCK_PASSWORDS: Record<string, string> = {
  admin: 'admin123',
  ops: 'ops123',
  viewer: 'viewer123',
}

function findUserByToken(token: string): MockUser | undefined {
  return Object.values(MOCK_USERS).find((u) => u.token === token)
}

// ========== Mock handlers（新增接口在此追加） ==========
const mockHandlers: MockHandler[] = [
  {
    method: 'POST',
    url: '/auth/login',
    delay: 400,
    response(body) {
      const { username, password } = body
      if (!username) return { code: 400, message: '用户名不能为空' }
      if (!password) return { code: 400, message: '密码不能为空' }

      const expected = MOCK_PASSWORDS[username as string]
      if (!expected || expected !== password) {
        return { code: 401, message: '用户名或密码错误' }
      }

      const user = MOCK_USERS[username as string]
      return { code: 0, message: 'ok', data: { token: user.token } }
    },
  },
  {
    method: 'GET',
    url: '/auth/me',
    delay: 200,
    response(_body, req) {
      const auth = req?.headers?.authorization as string | undefined
      const token = auth?.replace('Bearer ', '') ?? ''
      const user = findUserByToken(token)

      if (!user) return { code: 401, message: '登录已过期，请重新登录' }

      return {
        code: 0,
        message: 'ok',
        data: {
          id: user.id,
          name: user.name,
          roles: user.roles,
          permissions: user.permissions,
        },
      }
    },
  },
  {
    method: 'POST',
    url: '/auth/logout',
    delay: 100,
    response() {
      return { code: 0, message: 'ok', data: null }
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
              result = handler.response(body, req)
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
    legacy({
      // 兼容目标：Chrome 90+（Chrome 105 在此范围内）
      targets: ['chrome >= 90'],
      // 不生成独立的 legacy bundle（无需支持 IE11），
      // 只向现代 bundle 注入缺失 API 的 polyfill
      renderLegacyChunks: false,
      // 自动检测代码中用到的 API 并注入对应 core-js polyfill
      modernPolyfills: true,
    }),
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
