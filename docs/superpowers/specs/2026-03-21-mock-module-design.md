# Mock Module Design

**Date:** 2026-03-21
**Scope:** Dev-only mock server for existing auth API endpoints

---

## Goal

Add a zero-dependency mock module that intercepts `/api/auth/*` requests during development, enabling the login and register pages to work without a real backend.

---

## File Structure

```
mock/
  index.ts        # Collects and exports all handlers
  auth.ts         # Handlers for /auth/login and /auth/me
vite.config.ts    # Registers mockPlugin() in the plugins array
```

---

## MockHandler Type

```ts
type MockHandler = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  url: string // exact path match, e.g. '/auth/login'
  delay?: number // simulated network delay in ms (default 300)
  response: (body: any) => any // return value wrapped as { code, message, data }
}
```

---

## Vite Plugin (`mockPlugin`)

- Defined inline in `vite.config.ts`
- Only active in dev mode (`configureServer` is not called during build)
- Registers a Node.js `connect`-style middleware on the Vite dev server
- Middleware pipeline:
  1. Check `req.url` starts with `/api/`
  2. Strip `/api` prefix, then match against registered handlers by `method` + `url`
  3. Buffer and parse JSON request body
  4. Wait `handler.delay` ms (default 300)
  5. Call `handler.response(body)` and send `{ code: 0, message: 'ok', data: result }` as JSON
  6. If no handler matches, call `next()` to fall through to the normal proxy/network

---

## Auth Mock Handlers (`mock/auth.ts`)

| Method | Path          | Behavior                                                                                                                                 |
| ------ | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `POST` | `/auth/login` | If `body.username` is empty → `{ code: 400, message: '用户名不能为空' }`; otherwise → `{ code: 0, data: { token: 'mock-token-admin' } }` |
| `GET`  | `/auth/me`    | Always returns `{ code: 0, data: { id: '1', name: '管理员', roles: ['admin'] } }`                                                        |

---

## Response Envelope

All responses use the existing `ApiResp<T>` shape expected by `src/api/http.ts`:

```json
{ "code": 0, "message": "ok", "data": { ... } }
```

Error responses use a non-zero code so the axios interceptor shows the error message automatically.

---

## Constraints

- Mock only runs in dev (`vite dev`), never in production build
- No extra npm packages required
- `mock/` directory is excluded from the production build naturally (not imported by app code)
