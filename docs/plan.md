# Plan — v1, a local-first task app

The findings this plan fixes are in `docs/audit.md`. Each phase lands as its own commits on `revamp`, and a phase starts only after the one before it passes its **Verified by** checks. Every phase ends with these gates passing:
- `pnpm lint && pnpm build && pnpm test` (from Phase 0 on);
- `pnpm test:db` as well, from Phase 9 on;
- the **CRUD smoke check** (from Phase 2 on): in `pnpm dev`, add a task, edit it, complete it, delete it, then hard-reload. The data must match what was on screen before the reload.

Each choice marked ◆ gets an entry in `docs/decisions.md`. The review history is in `docs/decisions.md`; Codex review 1 (2026-11-07) reshaped Phases 0, 2, 3, 4 and 11.

## Approved decisions

These went beyond the original brief. The owner approved all of them on 2026-11-07, and each gets its `docs/decisions.md` entry in the phase that implements it.

1. **Delete `/todos/[id]` too, not just the four placeholder routes.** With edit-in-place, a detail page has nothing left to do, and the current one reads from dummyjson (audit §1.7). It's also the only dynamic route, so removing it lets the app ship as a fully static export (decision 2).
2. **`output: 'export'`.** The app is static files. Accounts don't change that: auth and sync talk to Supabase from the browser through its client SDK, with no server of our own (decision 6). That keeps offline caching simple and lets it deploy anywhere.
3. **Drop TanStack Query.** It's built for caching *remote* data: stale times, refetching, deduping. Here the UI reads only local data, which changes only when we write to it. A reactive read of IndexedDB gives instant updates. The alternative was keeping Query and invalidating after every write; it lost because invalidation is how the current detail page shows stale data (audit §1.7). **Addendum (owner):** the reactive read is Dexie's `useLiveQuery`. Phase 3 confirms it and logs it.
4. **A "No date" group and a "Done" section.** The four requested groups (Overdue, Today, Tomorrow, Upcoming) have no place for a task without a due date, or for completed tasks in the "All" view. No-date tasks go after Upcoming; completed tasks collapse into a "Done" section at the bottom.
5. **Editing a sample task makes it yours.** "Clear sample tasks" removes only the tasks still marked as samples. Editing a sample's title or date clears the mark, so clearing samples never deletes something you've worked on. Just completing a sample doesn't count as editing it.
6. **Optional accounts, still local-first (owner).** Anyone can use the app immediately as a guest. Signing in syncs tasks across devices through Supabase: email and password, or Google, with a row-level-security Postgres table. Dexie stays the only thing the UI reads. Phases 9 and 10.

## Invariants every phase must keep

These come out of Codex reviews 1 and 2. Any phase that breaks one has failed, whatever its own checks say.

- **No task is ever destroyed except by the user deleting it.** Migrations import; they never drop user rows.
- **A delete is a tombstone, and it is terminal.** Deleting sets `deletedAt` in the same transaction that reads the current row. The only thing that can clear `deletedAt` is that delete's own undo, on the same device, before the delete has synced.
- **Undo touches nothing but `deletedAt`.** It never writes back a remembered copy of the task, so it can't overwrite an edit made in another tab.
- **Edits refuse tombstoned rows.** `update` checks `deletedAt` inside its own transaction. Every read-check-write runs in one IndexedDB `readwrite` transaction, never a read in one transaction and a write in another. This was fixed in today's code in `9a665b0`, and it holds for the Dexie layer too.
- **Every task id is a UUID**, from creation or import onwards, because the server table's key is `uuid`.
- **The server decides conflicts; clients converge on its answer.** Last-write-wins and tombstone-wins run only in the Postgres trigger. A client never compares its own `updatedAt` with the server's: it adopts the server's row for anything it hasn't changed locally since its last push.

---

