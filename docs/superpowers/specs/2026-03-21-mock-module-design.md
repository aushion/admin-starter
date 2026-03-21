# Mock Module Design

**Date:** 2026-03-21
**Scope:** Dev-only mock server for existing auth API endpoints

---

## Goal

Add a zero-dependency mock module that intercepts `/api/auth/*` requests during development, enabling the login page to work without a real backend.

---

## File Structure

```
mock/
  index.ts        # Defines MockHandler / MockResponse types, collects and exports all handlers
  auth.ts         # Handlers for /auth/login and /auth/me
vite.config.ts    # Defines mockPlugin() inline (order: 'pre'), imports from mock/index.ts
```

---

## Types (defined in `mock/index.ts`)

```ts
// Discriminated union: success carries data, error does not
export type MockResponse =
  | { code: 0; message: string; data: any }
  | { code: number; message: string }

export type MockHandler = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  url: string // path with leading slash after /api, e.g. '/auth/login'
  delay?: number // middleware uses handler.delay ?? 300 ms
  response: (body: Record<string, any>) => MockResponse
}

export const handlers: MockHandler[] = [...authHandlers]
```

---

## Vite Plugin (`mockPlugin` in `vite.config.ts`)

**Compatibility:** `vite-plus`'s `defineConfig` is a transparent wrapper over Vite — the existing config already uses `vue()`, `UnoCSS()`, and `viteStaticCopy()` as standard Vite plugins with no issues. The mock plugin follows the same pattern and is typed as Vite's `Plugin`.

```ts
import type { Plugin } from 'vite'
import { handlers } from './mock/index'

function mockPlugin(): Plugin {
  return {
    name: 'mock-server',
    order: 'pre',
    configureServer(server) {
      server.middlewares.use(mockMiddleware)
    },
  }
}
```

**Middleware pipeline:**

1. `req.url` does not start with `/api/` → call `next()` immediately
2. Extract plain path: `req.url.slice(4).split('?')[0]`
   - `/api/auth/login` → slice(4) → `/auth/login` → no query → `/auth/login`
   - `/api/auth/me?foo=1` → slice(4) → `/auth/me?foo=1` → split → `/auth/me`
   - Handler `url` values include the leading slash (e.g. `'/auth/login'`), so match is exact
3. Find handler: `handlers.find(h => h.method === req.method?.toUpperCase() && h.url === plainPath)`; if none → `next()`
4. **Body parsing:**
   - For methods with a body (`POST`, `PUT`, `PATCH`): buffer `data` events, concatenate, `JSON.parse`; default to `{}` on empty or parse failure
   - For methods without a body (`GET`, `DELETE`): skip buffering, pass `{}` directly to handler
5. Await `handler.delay ?? 300` ms via a `setTimeout` promise
6. Call `handler.response(body)` → `MockResponse`
7. Set `res.statusCode = 200` and `Content-Type: application/json`
8. Write `JSON.stringify(mockResponse)` and end the response
9. If `handler.response()` throws: respond `{ code: 500, message: 'Mock handler error' }`

---

## Auth Mock Handlers (`mock/auth.ts`)

| Method | Path          | Behavior                                                                                                                                     |
| ------ | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST` | `/auth/login` | `username` empty → `{ code: 400, message: '用户名不能为空' }`; otherwise → `{ code: 0, message: 'ok', data: { token: 'mock-token-admin' } }` |
| `GET`  | `/auth/me`    | → `{ code: 0, message: 'ok', data: { id: '1', name: '管理员', roles: ['admin'] } }`                                                          |

Note: password is not validated — intentional for a dev mock.

---

## Response Contract

- HTTP status is always `200`; error signaling is done via JSON `code`, consistent with the existing axios interceptor in `http.ts`
- `code: 0` responses always include `data`; non-zero responses omit `data` — matching the `MockResponse` discriminated union

---

## Constraints

- Dev only (`configureServer` is not invoked during production build)
- No extra npm packages required
- `mock/` files are Node.js context only — never imported by app source code
