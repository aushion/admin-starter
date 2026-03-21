// Mock handler types — 供参考。实际 handlers 定义在 vite.config.ts 的 mockHandlers 数组中。
// 新增接口请直接在 vite.config.ts 的 mockHandlers 里追加。

export type MockResponse =
  | { code: 0; message: string; data: any }
  | { code: number; message: string }

export type MockHandler = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  url: string // path with leading slash after /api, e.g. '/auth/login'
  delay?: number
  response: (body: Record<string, any>) => MockResponse
}