## Phase 0 — Guardrails
**Changes**
- **Stop the overwrite now.** Remove the `syncFromAPI()` call in `TodoService.initialize()` (`src/services/todoService.ts:22`) and the background `syncTodoToAPI` and `deleteTodoFromAPI` calls (`todoService.ts:54,73,83`). Audit §1.1 then stops for anyone running the branch, and no task is overwritten during Phases 1–2.
- Add `"packageManager": "pnpm@10.9.0"` and `"engines": { "node": ">=20.9" }` to `package.json`.
- Turn on antfu's React and Next rule sets (`antfu({ react: true, nextjs: true })`). Run `pnpm lint --fix` once, as a **formatting-only commit**, then fix the remaining real errors (audit §3.8) by hand in a separate commit.
- Add Vitest, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom` and `@vitejs/plugin-react`. Add `vitest.config.ts` with the `@/` alias and a setup file, plus `"test": "vitest run"` and `"test:watch": "vitest"`.
- Write `src/features/todos/tests/todoItem.test.tsx`, which is currently 0 bytes. It renders the current `TodoItem` inside a `QueryClientProvider` and asserts that the text renders, completed tasks get struck through, and clicking the toggle calls the update mutation.
- **Portfolio correction, today** (in `~/projects/personal/nextjs/my-portfolio`, under its own `CLAUDE.md`). Remove the claims that are false right now: TanStack Router and Form, Zod, the `Pagination` split, and "mobile first" (rows marked **now** in the Phase 12 table). Replace them with one honest line about the current app. Phase 12 writes the v1 copy.

**Why** Every later phase is judged by lint, build and tests, so those gates have to exist and pass first. Keeping the auto-fix in its own commit means the 1174-line reformat never mixes with a real change in a diff or in `git blame`. The `TodoItem` test is a characterization test: it pins the current behaviour so the test setup is proven before the component is replaced. The overwrite fix is one deleted line, so there's no reason to keep a data-loss bug alive through two phases of unrelated work. The portfolio fix needs none of v1, and the false claims are live on the resume today.

**Verified by** `pnpm lint` exits 0. `pnpm test` runs one file and passes. `pnpm build` passes (still with `--no-lint` until Phase 1). `git show --stat` on the format commit shows formatting only. Edit a task, hard-reload, and the edit is still there. The Network tab shows no dummyjson request on load. In the portfolio, the `grep` from Phase 12 finds no TanStack, Zod or Pagination claim, and its `pnpm lint && pnpm build` passes.

## Phase 1 — Upgrade to Next.js 16
**Changes**
- Upgrade `next` and `eslint-config-next` from 15.5.3 to 16.4.5 (current today; re-check at the start of the phase), and `react` and `react-dom` to the matching 19.2.x. Use `pnpm dlx @next/codemod upgrade latest`, then review its diff.
- Change the build script to plain `next build`, since Next 16 no longer lints during build.
- Make `src/app/layout.tsx` a server component that exports `metadata` (title, description, theme color, viewport). Move providers into a small `'use client'` `providers.tsx` that creates its client in `useState`, not at module scope (audit §2.4). This is temporary: Phase 3 removes TanStack Query, and `providers.tsx` goes with it if nothing else needs it.
- Remove the duplicate root-layout header (audit §1.6).

**Why** Upgrading before writing the new code means the new code is written once against v16 APIs, not migrated later. Fixing the root layout here is cheap because it's the upgrade's main touchpoint anyway.

**Verified by** `pnpm build` output reports Next.js 16.4.5 and Turbopack. `pnpm lint && pnpm test` pass. The page `<title>` is set (check in DevTools Elements). `/` renders the same list as before.

## Phase 2 — Remove what v1 doesn't have, as one complete cutover
**Changes**
- Delete the routes `src/app/auth/**`, `src/app/settings/**`, `src/app/todos/**` (including `[id]`, per decision 1).
- In the same commit, delete everything that reaches the detail route:
  - `src/features/todos/components/todoDetail.tsx`, `deleteTodo.tsx` and `src/features/todos/hooks/useTodo.ts`;
  - the `Link`s and View buttons to `/todos/:id` in `todoItem.tsx:73-80,107-113` and `todoList.tsx:147-153`.

  The task text becomes plain text until Phase 4.
- Delete `src/api/`, `src/config/`, `src/types/index.ts`, `src/features/todos/api/`, `src/features/todos/types/todo.ts`, the four other empty files (audit §3.6) and `components.json`.
- Remove from the home page the bell, calendar and ⋯ buttons, the sidebar nav, the hardcoded user, name and email, the "Tuesday" label, and the template footer.
- Remove the unused dependencies (audit §3.6).

**Why** Dead routes and buttons are what makes this read as unfinished, and every file removed is one fewer thing the new data layer has to stay compatible with. Removing the route and everything that imports or links to it in one commit is what keeps the build green: deleting `useTodo.ts` alone breaks `todoDetail.tsx:6` (Codex review 1).

~~Removing the only delete control here loses nothing that works.~~ **Corrected by Codex review 4:** that reasoning was stale. Once Phase 0 stopped dummyjson reseeding, a delete from the detail page did persist. So Phase 2 now ends with a Delete button on each list row (`7250234`, see `docs/decisions.md`), and Phase 4 replaces it with delete-with-undo.

**Verified by** `pnpm build` route list shows `/` and `/_not-found` only. `grep -rn "todos/\${\|/todos/" src` finds nothing. `grep -rn "dummyjson" src` finds only `todoService.ts`'s base URL, which goes in Phase 3. `pnpm lint && pnpm test` pass. `git ls-files src | xargs wc -c | awk '$1==0'` lists nothing. The CRUD smoke check passes, delete included.

## Phase 3 — A data layer that never overwrites, with the current UI rewired to it ◆
**Status: done** (`f610633`). The outcome is recorded in `docs/decisions.md`.

**Changes**
- Add `dexie` (4.4.x) and `dexie-react-hooks` (4.4.x). The hooks package accepts React ≥16 and Dexie ≥4.2, so React 19 is fine.
- `src/features/tasks/store/db.ts` defines a `Dexie` subclass for a new database `tasks`. The schema includes the sync fields now, so Phase 10 doesn't need a data migration:
  ```ts
  db.version(1).stores({
    tasks: 'id, ownerId, [ownerId+dirty], isSample',
    meta: 'key',
  })
  ```
  - A task is `{ id, ownerId, title, completed, dueDate, isSample, dirty, rev, createdAt, updatedAt, completedAt, deletedAt }`:
    - `id` comes from `crypto.randomUUID()`;
    - `ownerId` is `'guest'` or a Supabase user id;
    - `dueDate` is `'YYYY-MM-DD' | null`;
    - `isSample` and `dirty` are `0 | 1`, because booleans can't be IndexedDB keys;
    - the timestamps are epoch ms numbers, and `deletedAt` is `number | null`;
    - `rev` is a local mutation counter that every local write increments. Push acknowledgement (Phase 10) compares revisions, not timestamps, because two edits can land in the same millisecond and a clamped server timestamp won't match the local one.
  - `completed` and `deletedAt` aren't indexed; they're filtered in memory.
  - `meta` is a key–value store for sync cursors, once-only flags and `installId`, a random UUID written in `populate` that identifies this browser's database.
- **Repository** of plain async functions over `db.tasks`. Every write runs inside a `db.transaction('rw', …)` that reads the current row first:
  - `add`;
  - `update`, which rejects if the row is tombstoned and sets `updatedAt`, `dirty = 1` and `rev + 1`;
  - `remove`, which tombstones the row and returns a one-shot undo token `{ id, rev }`; a second `remove` on the same row is a no-op that returns no token. (Since Codex review 7 the token matches a dedicated `deletedRev` set only by the delete, so later writes to the tombstone can't invalidate it.)
  - `undoRemove(token)`, which clears `deletedAt` only if the row is still tombstoned at the token's `rev`. **Built with `rev`, not `deletedAt` as first planned:** two deletes in the same millisecond share a timestamp, so a `deletedAt` token could undo a newer delete;
  - `clearSamples`, which tombstones `where('isSample').equals(1)`.
- **Read hooks** `useTasks` and `useStats` wrap `useLiveQuery` and return only `ownerId === currentOwner && deletedAt === null` rows. Components call the hooks and the repository and never touch `db` directly, which keeps store logic out of components (CLAUDE.md).
- **Seeding**: `db.on('populate', …)` bulk-adds the tasks from `src/features/tasks/data/sample-tasks.ts`. Dexie fires `populate` exactly once, when the database is first created, inside the same upgrade transaction. The samples' due dates are day offsets (−2, 0, +1, +5, null) resolved against today, so every group has an example whatever day it is.
- **Legacy import, as a versioned cutover** (Codex reviews 1 and 2). Deleting `TodoAppDB` would destroy the user's tasks. Snapshotting it while an old tab can still write would lose that tab's later writes.
  - **Cut over first:** open `TodoAppDB` at **version 2** with the raw `indexedDB.open('TodoAppDB', 2)`.
    - If `onupgradeneeded` reports `oldVersion === 0`, the database never existed. Abort the upgrade so no empty database is created; there's nothing to import.
    - Otherwise the upgrade adds a `cutover` store. It can only run once every version-1 connection has closed. The old wrapper ignores `versionchange`, so an old tab blocks it, and `onblocked` fires instead.
    - While blocked, the app runs normally without the legacy rows and shows "Close other tabs of this app to finish bringing over your tasks". The upgrade proceeds by itself when they close.
    - Once the database is at version 2, old code can never open it again: its version-1 request fails with `VersionError`. So no legacy write can happen after the snapshot.
  - **Select (after the cutover):** read every `todos` row with no `deletedAt` where either `isLocal === true` (the user created it) or `updatedAt > createdAt` (a dummyjson row the user changed after its last sync).
  - **Map:** each row becomes a guest task with `title` from `todo`, `completed`, `dueDate: null`, `isSample: 0`, and the original timestamps. Its id is a **UUID v5 of the old id, namespaced by this database's `installId`**, using the `uuid` package. That makes it a valid `uuid` for the server table (Codex review 2), and it's the same on every retry, so the import stays idempotent. It's also different on every other device: two browsers both holding a dummyjson row 7 import different ids, so they can't overwrite each other after both sign in to the same account.
  - **Write insert-only:** use `bulkAdd`, and ignore per-row `ConstraintError`s. A row already imported, perhaps by another tab or an interrupted earlier run, is skipped rather than overwritten, so an edit made after import survives a re-run.
  - **Mark it done in the destination, atomically:** write `legacyImportedAt` to the tasks database's `meta` store in the same transaction as the inserts, and check it first on every run. **Changed after Phase 4:** a marker kept only in the source let a retry re-insert a task whose tombstone the purge had removed. `TodoAppDB`'s `cutover` store still gets `importedAt`, but only as a hint. The source is **never deleted** in v1: it's a few kilobytes, and keeping it means a bug in this import can be fixed and re-run.
- **Rewire the existing UI in this phase.** Replace `useTodos`, `useAddTodo`, `useUpdateTodo` and `useDeleteTodo` in `page.tsx`, `todoList.tsx`, `todoItem.tsx`, `addTodoForm.tsx`, `editTodoForm.tsx` and `createTodo.tsx` with the new hooks and repository. The row's Delete button calls `remove()`, so delete becomes a tombstone here, with no undo until Phase 4. Keep their markup; Phase 4 replaces it. Update `todoItem.test.tsx` to render against `fake-indexeddb` instead of a `QueryClientProvider`.
- **Then** delete `src/lib/indexedDB.ts`, `src/services/todoService.ts`, `src/features/todos/hooks/useTodos.ts`, TanStack Query and its devtools (decision 3), and `providers.tsx` if it's empty. No `fetch` remains anywhere.
- **Loading vs empty**: `useLiveQuery` returns `undefined` until the first result arrives. The list treats `undefined` as loading and `[]` as empty, so the "No tasks" state never flashes on load.
- **Server rendering**: the static export prerenders `/` in Node, where `indexedDB` doesn't exist. The `db` instance is only touched from client hooks and repository calls, never at module top level on a server path.
- Tests load `fake-indexeddb/auto` from its own setup file, `vitest.idb.ts`, listed first in `setupFiles`, and delete both databases in `afterEach`. It can't share a file with anything that imports Dexie: Dexie captures `indexedDB` at import time, and the import sorter reorders side-effect imports.

**Decide and log (◆): Dexie + `useLiveQuery` over a hand-written wrapper.** The owner's direction is to adopt it unless a concrete reason against turns up in this phase. What I've already checked (on 2026-11-07): React 19 peer support, a once-only `populate` hook that fits seed-once better than a hand-rolled flag, and `fake-indexeddb` compatibility for tests. None is a reason against. Two things are still to check in the phase:
1. The First Load JS change for `/` in the build output. Dexie is far bigger than `idb`, so record before and after in the log entry.
2. That the export prerenders without "indexedDB is not defined".

The log entry's alternative is `idb` plus `useSyncExternalStore`: smaller, but it hand-builds change notification. Dexie's live queries re-run automatically when a write touches the rows they read, including writes from another tab, which a hand-written store would only get with a `BroadcastChannel`.

**Why** Audit §1.1 is the core bug: a remote copy kept overwriting the local one. Making IndexedDB the only thing the UI reads, and making every write a read-check-write inside one transaction, removes the problem at the root instead of trying to merge copies.

Tombstones instead of hard deletes serve two purposes:
- Undo becomes "clear one field" instead of "write back a snapshot", which closes Codex's stale-restore case: tab B's edit can't be overwritten by tab A's undo.
- Phase 10 needs tombstones anyway so that deletes don't come back from another device.

Putting the sync fields in the v1 schema costs nothing now and means users' data never has to go through a Dexie version upgrade later. Rewiring the old components in the same phase as removing the old store is what keeps every gate green between phases (Codex review 1). Storing `dueDate` as a local calendar date string, not a `Date`, avoids a task due "today" sliding to yesterday across timezones; a timestamp at local midnight lost because it encodes the timezone at write time.

**Verified by** `pnpm build` prerenders `/` with no IndexedDB error, and the First Load JS delta is recorded in the decision entry. The CRUD smoke check passes. These repository tests:
- **Seeding:** open twice and there are still 5 samples.
- **Persistence:** an edit survives a reopen, and a delete survives a reopen.
- **Tombstones:** `update` on a tombstoned row rejects; a second `remove` returns no token.
- **Undo:**
  - `undoRemove` restores the row, and keeps an edit made in another connection *before* the delete;
  - a second `undoRemove` with the same token is a no-op;
  - a token from an older delete can't undo a newer one.
- **Samples:** `clearSamples` leaves user tasks and edited samples.
- **Legacy import:**
  - it imports user-created and user-modified rows and skips tombstoned and untouched dummyjson rows;
  - a re-run after an edit keeps the edit;
  - running it twice concurrently (two connections) creates no duplicates;
  - an import that throws midway leaves `TodoAppDB` in place;
  - **an old tab writing during migration:** a version-1 connection that ignores `versionchange` adds a row, and the cutover waits. When it closes, the row is imported. After that, a new version-1 open fails;
  - every imported id is a valid UUID; the same old id under two different `installId`s gives two different ids; a retry gives the same id.
- **Live query:** a component using `useTasks` re-renders after `add()` with no manual refresh.

## Phase 4 — Core task UI ◆
**Status: done.** The decisions are in `docs/decisions.md`.

**Changes**
- Rebuild the list as `TaskList`, `TaskGroup` and `TaskItem`, replacing the Phase 3 rewired components:
  - The completion control is a real `<input type="checkbox">` with the task title as its label.
  - The title is a button that switches to an input: Enter or blur saves, Escape cancels.
  - The due date uses a native `<input type="date">`.
  - Delete is a button with an accessible name.
- **Grouping**: a pure `groupTasks(tasks, today)` returns Overdue, Today, Tomorrow, Upcoming, No date and Done (decision 4). Within a group, tasks sort by due date, then by creation time.
- **Delete with undo**:
  - Delete calls `remove()`, which tombstones the row (Phase 3).
  - A toast with an Undo button shows for 6s, announced through an `aria-live="polite"` region; Undo calls `undoRemove(token)`.
  - Focus moves to the next row, or to the group heading if the row was last.
  - A tombstone stays local until the toast has closed, so a synced delete never needs to be undone (Phase 10).
  - Guest tombstones older than 24 hours are purged on boot, because nothing will ever sync them. (First built as "older than the undo window"; Codex review 6 showed another tab's boot could then delete a row a paused Undo still pointed at.)
- **Add**: a single-line form at the top of the list (title plus optional date). It becomes a bottom sheet on phones in Phase 6.
- **Clear sample tasks** (from the v1 brief, which no phase had owned): a button under the list while any samples remain. It clears them with one Undo for all of them; `clearSamples()` returns a token per task.
- **Today follows the clock**: `useToday()` re-groups at local midnight and when the tab becomes visible again, so a list left open overnight moves Tomorrow into Today.
- Rewrite `todoItem.test.tsx` against `TaskItem`, renamed to `taskItem.test.tsx`.

**Why** A tombstone with field-level undo means a reload or closed tab during the toast leaves the data matching what was on screen (deleted). The undo can't resurrect stale content, because it never writes content. The trade-off is that undo doesn't survive a reload, which matches what users expect from a toast. Grouping is a pure function that takes `today` as an argument, so the midnight and month-boundary cases can be tested without faking the clock.

**Verified by** `groupTasks` unit tests cover the end of a month, the end of a year, a leap day, overdue completed tasks (they go to Done, not Overdue) and null dates. Component tests check that add, edit (Enter, blur, Escape), toggle, delete, and undo restoring position all work, and that a double-click on Delete shows one toast. The full CRUD smoke check passes, delete included. `audit §1.3` can no longer happen: there is no "today label" function left.

## Phase 5 — Search, filters, stats, shortcuts ◆
**Status: done.** The decisions are in `docs/decisions.md`.

**Changes**
- **Search** is a labelled `<input type="search">` that matches titles case- and accent-insensitively (`normalize('NFD')`). It's debounced only for the URL, not for filtering.
- **Filters** are All, Active, Done, Today and Overdue, built as native radio inputs inside a `<fieldset>` with a legend, styled as a segmented control. Search and filter live in the URL (`?q=&filter=`) so Back and reload keep them.
- **Stats** come from `computeStats(allTasks, today)`: total, done, active, overdue, due today and completion %. They're computed over every live task, not a page (audit §1.4), and the stats text is the accessible label for its ring.
- **Shortcuts**: `n` focuses the add form (or opens the sheet), `/` focuses search, and `Escape` leaves either. A shortcut is ignored while focus is in an input, textarea or contenteditable, or while Ctrl, Meta or Alt is held.
- ~~Pagination goes away.~~ Done early, in Phase 3: deleting the last row on page 2 stranded an empty page (Codex review 5), and clamping code that was due for deletion wasn't worth writing.

**Why** Filtering is a pure function over data already in memory, so it's instant and doesn't need a debounce. A debounce would only make results lag behind typing. URL state is the cheapest way to make filters survive a reload without another store.

**Verified by**
- Unit tests: `filterTasks` × each filter × search, `computeStats` on 0, 1 and 500 tasks.
- Component tests: typing `n` inside the search box types an "n" and doesn't jump focus; `/` from the list focuses search; reloading with `?filter=overdue` restores the filter.

## Phase 6 — Mobile-first layout, dates and a friendlier header ◆
**Status: done.** Brought forward by the owner on 2026-11-07, because the app was unusable on a phone: at 390px the desktop dashboard squeezed into two columns, the "New task" and "Due date" labels overlapped, and the stats rings collided. This replaces the earlier, narrower Phase 6 (single column, sheet, tap targets), which it includes. So the phases after it keep their numbers, and existing references stay valid.

**Changes**
1. **One column, phone first:** header, add form, search and filters, task groups, then the summary. Two columns (tasks plus a summary side column) only from 768px. Nothing overlaps or scrolls sideways at 360, 390 or 768. Touch targets are at least 44px.
2. **The old dashboard grid is gone.** The stats are a compact summary row: Done, Open, Overdue and Due today, four across on a phone and 2×2 in the side column. The rings and the "Completed tasks" panel are removed.
3. **Dates:**
   - Every task shows when it was added, from its automatic `createdAt`: "Added today, 9:30", "Added yesterday, 18:05", "Added 3 Nov", or "Added 3 Nov 2025" in another year. The user never types it.
   - The due date is optional and secondary: a small Due chip offering Today, Tomorrow and Pick a date (plus No due date once one is set), not a bare date field beside the title. It reads "Due today", "Due Fri 13 Nov" or "Overdue · Tue 3 Nov".
   - A task added while the Today filter is on gets today as its due date, and the add form's chip shows it before adding.
4. **On phones, adding opens a bottom sheet** from a floating "Add a task" button. The sheet is a native `<dialog>` opened with `showModal()`, slides up (instantly with reduced motion), and has the title field focused. It closes on Escape, the backdrop, Close, or after adding, which announces "Added …", and focus returns to the button. On phones, `n` opens it.
5. **A friendly header:** "Good morning, Toni · Saturday 7 November". A first name is asked for once, optional and skippable (the skip is remembered too), and kept on the device in the `meta` store. In Phase 9 a signed-in user's name comes from the account instead. The greeting and date render only in the browser, because the page is prerendered at build time and a build-time greeting would be stale and cause a hydration error.

**Verified by**
- **Unit tests:** the "Added" and "Due" wording, including the year end, and the greeting by hour.
- **Component tests:**
  - the Due chip: Today, Tomorrow, Pick a date, No due date, and Escape returning focus;
  - the sheet opening with the title focused, closing on Escape with focus back on the button, closing after an add with an announcement, and opening on `n`;
  - the Today filter's default due date, and changing it;
  - the name prompt: save, skip remembered, 40-character limit;
  - the summary counts.
- **Real-browser screenshots at 360, 390 and 768**, measured for horizontal overflow, overlapping text boxes, text off-screen, clipped labels, and the filters on one line. The open sheet at 390 is measured for being modal and having the title field focused.
- **Browser smoke checks:** Phases 4 and 5, and the legacy import.

## Phase 7 — Priorities and categories ◆
**Status: done.** The decisions are in `docs/decisions.md`.

Requested by the owner on 2026-11-07: bring back the old app's dead "Vital Task" and "Task Categories" links (audit §3.3) as real features. Inserted after the layout phase; the later phases moved up by one.

**Changes**
- **Vital:**
  - Any task can be flagged Vital with a star toggle on its row (`aria-pressed`).
  - A Vital filter joins All, Active, Done, Today and Overdue.
  - Within each date group, Vital tasks come first. Done keeps completion order, because ranking finished work by importance isn't useful.
- **Categories (labels):**
  - Labels you create, each with a name (up to 40 characters, unique per person, ignoring case) and a colour from a fixed palette of eight chosen for contrast.
  - A task can carry several labels; they show as small coloured chips on its row, and a Labels chip opens a checklist to assign them.
  - A Labels manager (a `<dialog>`) creates, renames, recolours and deletes labels. Delete asks for confirmation, says how many tasks use the label, and removes it from those tasks in the same transaction.
  - A "Label" select next to the filters narrows the list to one label (`?label=` in the URL). An unknown or deleted label id is treated as "all labels".
- **Defaults that never hide a new task:** with the Vital filter on, a new task is vital; with a label filter on, it gets that label. This matches the Today rule from Phase 6.
- **Dexie schema version 2:**
  - Adds a `categories` table (`id, ownerId, [ownerId+dirty]`) with the same sync fields as tasks (`dirty`, `rev`, `deletedAt`, timestamps).
  - Adds a multi-entry index on `tasks.categoryIds`.
  - The upgrade only adds defaults to existing tasks (`vital: 0`, `categoryIds: []`); it never rewrites or drops a row.
  - New databases are created at version 2 directly, and their `populate` seeds one sample task as Vital.
- **Rendering ignores label ids that aren't live labels.** After sync, a task may still point at a label deleted on another device.

**Why** Both features were promised by the old dashboard's navigation and never built. Vital-first ordering inside the existing date groups keeps one mental model (when), with importance as a tiebreak, instead of a second competing sort. Labels are many-to-many because "work" and "errand" aren't exclusive. A fixed palette guarantees readable chips in both themes; free colour picking can't.

The migration is additive because the bar is that nothing the user wrote is ever lost. Dexie's `upgrade()` runs inside the version-change transaction, so a failure rolls the whole upgrade back and leaves version 1 intact.

**Verified by**
- **Unit tests:**
  - `filterTasks` with Vital, with a label, and with both plus search;
  - `groupTasks` putting Vital first and leaving Done alone;
  - label name validation.
- **Migration test:** a real version-1 database with tasks, a tombstone and `meta` entries opens as version 2 with every row and field intact plus the new defaults; reopening is idempotent.
- **Component tests:**
  - the Vital toggle;
  - assigning and removing labels;
  - the label manager: create, a duplicate name rejected, rename, recolour, and delete with confirmation removing the label from its tasks;
  - the Vital and label filters, and their defaults for new tasks.
- **Browser checks:** the layout screenshots at 360, 390 and 768 still show no overlap or sideways scroll with labels on the rows, and the smoke checks still pass.

## Phase 8 — Accessibility pass
**Status: done, except the screen-reader run**, which needs a person with Orca and VoiceOver. A script for it is below. The decisions are in `docs/decisions.md`.

**Changes**
- Each group is a `<section>` with a heading, holding a `<ul>` (built in Phase 4; check it here). There's one `<h1>`.
- A skip link and visible `:focus-visible` rings.
- A single polite live region for add, delete, undo, complete and clear announcements.
- Contrast is checked for every text and state colour. `vitest-axe` runs on the main views.
- Fix whatever the manual pass finds.

**Why** Phases 4–6 build accessibility in as they go. This phase is the outside check that it actually works together, because axe catches roughly a third of real issues and a screen reader catches the rest.

**Verified by** axe reports zero violations in the component tests. A keyboard-only run covers every feature without the mouse. A screen-reader run (Orca on Linux, plus VoiceOver on a phone) covers add, complete, edit, delete and undo, with each change heard. Lighthouse Accessibility scores 100.

**How it was actually verified:**
- **`axe-core` 4.14 directly**, in place of the `vitest-axe` wrapper (0.1.0, years old). In jsdom it runs on the home page, the open Due and Label choosers, the labels manager and the sheet.
- **Contrast, which jsdom can't compute,** is checked by injecting axe into the production build in Chromium, at 360 and 768, with all eight label colours on rows, plus the open sheet and the manager. This stands in for Lighthouse, whose accessibility score is these same axe rules.
- **The keyboard-only run uses trusted key events:** skip link, `n`, add, Tab to the task, Space to complete, Enter to edit, Tab to Delete, and Ctrl+Z to undo.

**Screen-reader script (still to do by hand),** with Orca in Firefox or Chrome on Linux, and VoiceOver in Safari on an iPhone:
1. Load the app. The first Tab reads "Skip to tasks"; Enter lands on the task list.
2. Press `n` (desktop) or tap "Add a task" (phone). You hear the "New task" field. Type a title and press Enter. You hear "Added …" only if the current view hides it; otherwise the new row is there.
3. Tab to its checkbox (named by the title) and press Space. You hear "Completed …", and focus is still on that task, now under Done.
4. Activate "Edit "…"", change the text and press Enter. Focus returns to the title.
5. Activate "Delete "…"". You hear "Deleted …". Press Ctrl+Z (⌘Z on a Mac). You hear "Restored …", and focus is on the task.
6. Open the Due chip ("Due date for …: none") and choose Tomorrow. Open the Labels chip and tick one. Each change is heard on the chip.

### Checkpoint — ship the guest app
**Status: ready, waiting for the owner's merge.** The README top section and screenshots are done, and a pull request from `revamp` into `main` is open with its Vercel preview checked. The merge itself is left to the owner, because it replaces the live link on the resume.

Merge `revamp` to `main` and deploy, so the live link on the resume shows a working app while Phases 9–11 are built. Before merging, update the README's top section with a one-line pitch, a screenshot and the live link; Phase 12 does the full README. **Verified by** the CRUD smoke check on the production URL, on a phone.

**Why** (Codex review 1) The recruiter-facing result shouldn't wait for sync and offline work. A working guest app is already a complete product.

## Phase 9 — Accounts: Supabase project, schema, row-level security, sign-in ◆
**Prerequisites**
- **Docker**, for the Supabase local stack. It isn't installed on this machine today.
- A Google Cloud OAuth client, for Google sign-in.
- A transactional email provider's SMTP credentials (see "Free plan" below).

**Changes**
- **Supabase CLI** (`supabase` devDependency, 3.x): `supabase init` creates `supabase/config.toml` and `supabase/migrations/`. All schema changes are migration files in the repo, never dashboard edits.
- **Table** `public.tasks`:
  - `id uuid primary key`
  - `user_id uuid not null default auth.uid() references auth.users on delete cascade`
  - `title text not null check (char_length(title) between 1 and 10000)`. That's 10,000, not the 500 you can type: tasks imported from the old app keep their full text, however long (Codex review 5). The 500 limit is enforced by the client for new and grown titles.
  - `completed boolean not null default false`
  - `due_date date`
  - `created_at`, `updated_at`, `completed_at`, `deleted_at` as `timestamptz` (`updated_at not null`)
  - `server_updated_at timestamptz not null default now()`
  - an index on `(user_id, server_updated_at, id)`, matching the pull's keyset order
  - `vital boolean not null default false` and `category_ids uuid[] not null default '{}'` (Phase 7)
- **Table** `public.categories` (Phase 7), with the same sync shape as `tasks`:
  - `id uuid primary key`
  - `user_id uuid not null default auth.uid() references auth.users on delete cascade`
  - `name text not null check (char_length(name) between 1 and 40)`
  - `color text not null check (color in (<the eight palette keys>))`
  - `created_at`, `updated_at`, `deleted_at` as `timestamptz`, and `server_updated_at timestamptz not null default now()`
  - an index on `(user_id, server_updated_at, id)`
  - the same RLS policies, the same `before update` trigger (last write wins, terminal tombstones, clamp, `server_updated_at`), and the same 8s statement timeout
  - no database-level unique constraint on the name: two devices can create "Work" offline, and a unique index would make the second push fail. The client prevents duplicates locally, and Phase 10 shows a duplicate pair with a "Merge" action rather than rejecting one.
- **Row-level security**:
  - `alter table tasks enable row level security`, plus `revoke all on tasks from anon`.
  - Policies for `select`, `insert` and `update`, `to authenticated`, `using ((select auth.uid()) = user_id)`, with the same `with check` on insert and update.
  - **No delete policy.** Deletes are tombstones, and rows only disappear through the account's `on delete cascade`.
- **`before update` trigger** that enforces the sync rules on the server, so no client can bypass them:
  - `user_id` can't change;
  - `deleted_at := coalesce(old.deleted_at, new.deleted_at)`, so a tombstone is terminal;
  - if `new.updated_at <= old.updated_at`, the incoming fields are discarded and only the tombstone rule applies (last write wins, decided atomically in the database);
  - `updated_at` is clamped to at most `now() + interval '5 minutes'`;
  - `server_updated_at := now()`.
- **Bounded transactions**: the migration sets `alter role authenticated set statement_timeout = '8s'`. Each PostgREST request is a single transaction, so a write can't commit more than 8s after its `server_updated_at` stamp. Phase 10's pull overlap relies on that bound.

  A `before insert` trigger applies the same clamp and sets `server_updated_at`.
- **Client**: `@supabase/supabase-js` (2.x) with `createClient(url, publishableKey, { auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: true } })`.
  - No `@supabase/ssr`, because there's no server.
  - The client module is **dynamically imported** only when env vars are present and the user opens sign-in or already has a session, so guests don't download it.
- **Auth UI** in a `<dialog>`: email and password sign-up and sign-in, password reset, "Continue with Google", and sign out. A status chip shows Guest, Synced, Syncing, Offline, or Accounts unavailable.
- **The header's name** comes from the account for a signed-in user (Phase 6 keeps a guest's name on the device). On first sign-in, a device name can seed an empty account name; it's never overwritten silently.
- **Environment**:
  - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the `sb_publishable_…` key; Supabase is deprecating the legacy `anon` key by the end of 2026).
  - Add `.env.example` with both names and no values. Add `!.env.example` to `.gitignore`, because the existing `.env*` rule (`.gitignore:34`) would otherwise ignore it.
  - The secret key never appears in the repo, the client or CI; tests use the local stack's keys.
  - With the variables unset (a fresh clone), the app is guest-only and the sign-in button is hidden.
  - Production values are set in the Vercel project settings, and Next inlines them at build time.
- **Redirect URLs** in Supabase Auth settings: the production origin, `http://localhost:3000`, and the Vercel preview wildcard.
- **`pnpm test:db`**: runs `supabase start` (Docker), applies the migrations, and runs `src/**/*.db.test.ts` against the local stack. The plain `pnpm test` stays Docker-free, so the everyday gate works anywhere. A GitHub Actions workflow runs both on every push, because GitHub's runners have Docker.

**Free plan, and how the plan handles it** (checked 2026-11-07 on supabase.com/pricing and the docs):
- The limits are 2 active projects, a 500 MB database, 5 GB egress, 50,000 monthly active users, and 200 concurrent realtime connections. A task row is well under 1 kB, so these limits aren't the constraint.
- **Idle projects are paused after 7 days of low activity**, measured by database queries; dashboard visits don't count. Supabase emails a warning first, and a paused project can be restored from the dashboard for up to a year. The plan handles it in three layers:
  1. **The app doesn't depend on Supabase being up.** A paused, unreachable or misconfigured backend surfaces as "Accounts unavailable". Signed-in users keep working on their local copy with changes queued (Phase 10), guests are unaffected, and the sign-in dialog explains instead of failing silently.
  2. **Keep-alive** (◆): a scheduled GitHub Actions workflow calls a `public.ping()` SQL function (returns `1`, executable by `anon`, touches no table) every 3 days, using only the publishable key. This is a common practice but not endorsed by Supabase, so log it. If the project still pauses, it means a table-free query isn't counted as activity. In that case switch the ping to a one-row read from a dedicated `public.heartbeat` table readable by `anon`. Check after the first 8 idle days. The alternative is the paid plan, which never pauses; that lost because it costs money for a portfolio project with almost no traffic.
  3. **Restore procedure** written in the README: what to do if the warning email arrives.
- **Built-in email only delivers to the project's team members, and sends at most 2 messages per hour.** That means public email sign-up can't work on the default email service at all. Before email sign-up is enabled in production, configure **custom SMTP** with a transactional email provider; Supabase's default limit then becomes 30 emails per hour, adjustable under Auth → Rate Limits. Google sign-in sends no email, so it works either way. Disabling email confirmation was rejected: it lets anyone register an address they don't own.

**Why** Row-level security is the only thing between one user's tasks and another's, because the publishable key is public by design. That's why it's tested against a real Postgres rather than mocked. Putting the last-write-wins and tombstone rules in a database trigger means two devices pushing at the same moment are serialized by Postgres, not by client code that can race.

`server_updated_at` exists because the client's `updated_at` can't be used as a pull cursor. A device that was offline for a week pushes edits with week-old timestamps, which are *older* than every other device's cursor, so they'd never be pulled. A server-assigned time always moves forward.

**Verified by** These `pnpm test:db` tests, each with two real users A and B against the local stack, run for both `tasks` and `categories`:
- **Reads:** B's `select` returns none of A's rows. An `anon` client's `select` returns nothing.
- **Writes:** B's `update … where id = <A's id>` affects 0 rows. B's insert with `user_id = A` is rejected. B's `upsert` of a row using A's id fails and leaves A's row unchanged. B can't change `user_id` on B's own row.
- **Trigger rules:**
  - an update with an older `updated_at` doesn't change the row;
  - an update that clears `deleted_at` leaves it set;
  - a future `updated_at` is clamped;
  - `server_updated_at` increases on every write.

