import { defineConfig } from 'vite-plus'
import type { Plugin } from 'vite-plus'
import type { IncomingMessage, ServerResponse } from 'node:http'
import legacy from '@vitejs/plugin-legacy'
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
  response: (body: Record<string, any>, req?: IncomingMessage) => MockResponse
}

type RowStatus = 'online' | 'offline'
type ZoneCode = 'north' | 'south' | 'west'
type PriorityLevel = 'P1' | 'P2' | 'P3'
type SourceType = 'manual' | 'api' | 'import'

type MockPoint = {
  id: string
  name: string
  zone: ZoneCode
  status: RowStatus
  owner: string
  level: PriorityLevel
  source: SourceType
  updatedAt: string
  lon: number
  lat: number
  coord3857: [number, number]
  weight: number
}

type MockDeviceRow = {
  id: number
  name: string
  zone: ZoneCode
  status: RowStatus
  owner: string
  level: PriorityLevel
  source: SourceType
  lon: number
  lat: number
  coord3857: [number, number]
  updatedAt: string
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

const MAP_TOTAL = 100_000
const DASHBOARD_DEFAULT_LIMIT = 500
const MAP_CENTER_LON = 116.397
const MAP_CENTER_LAT = 39.908
const MAP_LON_RANGE = 2.4
const MAP_LAT_RANGE = 1.8

function random01(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

function lonLatTo3857(lon: number, lat: number): [number, number] {
  const x = (lon * 20037508.34) / 180
  const y = (Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180) / 180) * 20037508.34
  return [x, y]
}

function createPoint(id: number): MockPoint {
  const lon = MAP_CENTER_LON + (random01(id * 12.9898) * 2 - 1) * (MAP_LON_RANGE / 2)
  const lat = MAP_CENTER_LAT + (random01(id * 78.233) * 2 - 1) * (MAP_LAT_RANGE / 2)
  const zone: ZoneCode = id % 3 === 0 ? 'west' : id % 2 === 0 ? 'south' : 'north'
  const status: RowStatus = id % 2 ? 'online' : 'offline'
  const level = (['P1', 'P2', 'P3'] as const)[id % 3] ?? 'P1'
  const source = (['manual', 'api', 'import'] as const)[id % 3] ?? 'manual'

  return {
    id: String(id),
    name: `设备-${String(id).padStart(4, '0')}`,
    zone,
    status,
    owner: `owner-${(id % 20) + 1}`,
    level,
    source,
    updatedAt: `2026-03-${String((id % 28) + 1).padStart(2, '0')} 10:${String(id % 60).padStart(2, '0')}:00`,
    lon,
    lat,
    coord3857: lonLatTo3857(lon, lat),
    weight: 0.25 + random01(id * 31.4159) * 0.75,
  }
}

const MOCK_POINTS: MockPoint[] = Array.from({ length: MAP_TOTAL }, (_, index) =>
  createPoint(index + 1),
)

const MOCK_DEVICE_ROWS: MockDeviceRow[] = MOCK_POINTS.slice(0, DASHBOARD_DEFAULT_LIMIT).map(
  (point) => ({
    id: Number(point.id),
    name: point.name,
    zone: point.zone,
    status: point.status,
    owner: point.owner,
    level: point.level,
    source: point.source,
    lon: point.lon,
    lat: point.lat,
    coord3857: point.coord3857,
    updatedAt: point.updatedAt,
  }),
)

function numberOrUndefined(value: unknown): number | undefined {
  if (value === '' || value == null) return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

function matchesFilters(row: MockPoint | MockDeviceRow, filters: Record<string, unknown>): boolean {
  const keyword = String(filters.keyword || '')
    .trim()
    .toLowerCase()
  const owner = String(filters.owner || '')
    .trim()
    .toLowerCase()
  const lonMin = numberOrUndefined(filters.longitudeMin)
  const lonMax = numberOrUndefined(filters.longitudeMax)
  const latMin = numberOrUndefined(filters.latitudeMin)
  const latMax = numberOrUndefined(filters.latitudeMax)
  const status = typeof filters.status === 'string' ? filters.status : ''
  const zone = typeof filters.zone === 'string' ? filters.zone : ''
  const level = typeof filters.level === 'string' ? filters.level : ''
  const source = typeof filters.source === 'string' ? filters.source : ''
  const startedAt = typeof filters.startedAt === 'string' ? filters.startedAt : ''
  const endedAt = typeof filters.endedAt === 'string' ? filters.endedAt : ''
  const lon = 'lon' in row ? row.lon : undefined
  const lat = 'lat' in row ? row.lat : undefined

  if (keyword && !row.name.toLowerCase().includes(keyword) && !String(row.id).includes(keyword)) {
    return false
  }
  if (status && row.status !== status) return false
  if (zone && row.zone !== zone) return false
  if (owner && !row.owner.toLowerCase().includes(owner)) return false
  if (level && row.level !== level) return false
  if (source && row.source !== source) return false
  if (startedAt && row.updatedAt < startedAt) return false
  if (endedAt && row.updatedAt > endedAt) return false
  if (lon != null && lonMin != null && lon < lonMin) return false
  if (lon != null && lonMax != null && lon > lonMax) return false
  if (lat != null && latMin != null && lat < latMin) return false
  if (lat != null && latMax != null && lat > latMax) return false
  return true
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
  {
    method: 'POST',
    url: '/dashboard/query',
    delay: 120,
    response(body) {
      const filters = (body.filters || {}) as Record<string, unknown>
      const limit = Math.max(1, Math.min(500, Number(body.limit) || DASHBOARD_DEFAULT_LIMIT))
      const rows = MOCK_DEVICE_ROWS.filter((row) => matchesFilters(row, filters))

      return {
        code: 0,
        message: 'ok',
        data: {
          rows: rows.slice(0, limit),
          total: rows.length,
        },
      }
    },
  },
  {
    method: 'POST',
    url: '/map/points',
    delay: 160,
    response(body) {
      const filters = (body.filters || {}) as Record<string, unknown>
      const limit = Math.max(1, Math.min(MAP_TOTAL, Number(body.limit) || MAP_TOTAL))
      const rows = MOCK_POINTS.filter((row) => matchesFilters(row, filters)).slice(0, limit)

      return {
        code: 0,
        message: 'ok',
        data: {
          rows: rows.map((row) => ({
            id: row.id,
            lon: row.lon,
            lat: row.lat,
            coord3857: row.coord3857,
            weight: row.weight,
            type: row.zone,
          })),
          total: rows.length,
        },
      }
    },
  },
]

// ========== Vite 插件 ==========
function mockPlugin(): Plugin {
  return {
    name: 'mock-server',
    enforce: 'pre',
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
      targets: ['chrome >= 90'],
      renderLegacyChunks: false,
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
