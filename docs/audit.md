# Audit — 2026-11-07

Branch `revamp` at `21f6bf0`. Every finding was checked by reading the file at that line. The toolchain results come from running the commands on this machine (Node 22.22.1, pnpm 10.9.0).

## Toolchain baseline

| Check | Result |
|---|---|
| `pnpm build` (`next build --no-lint`, Next 15.5.3) | Passes, with "⚠ Linting is disabled." 9 routes, `/` First Load JS 127 kB. |
| `tsc --noEmit` | Passes, 0 errors. |
| `pnpm lint` (`@antfu/eslint-config`) | **Fails: 1186 errors.** 1174 are auto-fixable formatting (semi 415, indent 375, member-delimiter 93, …). 10 are real code issues, listed in §3.8. |
| Tests | No runner installed; the only test file is 0 bytes. |
| Current Next.js | 16.4.5 (this repo is on 15.5.3). |

---

## 1. Your claims, verified

### 1.1 `syncFromAPI` overwrites stored todos on every load — **CONFIRMED, with scope**
- `src/lib/indexedDB.ts:128-147` does a `store.put()` of a fresh record for every API todo, with no check for an existing row. The fresh record has no `deletedAt` and new timestamps.
- It's called from `TodoService.initialize()` (`src/services/todoService.ts:19-26`), which fetches `https://dummyjson.com/todos?limit=150` (`todoService.ts:89`).
- "Every load" means every full page load. The guard is a module-level flag, `isInitialized` (`src/features/todos/hooks/useTodos.ts:8-14`), which resets when the page reloads and stays set across client-side navigations.
- Effect: edits and completion toggles on todos with ids 1–150 revert on the next reload, and deleting one of them comes back, because delete is a soft delete that sets `deletedAt` (`indexedDB.ts:110-117`) and the next `put` writes a record without it. Todos you created survive, because their `Date.now()` ids (`indexedDB.ts:84`) never collide with dummyjson ids.
- Related race: `isInitialized` is only set *after* the await (`useTodos.ts:11-12`). The home page mounts two `useTodos` queries in the same render (`src/app/page.tsx:20`, `src/features/todos/components/todoList.tsx:27`), so both run `initialize()`. That makes two dummyjson fetches and two `indexedDB.open()` calls on every load.

### 1.2 Header search has no handler; the bell does nothing — **CONFIRMED, and there's more**
- Search: `src/app/page.tsx:77-81` is an `<input>` with no `value`, `onChange`, label or `name`.
- Bell: `page.tsx:87-89` is a `<button>` with no `onClick` and no accessible name.
- Also dead: the calendar button at `page.tsx:90-92`, the "⋯" button at `page.tsx:268-270`, "View all N completed tasks" at `page.tsx:299-301`, all six sidebar links `href="#"` at `page.tsx:120-143`, and "Create your first todo" at `todoList.tsx:96-99`.

### 1.3 `getTodayLabel` compares today with itself — **CONFIRMED**
- `todoList.tsx:39-44`: `today` and `currentDate` are both `new Date()`, so `toDateString()` is equal every time and the function returns `'Today'`. The Yesterday and Tomorrow branches (`todoList.tsx:48-60`) can never run. Tasks have no date field to compare against anyway (see §3.1).
- Same family: the header weekday is the hardcoded string `"Tuesday"` (`page.tsx:94`). Today is a Saturday.

### 1.4 Home-page stats only count the first 100 todos — **CONFIRMED, and it's worse than "first 100"**
- `page.tsx:20` calls `useTodos({ limit: 100, skip: 0 })`, which slices the full result to 100 (`useTodos.ts:26-30`). The stats then use `todos.length` (`page.tsx:37`), not `result.total`.
- IndexedDB `getAll()` returns rows in ascending key order. The 150 dummyjson rows (ids 1–150) always come before your own rows (ids ≈ 1.7 × 10¹²), so **tasks you create are never counted in the stats.**
- The same ordering puts new tasks on the **last page** of the list, page 16 at 10 per page, never at the top.
- `completedTodos.slice(0, 3)` is commented "Show only recent 3" (`page.tsx:53`) but returns the three lowest ids, not the most recent.