Manually: sign up with email (confirmation arrives through custom SMTP), sign in with Google, and sign out, on the production URL. With the env vars removed, the build is guest-only and the sign-in button is hidden.

## Phase 10 — Sync ◆
**Changes**
- **Two tables, one engine.** Categories (Phase 7) sync exactly like tasks: the same dirty/rev push, the same overlap pull and the same tombstone rules. Push categories before tasks, so a task never arrives on the server pointing at a label the server hasn't seen. A task's `vital` and `categoryIds` are ordinary fields under the same last-write-wins trigger. Clients ignore label ids that aren't live labels, because a label can be deleted on one device while another assigns it offline.
- **`src/features/tasks/sync/`** is an engine behind a `Remote` interface (`pull(since)`, `push(rows)`). It has a Supabase implementation and an in-memory fake for unit tests. The UI never calls it; it only writes to Dexie, and live queries pick up the result.
- **Push**:
  - Send rows with `ownerId = user` and `dirty = 1`, skipping tombstones still inside their undo window. Remember each row's `rev`.
  - Upsert them in batches of 100 with `.select()`, so the response is the **authoritative row as the trigger stored it**: its winning fields, its clamped `updated_at` and its terminal `deleted_at`.
  - **Acknowledge** in one transaction per batch:
    - if a row's local `rev` still equals the sent `rev`, replace the local row with the server's row and clear `dirty`;
    - if `rev` has moved on (an edit landed during the push), keep the local row and leave it dirty, so it goes out next time. Adopt only the server's `deletedAt` if it's set, because tombstones win.

  A device whose clock runs fast therefore stores the server's clamped timestamp, not its own. Its local copy can't stay "ahead" of the server and win later comparisons (Codex review 2).
