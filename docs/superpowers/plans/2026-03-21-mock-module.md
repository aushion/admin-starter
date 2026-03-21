# Mock Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a zero-dependency Vite dev-server middleware that intercepts `/api/auth/*` requests and returns mock responses, so login works without a real backend.

**Architecture:** A `mock/` directory holds typed handler definitions (`auth.ts`) and a central type/registry file (`index.ts`). A Vite plugin registered in `vite.config.ts` with `order: 'pre'` reads those handlers and adds a `connect`-style middleware to the dev server that matches method+path, delays, and responds with a full `ApiResp` JSON envelope.

**Tech Stack:** Vite plugin API (`configureServer`), Node.js `http.IncomingMessage`, TypeScript

---

## File Map

| Action | Path                 | Responsibility                                                |
| ------ | -------------------- | ------------------------------------------------------------- |
| Create | `mock/index.ts`      | `MockHandler`/`MockResponse` types + `handlers` flat array    |
| Create | `mock/auth.ts`       | Auth mock handlers — imports types from `mock/index.ts`       |
| Modify | `tsconfig.node.json` | Add `mock/**/*.ts` to `include` so tsc type-checks mock files |
| Modify | `vite.config.ts`     | Import `handlers`, define and register `mockPlugin()`         |

Import direction: `mock/index.ts` imports handler values from `mock/auth.ts`; `mock/auth.ts` imports types from `mock/index.ts`. Type imports are erased at compile time — no circular runtime dependency.

---

### Task 1: Create `mock/index.ts` — types and handler registry

**Files:**

- Create: `mock/index.ts`

- [ ] **Step 1: Create `mock/index.ts`**

```ts
// mock/index.ts
import { authHandlers } from './auth'

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

- [ ] **Step 2: Commit**

```bash
git add mock/index.ts
git commit -m "feat(mock): add MockHandler types and handler registry"
```

---

### Task 2: Create `mock/auth.ts` — auth handlers

**Files:**

- Create: `mock/auth.ts`

- [ ] **Step 1: Create `mock/auth.ts`**

```ts
// mock/auth.ts
import type { MockHandler } from './index'

export const authHandlers: MockHandler[] = [
  {
    method: 'POST',
    url: '/auth/login',
    delay: 400,
    response(body) {
      if (!body.username) {
        return { code: 400, message: '用户名不能为空' }
      }
      return { code: 0, message: 'ok', data: { token: 'mock-token-admin' } }
    },
  },
  {
    method: 'GET',
    url: '/auth/me',
    delay: 200,
    response() {
      return {
        code: 0,
        message: 'ok',
        data: { id: '1', name: '管理员', roles: ['admin'] },
      }
    },
  },
]
```

- [ ] **Step 2: Commit**

```bash
git add mock/auth.ts
git commit -m "feat(mock): add auth mock handlers (login, me)"
```

---

### Task 3: Add `mock/**/*.ts` to `tsconfig.node.json`

`tsconfig.node.json` currently only includes `vite.config.ts`. Since `vite.config.ts` imports from `mock/`, the mock files must be in scope for type-checking.

**Files:**

- Modify: `tsconfig.node.json`

- [ ] **Step 1: Update `include` in `tsconfig.node.json`**

Change:

```json
"include": ["vite.config.ts"]
```

To:

```json
"include": ["vite.config.ts", "mock/**/*.ts"]
```

- [ ] **Step 2: Commit**

```bash
git add tsconfig.node.json
git commit -m "chore: include mock/ files in tsconfig.node.json"
```

---

### Task 4: Register `mockPlugin` in `vite.config.ts`

**Files:**

- Modify: `vite.config.ts`

Note: `tsconfig.node.json` has `verbatimModuleSyntax: true`, so type-only imports must use `import type`.

- [ ] **Step 1: Add imports at the top of `vite.config.ts`**

After the existing imports, add:

```ts
import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { handlers } from './mock/index'
```

- [ ] **Step 2: Add `mockPlugin` function before `export default defineConfig(...)`**

```ts
function mockPlugin(): Plugin {
  return {
    name: 'mock-server',
    order: 'pre',
    configureServer(server) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        if (!req.url?.startsWith('/api/')) return next()

        // slice(4) on '/api/auth/login' → '/auth/login' (keeps leading slash)
        const plainPath = req.url.slice(4).split('?')[0]
        const method = req.method?.toUpperCase() ?? 'GET'
        const handler = handlers.find((h) => h.method === method && h.url === plainPath)
        if (!handler) return next()

        const needsBody = ['POST', 'PUT', 'PATCH'].includes(method)

        const respond = (body: Record<string, any>) => {
          const delay = handler.delay ?? 300
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
          }, delay)
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
```

- [ ] **Step 3: Prepend `mockPlugin()` to the existing `plugins` array**

The current plugins array is `[vue(), vueJsx(), UnoCSS(), viteStaticCopy({...})]`.
Add only `mockPlugin()` as the first entry — leave all existing entries unchanged:

```ts
plugins: [
  mockPlugin(),
  vue(),
  vueJsx(),
  UnoCSS(),
  viteStaticCopy({ targets: [...] }), // keep existing targets as-is
],
```

- [ ] **Step 4: Verify dev server starts without TypeScript errors**

```bash
npm run dev
```

Expected: server starts on port 5180, no errors in the terminal.

- [ ] **Step 5: Test login mock — success case**

Navigate to `http://localhost:5180/login`, enter any non-empty username + any password, click 登录.

Expected:

- ~400ms delay (loading state visible on button)
- `ElMessage` shows "登录成功"
- Redirect to `/`

- [ ] **Step 6: Test login mock — error case**

Navigate back to `http://localhost:5180/login`, leave username empty, click 登录.

Expected:

- `ElMessage` shows "用户名不能为空"
- Stays on login page

- [ ] **Step 7: Commit**

```bash
git add vite.config.ts
git commit -m "feat(mock): register Vite mock plugin for dev auth endpoints"
```