### 1.5 `/auth/login`, `/auth/register`, `/settings`, `/todos` are placeholders — **CONFIRMED**
- `src/app/auth/login/page.tsx:1-8`, `src/app/auth/register/page.tsx:1-8`, `src/app/settings/page.tsx:1-8`, `src/app/todos/page.tsx:1-8` each render a heading and "… will go here".
- Their layouts are empty wrappers too: `src/app/auth/layout.tsx:7-10` renders the literal text "Auth Navigation"; `src/app/settings/layout.tsx` and `src/app/todos/layout.tsx` render a bare `<div>`.
- `src/config/paths.ts` builds URLs for these routes and is imported nowhere.

### 1.6 The home layout is a 12-column grid with no mobile layout — **CONFIRMED**
- `page.tsx:156` `grid grid-cols-12`, with `col-span-8` (`:158`) and `col-span-4` (`:173`), has no breakpoint prefixes.
- It sits inside a `flex` row (`page.tsx:103`) next to a fixed `w-64 flex-shrink-0` sidebar (`page.tsx:105`), so at 375px the sidebar alone takes 256px.
- The header (`page.tsx:64-97`) is a single `h-16` row with logo, a `mx-8` search, two icons and a date, all non-wrapping.
- There are two headers. The root layout renders a "Todo App" header (`src/app/layout.tsx:30-39`) and the page renders its own "Dashboard" header (`page.tsx:62-100`), each with `min-h-screen` wrappers (`layout.tsx:29`, `page.tsx:60`).

### 1.7 `src/api/`, `src/config/env.ts` and the empty `todos-api.ts` are unused — **PARTLY WRONG**
- `src/features/todos/api/todos-api.ts` is **0 bytes, unused**. Correct.
- `src/api/` and `src/config/env.ts` **are used.** `src/features/todos/hooks/useTodo.ts:2` imports `fetchTodo` from `@/api/api`, and `src/features/todos/components/todoDetail.tsx:6` uses that hook. `api-client.ts:1` imports `env`. So the `/todos/[id]` detail page **reads straight from dummyjson, not from IndexedDB.** That causes three bugs:
  1. A task you created (id `Date.now()`) shows "Todo Not Found" on its detail page, because dummyjson 404s.
  2. Editing on the detail page writes to IndexedDB (`useUpdateTodo`, `todoDetail.tsx:22,36`), then invalidates `['todo', id]` (`useTodos.ts:73`), which refetches the *original* text from dummyjson. The edit appears to undo itself immediately.
  3. Deleting on the detail page soft-deletes in IndexedDB, but the page keeps showing the task. `DeleteTodo` gets no `onSuccess` (`todoDetail.tsx:214`), so nothing navigates away, and the next reload resurrects it (§1.1).
- Unused parts *within* those modules: `addTodo`, `updateTodo`, `deleteTodo`, `login` (`src/api/api.ts:13-28`); `API_URL` (`src/config/env.ts:1`, flagged by lint).
- Delete is **only** reachable from that broken detail page. The list rows offer View and Edit only (`todoList.tsx:147-164`).

### 1.8 A test file exists with no test runner — **CONFIRMED, and the file is empty**
- `src/features/todos/tests/todoItem.test.tsx` is **0 bytes**. There's no `test` script and no Vitest, Jest or Testing Library in `package.json`.
- So "make the existing test run" has nothing to run. Vitest would fail it with "No test suite found". The plan writes that test (Phase 0).

### 1.9 The README is the default — **CONFIRMED**
- `README.md:1-36` is the create-next-app text. It tells people to use `npm`, `yarn` or `bun` (`:8-14`) and says the project uses Geist (`:21`), though it uses Inter (`layout.tsx:4,9`).

### 1.10 The build runs with `--no-lint` — **CONFIRMED, and it hides a failing lint**
- `package.json` `"build": "next build --no-lint"`. Build output confirms "⚠ Linting is disabled."
- `pnpm lint` fails with 1186 errors (see baseline), so the flag is what lets the build pass.
- Next 16 no longer runs lint during `next build`, so the flag goes away with the upgrade. Lint has to be its own gate (`pnpm lint && pnpm build`).