- **Pull**:
  - Fetch rows with `server_updated_at >= meta.cursor[user] − 60s`, ordered by `(server_updated_at, id)`, in keyset pages (`> (last_ts, last_id)`), so equal timestamps can't fall between pages.
  - The 60-second overlap covers late commits. `now()` is the transaction's *start* time, so a transaction stamped earlier can commit after a pull has moved past its stamp. The 8s statement timeout (Phase 9) bounds that lag, and 60s is well beyond it. Re-applying rows from the overlap is harmless because applying is idempotent.
  - Apply each page in one transaction. The client doesn't compare timestamps:
    - an unknown id is inserted;
    - a local row that isn't dirty is replaced by the server's row;
    - a dirty local row is left alone (its push will let the trigger decide), except that the server's `deletedAt` is adopted if set.
  - Advance the cursor to the max `server_updated_at` seen, only after the page's transaction commits.
- **Bootstrap**: with no cursor for the user, as on first sign-in or after sign-out, pull everything for that user from the beginning. That runs through the same apply rules, so retained dirty rows are kept and then pushed.
- **When it runs**: on sign-in, when the tab becomes visible, on the `online` event, 2s after the last local write, and every 60s while the tab is visible. Failures back off exponentially up to 5 minutes. No realtime subscription in v1: it isn't needed for correctness, and it counts against the 200-connection limit.
- **Unreachable backend**: a network error, a 5xx or a paused project sets the status to Offline or Accounts unavailable and nothing else. Dirty rows persist, so nothing queued is lost.
  - A signed-in user keeps working on the persisted session while offline.
  - If the session can't refresh once the network is back, the user is asked to sign in again, and the queued rows wait.
