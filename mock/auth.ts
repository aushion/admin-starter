// Auth mock handler definitions — 供参考。
// 实际生效的 handlers 在 vite.config.ts 的 mockHandlers 数组中。

// POST /auth/login
// body.username 为空 → { code: 400, message: '用户名不能为空' }
// 否则           → { code: 0,   message: 'ok', data: { token: 'mock-token-admin' } }

// GET /auth/me
// → { code: 0, message: 'ok', data: { id: '1', name: '管理员', roles: ['admin'] } }