---

## 2. Most important things you missed

1. **Tailwind v3 opacity classes are silently dead under Tailwind 4.1.13.** `bg-opacity-*` was removed in v4; I checked the built CSS and it has no `bg-opacity` rules.
   - The modal overlay (`src/components/ui/modal.tsx:31`) and the delete-confirm overlay (`src/features/todos/components/deleteTodo.tsx:38`) are `bg-black bg-opacity-50`. They render **fully opaque black**, hiding the page.
   - The avatar circle (`page.tsx:108`) is `bg-white bg-opacity-20` behind white "TS" text, so it's **white on white**.
2. **Every mutation makes a network call.** `createTodo` and `updateTodo` call `syncTodoToAPI` (`todoService.ts:54,73`), which POSTs to `/todos/add` even for an *update* (`todoService.ts:102`). `deleteTodo` calls `DELETE /todos/:id` (`todoService.ts:83,125`), which 404s for local ids. Offline, each one logs an error.
3. **A delete can be undone by a sync race.** `syncTodoToAPI` re-saves the pre-delete record object (`todoService.ts:114`), and `saveTodo` builds a record without `deletedAt` (`indexedDB.ts:83-92`). If you delete a task while its POST is still in flight, the task comes back.
4. **The root layout is a client component.** `'use client'` at `src/app/layout.tsx:1` means it can't export `metadata`, so the app has no `<title>` or description (`Metadata` is imported and unused at `:3`). The `QueryClient` is created at module scope (`layout.tsx:11-18`), so during SSR it's shared across requests.

---

## 3. Everything else, by area

### 3.1 Data model
- There's no due date, created-at sort or any date the UI can group by. `Todo` is `{ id, todo, completed, userId }` (`src/types/api.ts:2-13`). The plan needs a schema change, not just UI.
- The `Todo` type is defined twice, in `src/types/api.ts:2-13` and `src/features/todos/types/todo.ts:1-12`. The second is imported nowhere.
- `useTodo` is defined twice with the same query key `['todo', id]` but different sources: IndexedDB in `useTodos.ts:38-47` (unused) and dummyjson in `useTodo.ts:4-10` (used). If both were ever mounted they'd overwrite each other's cache entry.
- `userId: 1` is hardcoded on create (`addTodoForm.tsx:24`), and "User {userId}" and "User ID" are shown in the UI (`page.tsx:290`, `todoDetail.tsx:183`). A single-user local app has no users.
- `useSyncStatus` polls IndexedDB every 30s (`useTodos.ts:92-101`) and is imported nowhere.
- `Date.now()` ids (`indexedDB.ts:84`) collide if two tasks are created in the same millisecond. `crypto.randomUUID()` doesn't.

### 3.2 List and row UI
- Clicking a task's text navigates to the broken detail page (`src/features/todos/components/todoItem.tsx:73-80`).
- Each row has a 32×32px badge showing the raw id (`todoList.tsx:171-173`). Local ids are 13 digits, which overflow it.
- "Priority: Moderate" and "Status: …" are hardcoded (`todoList.tsx:143-144`, `todoDetail.tsx:197`). The status repeats the badge next to it (`todoList.tsx:138-142`).
- `TodoItem`'s own edit mode (`todoItem.tsx:15-41,61-71,85-124`) is dead code: the list always passes `showActions={false}` (`todoList.tsx:132`) and uses `EditTodoForm` instead.
- `className="text-orange-500 !important"` (`todoList.tsx:109`): `!important` isn't a class, so it does nothing.
- The create form offers "Mark as completed" on a task that doesn't exist yet (`addTodoForm.tsx:57-67`).
- Pagination comes from `?page=&limit=` with no validation. `?page=abc` gives `NaN` skip (`todoList.tsx:21-23`).

### 3.3 Page chrome
- The real owner's email, `tonysmile.dev@gmail.com`, is hardcoded into the UI (`page.tsx:113`), along with "Tonysmile" (`page.tsx:112,152`).
- The footer is the create-next-app template: links to nextjs.org and Vercel templates with UTM params (`page.tsx:312-358`), and `aria-hidden` images that still carry alt text (`:320-321`).
- The sidebar nav items "Vital Task", "Task Categories" and "Help" (`page.tsx:124-143`) point at features that don't exist.