- **First sign-in import**:
  - If the device has guest tasks that aren't tombstoned, a dialog offers "Add N tasks from this device to your account", with sample tasks excluded by default and a checkbox to include them.
  - Accept: one transaction sets `ownerId = user` and `dirty = 1` on them, and ids are kept, so a retry can't duplicate.
  - A guest task whose title is over the server's 10,000-character cap (possible only from the legacy import) is kept on the device as a guest task and listed in the dialog as "too long to sync". It's never dropped or truncated.
  - Decline: they stay as guest tasks, visible when signed out.
  - The offer is made once per account per device (a `meta` flag), and "Import tasks from this device" stays in the account menu afterwards.
- **Sign out**: push first.
  - If dirty rows can't be pushed, warn "N changes haven't synced yet. They'll stay on this device and sync next time you sign in." Those rows are kept, hidden, under that `ownerId`, and never deleted.
  - Synced rows for that user are removed from the device, so the next person on a shared device doesn't see them. **The same transaction deletes `meta.cursor[user]`**, so the next sign-in bootstraps from scratch. Otherwise a pull from the old cursor would never bring back the unchanged rows that sign-out evicted (Codex review 2).
- **Tombstone retention**:
  - Local tombstones for a signed-in user are purged once synced and older than 30 days.
  - Server tombstones are never purged, because they're what stops an old offline device from resurrecting a task.

**Why** This follows the owner's rules: Dexie is the only source the UI reads, `updatedAt` decides conflicts per task, and `deletedAt` tombstones stop deletes coming back.

The one place the rules need a tiebreak is a delete on device A against a later edit on device B. Pure last-write-wins would let B's edit resurrect the task, which breaks "a task deleted on one device stays deleted". So **the tombstone always wins**, on the client and in the server trigger. The cost is that an edit made on another device after the delete is discarded; log that trade-off.

Holding a delete locally for the 6s undo window means undo never has to travel over the network, which is what keeps tombstones terminal everywhere.

The conflict rule runs in exactly one place: the Postgres trigger, which compares the incoming and stored `updated_at` inside the row lock. Clients never compare timestamps, they adopt the server's answer. So two devices can't reach different verdicts, and a fast clock is bounded by the 5-minute clamp on the server. Because clients adopt the clamped row on acknowledgement, the clamp actually sticks. The residual risk is that a clock up to 5 minutes fast can still win a conflict it shouldn't; log it.

**Verified by**
- **Unit tests** with two Dexie databases (two "devices") and the fake remote:
  - delete on A, sync A, sync B, and B's task is tombstoned;
  - B then edits that task offline and syncs, and it stays deleted on both;
  - undo within the window never sends a delete;
  - an edit made during a push isn't lost;
  - a device offline for a "week" pushes old-timestamp edits, and the other device pulls them (the cursor test);
  - **late commit:** the fake remote hands out a row stamped *before* the current cursor after a pull has advanced, within the overlap, and the next pull applies it;
  - **ties:** 250 rows share one `server_updated_at` across three pages, and all 250 arrive;
  - **sign-out and back in:** after sign-out evicts synced rows, sign-in restores every row, and retained dirty rows survive and push;
  - **fast clock:** device A's clock is 1 hour ahead. A edits, then B edits 10 minutes later in real time; both devices converge on B's edit, and A's local `updatedAt` equals the server's clamped value;
  - **acknowledgement race:** an edit made between push and acknowledgement stays dirty and is pushed next time;
  - concurrent edits to different tasks are both kept, and on the same task the newer one wins;
  - a label created on A and assigned on B after syncing arrives with its colour, and a label deleted on A disappears from B's tasks without touching their other fields;
  - the import is idempotent;
  - an unreachable remote leaves the app usable with dirty rows kept, and they sync once the remote returns;
  - sign-out with unsynced rows keeps them.