### 3.4 Accessibility
- The completion toggle is a `<button>` showing `✓` or nothing (`todoItem.tsx:46-56`), with no accessible name and no `aria-pressed`. A screen reader hears "button".
- These icon-only buttons have no accessible name: bell, calendar and ⋯ (`page.tsx:87,90,268`), and the modal close button (`modal.tsx:38-43`). The others rely on `title`, which isn't announced reliably.
- `Modal` and the delete confirm are plain `div`s (`modal.tsx:31`, `deleteTodo.tsx:38`): no `role="dialog"`, no `aria-modal`, no focus trap, Escape doesn't close them, focus isn't returned on close, and the background stays tabbable.
- The search input has no label (`page.tsx:77`). The form `<label>`s in the detail grid label nothing (`todoDetail.tsx:171-197`): they're `label` elements wrapping static text.
- The progress rings (`page.tsx:188-247`) are SVG with no text alternative beyond the % number, and their stroke colours are raw RGB values.
- The `transition-all duration-1000` ring animation (`page.tsx:208,245`) has no reduced-motion path.
- `page.tsx` has three `<h1>`s: "Dashboard" (`:67`), "Welcome back" (`:151`), and the root layout's "Todo App" (`layout.tsx:33`).

### 3.5 Routing and rendering
- `src/app/page.tsx:1` makes the whole home page a client component. There's nothing server-side for it to do in a local-first app, which is fine, but it's why nothing can be static.
- `src/app/todos/[id]/loading.tsx:1` has `'use client'` for a static spinner, which doesn't need it.
- `generateMetadata` on `/todos/[id]` (`page.tsx:28-35`) titles the page "Todo 1712345678901", which isn't useful.

### 3.6 Dead files and dependencies
- **Empty (0 bytes):** `src/components/pagination.tsx`, `src/components/ui/button.tsx`, `src/lib/constant.ts`, `src/features/todos/api/todos-api.ts`, `src/features/todos/tests/todoItem.test.tsx`.
- **Imported nowhere:** `src/config/paths.ts`, `src/lib/utils.ts` (`cn`), `src/features/todos/types/todo.ts`, `FetchResult` (`src/types/index.ts:11-16`), `User` and `LoginCredentials` (only used by the unused `login`), and the `onTodoPrefetch` prop (`todoList.tsx:15,18`). Unused state: `title`/`setTitle` in `createTodo.tsx:10`.
- **Unused dependencies:** `react-hook-form`, `zod`, `classnames`, `class-variance-authority`, and `clsx`/`tailwind-merge` (only used by the unused `cn`). Unused devDependency: `@eslint/eslintrc`.
- `components.json` sets up shadcn with a `@/hooks` alias for a directory that doesn't exist, and none of the shadcn components are installed. `globals.css:6-112` carries the full shadcn token set, of which only `--background`, `--foreground`, `--border` and `--ring` are used.

### 3.7 Config
- No `packageManager` field in `package.json`, so nothing stops `npm install` from creating a second lockfile.
- `eslint.config.mjs` uses antfu with no options, so the React and Next rule sets (hooks rules, `@next/next/*`) aren't on.
- No `test` script.

### 3.8 The 10 non-formatting lint errors
| File:line | Rule |
|---|---|
| `src/app/page.tsx:9` | `import/no-duplicates` (react imported twice) |
| `src/app/todos/[id]/page.tsx:13` | `unicorn/prefer-number-properties` (`isNaN`) |
| `src/config/env.ts:1` | `unused-imports/no-unused-vars` (`API_URL`) |
| `src/config/env.ts:1` | `node/prefer-global/process` |
| `src/features/todos/components/createTodo.tsx:10` | unused `title` |
| `src/features/todos/components/createTodo.tsx:10` | unused `setTitle` |
| `src/features/todos/components/todoList.tsx:18` | unused `onTodoPrefetch` |
| `src/services/todoService.ts:93,115,130` | `no-console` (×3) |

The other 1176 errors are formatting or import order, and 1174 of them are fixed by `eslint --fix`.