- **`pnpm test:db`** runs the same delete-then-edit scenario with two real clients signed in as one user, plus the Phase 9 cross-user tests on synced data. It also runs two concurrent transactions to show that a later commit with an earlier `server_updated_at` is still pulled, and pushes an imported legacy task end to end.
- **Manually**: two browsers signed in as one user, one in airplane mode; delete on one, edit on the other, reconnect, and the task is gone on both.

## Phase 11 — Installable and offline ◆
**Changes**
- `src/app/manifest.ts` (name, icons at 192, 512 and maskable, `display: standalone`, theme colour).
- A service worker that precaches every file the static export emits and serves the app shell for navigations. Choose the tool at the start of the phase:
  - **Serwist**, if its current release supports the Next 16 Turbopack build. It generates the precache list from the build output, so nothing is maintained by hand.
  - Otherwise, **a small `public/sw.js` plus a post-build script** that writes the precache list from `out/`.
- The worker **never intercepts Supabase requests**. Cross-origin requests go straight to the network, so auth tokens and task rows are never in a cache.
- Register only in production. When a new worker is waiting, show an "Update available — reload" prompt rather than `skipWaiting` silently swapping code under an open page.

**Why** "Fully offline" includes the very first time you go offline after installing. Runtime caching alone only stores what you've already loaded, so it misses chunks you never opened. Precaching the whole export closes that gap, and the app is small enough that it costs little. Caching API responses would serve one user's stale data to the sync engine as if it were current.

**Verified by**
- `pnpm build && pnpm dlx serve out`, load once, then DevTools → Application: the manifest has no errors and the service worker is activated.
- Network → Offline, then hard-reload: the app loads, add, edit and delete all work and persist, and a signed-in user's changes sync after reconnecting.
- Chrome offers Install. The installed app launches in airplane mode.
- Google sign-in completes from the installed app on Android and iOS. iOS standalone apps can open OAuth in Safari, so check that the session reaches the app.
- After a rebuild, the update prompt appears.
- Cache Storage contains no `supabase.co` entries.
- Lighthouse 12 no longer has a PWA category, so installability is checked in the Application panel instead.

## Phase 12 — README and portfolio
**Changes** Replace `README.md` with:
- one-line pitch;
- a screenshot of phone and desktop side by side, plus a 10-second GIF of add → complete → delete → undo;
- a live link;
- a feature bullet list;
- a "How it's built" section of five lines: local-first Dexie store, optional Supabase sync with row-level security, static export, service worker, tests;
- the stack as badges or a single line;
- `pnpm install && pnpm dev`, noting that it runs guest-only without `.env.local`, and how to fill it from `.env.example`;
- the Supabase restore procedure (Phase 9);
- links to `docs/decisions.md` for the reasoning.

**Portfolio copy that must change** (in `~/projects/personal/nextjs/my-portfolio`)

These lines describe this app. Rows marked **now** are false even before v1, so Phase 0 already removed their claims:
- the repo uses the Next.js App Router, not TanStack Router or Form;
- `zod` is installed but imported nowhere (audit §3.6);
- `Pagination` is a 0-byte file;
- the layout isn't mobile-first (audit §1.6).

This phase rewrites every row to describe only what v1 shipped and passed verification on.

| File:line (as of 2026-11-07) | Current text | Why it must change |
|---|---|---|
| `src/config/site.ts:33` | `title: "React Todo / Productivity App"` | It's a Next.js app, and v1 is a local-first, offline task app with optional sync. Keep `slug: "todo-app"` at `:31` so the `/work/todo-app` URL doesn't break. |
| `src/config/site.ts:35` | "A todo app I built to learn TanStack Router and Form properly. Typed routes, inputs validated with Zod, and pagination that keeps its place when you come back to it." | **now**. Every claim is wrong: no TanStack, no Zod, and v1 removes pagination (Phase 5). |
| `src/config/site.ts:37` | `year: "2025"` | v1 ships in 2026. |
| `src/config/site.ts:38` | `tech: ["React", "TypeScript", "TanStack Router", "TanStack Form", "Zod", "Tailwind CSS"]` | **now**. Should become Next.js, React, TypeScript, Dexie, Supabase, Tailwind CSS, Vitest. Dexie, Supabase and Vitest have no icon in `src/components/ui/tech.tsx:9-17`, so check how a name without one renders, or add `siSupabase` and `siVitest`. Drop `siZod` from that file if no other project lists Zod. |
| `src/config/site.ts:42` | "Home, TodoItem and Pagination split so each one does a single job" | **now**. `Pagination` is empty and v1 deletes it. |
| `src/config/site.ts:43` | "Form validation with Zod, so bad input fails before it reaches state" | **now**. There's no Zod. |
| `src/config/site.ts:44` | "Layout built mobile first, with Tailwind doing the spacing" | **now** (false until Phase 6), and weaker than what v1 can claim: offline, undo, deletes that stay deleted across devices, row-level security. |
| `src/config/site.ts:32` and `public/work/todo-app.webp` | preview image | It shows the old dashboard. Replace it with a v1 screenshot, as WebP under 300 KB per the portfolio rules. |
| `src/content/resume.ts:224` | `name: 'React Todo / Productivity App'` | Same as the `site.ts:33` title. Keep the two names identical. |
| `src/content/resume.ts:225` | "Task manager with typed routes, Zod-validated forms and pagination that keeps its place." | **now**. Same false claims as `site.ts:35`. |

Line numbers will shift after the Phase 0 edit; match on the text.

Leave `src/app/resume/page.tsx:31` alone. It's a comment about a PDF-extraction bug that mentions the URL, not a description of the app. The live URL and repo (`site.ts:39-40`, `resume.ts:226-227`) stay as they are; check that they serve v1 after deploy.

Edit the portfolio under its own `CLAUDE.md`, not this one. Its pre-commit hook regenerates the three resume PDFs in `public/` whenever `resume.ts` is staged, and it refuses a partially staged `resume.ts`, so stage the whole file. Run its `pnpm lint && pnpm build`.

**Why** A recruiter decides in the first screen. The image and the live link do that job, and the decisions log is what separates this from a tutorial todo app for anyone who keeps reading. The portfolio copy is the first thing a recruiter reads about this app. A reviewer who opens the repo from the resume and finds a stack the copy promised but the repo doesn't have stops trusting the rest of the resume.

**Verified by** Every command in the README runs on a fresh clone with no `.env.local`. The screenshots match the current UI. Someone who hasn't seen the project can say what it is and what's notable after 30 seconds. In the portfolio:
- `grep -rnE "TanStack|Zod|pagination" src/config/site.ts src/content/resume.ts` returns nothing for this project;
- every claim in the new copy maps to a phase whose verification passed;
- the regenerated `public/Anthony-Ugwuja-Resume.pdf` contains the new line (`pdftotext` it);
- the portfolio's `pnpm lint && pnpm build` passes.

---

## Done means
- Every audit finding is either fixed or listed in `docs/decisions.md` as consciously deferred.
- `pnpm lint && pnpm build && pnpm test` are clean on a fresh clone, and `pnpm test:db` is green in CI.
- The Phase 10 two-device delete check and the Phase 11 offline check pass on a real phone.
