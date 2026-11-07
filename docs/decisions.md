# Decisions

Every Codex review ends with one entry here, and so does any non-trivial choice made without one (see "How work gets explained" in `CLAUDE.md`). Newest at the top. Keep each entry under 15 lines; link to the commit.

## Entry format

Codex review:

```
## YYYY-MM-DD — <feature or change> (<commit>)
Codex challenged: <the point, one or two lines>
Verdict: AGREE | DISAGREE
Because: <the reasoning, written for me>
Changed: <what moved in the code, or "nothing">
Study: <one concept, with a link or a search term>
```

Decision without a review:

```
## YYYY-MM-DD — <feature or change> (<commit>)
Decided by: <who raised it, and the trigger>
Claim: <the choice, one or two lines>
Verdict: SHIPPED | REVERTED
Because: <why this approach, and the alternative that lost>
Study: <one concept, with a link or a search term>
```

---

## 2026-11-07 — Codex review 6 (Phases 4–6, the first since the usage limit)
Codex challenged: (1) an untouched inline editor overwrites another tab's edit on blur; (2) the bottom sheet closes after an add and discards text typed while it saved; (3) a task moving group (midnight, another tab) unmounts its editor and loses the draft; (4) another tab's boot-time purge deletes a tombstone that a paused Undo still points at, so Undo silently does nothing.
Verdict: AGREE on all four; DISAGREE only with cross-tab undo-token coordination as the fix for 4
Because:
- **(1)** Comparing with the live title made another tab's change look like the user's. The editor now keeps the title it started from: untouched never writes, and a real edit is compare-and-set (`expectTitle`). A conflict says "Changed in another tab to "B". Press Enter to keep yours, or Escape to keep theirs", and blur doesn't decide.
- **(2)** The form reports whether newer text remains, and the sheet stays open for it.
- **(3)** Open drafts live in the list, keyed by task id, so a remounted row reopens with its draft and focus.
- **(4)** A token registry across tabs needs a BroadcastChannel and locks to protect rows that cost nothing to keep, so guest tombstones are now kept 24 hours, and Undo says when the task is already gone.

Changed: `repository.ts` (`TitleConflictError`, `TOMBSTONE_RETENTION_MS`), `taskItem.tsx`, `editDrafts.ts`, `addTaskForm.tsx`, `addTaskSheet.tsx`, `taskList.tsx`. Seven regression tests (`review6.test.tsx`), each confirmed failing first; two were racy and fixed before trusting them. 163 tests pass, stable over 3 runs; all browser checks pass. The outstanding review of Phases 4 and 5 is closed by this one.
Study: optimistic concurrency, i.e. compare-and-set on a version you read, and why an untouched form must never write (search "lost update problem form edits").

## 2026-11-07 — Phase 6: the layout comes first, as one phone-first phase
Decided by: Anthony. The app was unusable on a phone: at 390px the desktop dashboard squeezed into two columns, the "New task" and "Due date" labels overlapped, and the stats rings collided.
Claim: rebuild the page phone-first (one column, two from 768px); replace the dashboard grid with a four-count summary; show when each task was added; make the due date a small optional chip; add on phones through a bottom sheet; greet by name and date.
Verdict: SHIPPED
Because:
- **Merged, not inserted.** I replaced the old Phase 6 instead of inserting a new one and renumbering. The old Phase 6 was already "mobile-first layout" (single column, sheet, tap targets), and this one includes all of it. Inserting would have left a redundant phase and broken every "Phase 7–11" reference in the plan and this log.
- **The Due chip is a disclosure of real buttons, not an ARIA menu**, so it has no keyboard model to get wrong.
- **The Today default is shown on the chip**, not silent, so a task never lands somewhere unexpected.
- **The greeting renders only in the browser** (`useSyncExternalStore` with a null server value), because a prerendered greeting would be stale and cause a hydration error.
- **The name lives in `meta`** until accounts own it.

Caught on the way:
- **Two controls named "Add task".** The floating button now says "Add a task".
- **The sheet opened with focus on Close, not the title.** React runs the child's focus effect before the parent's `showModal()`, and `showModal()` then moves focus. The jsdom stand-in didn't hide closed-dialog content, so the test passed anyway. It now runs the dialog focusing steps like a browser, and fails without the fix.
- **"Overdue" was clipped in the filter bar at 360 and 390.** Equal segments were too narrow; they're natural-width now.
- **Stale import runs could set the status.** A generation guard now lets only the latest run report.

Known and accepted: the fixed floating button covers whatever row passes under it as you scroll, as any floating button does. It sits on top, so a tap there hits it, never the Delete beneath, and 7rem of bottom padding lets the last row scroll clear.
Study: the `<dialog>` focusing steps, and why effects run child-first (search "HTMLDialogElement showModal focusing steps", "React effect order parent child").

## 2026-11-07 — Codex review of Phases 4 and 5 outstanding (usage limit)
Decided by: Anthony. Codex returned "You've hit your usage limit… try again at 10:28 AM" at 09:22 and again at 09:27, so the Phase routine couldn't finish for Phase 5.
Claim: push Phase 5 (`74e45f7`, `28f231f`) without its review. Phase 4's review was already skipped (see below), so the review of both phases is outstanding.
Verdict: OUTSTANDING. The next review against `main` covers all of Phases 4 and 5, and its findings get answered then.
Because: the review compares the branch with `main`, so nothing pushed now escapes it; it only arrives later. The local checks Phase 5 did pass are in its entry below.
Study: why a review gate that runs against a base branch tolerates a skipped run (search "cumulative diff review").

## 2026-11-07 — Phase 5: search, filters, URL state and shortcuts
Decided by: Claude, building Phase 5 of the plan.
Claim: a pure `filterTasks` (All, Active, Done, Today, Overdue, plus search) runs before grouping. The filter and search live in `?filter=&q=`. Stats come from `computeStats(tasks, today)` over every task. `n` and `/` are single-key shortcuts.
Verdict: SHIPPED
Because:
- **Search** matches every word in any order, ignoring case and accents ("creme" finds "Crème brûlée"). Accents are stripped by code point, because a `\p{M}` regex needs an ES2018 TypeScript target and the lint rule rejects the raw range.
- **Today and Overdue mean open tasks**; a finished task due today belongs to Done.
- **The URL is written with `replaceState`, not new history entries.** Reload and shared links keep the view, and Back still leaves the page instead of stepping through filter clicks. The search's URL write is debounced 300 ms; filtering itself never is, so results never lag behind typing.
- **The filters are native radios in a `<fieldset>`**, which gives arrow-key movement and "radio group, 3 of 5" for free. The radios are visually hidden and their labels draw the segmented control and its focus ring.
- **Shortcuts are skipped only in text-entry fields** (text inputs, textareas, selects, contenteditable), so `n` still works from a task's checkbox, where keyboard users usually are. Ctrl, Meta and Alt are left alone. Escape leaves the search and keeps the query (Chrome would clear it).
- **The rings are `role="img"`** with "40% completed: 2 of 5 tasks done", and the visible percentage is `aria-hidden` so it isn't read twice. A polite live region announces how many tasks a filter shows.

Checked: 115 tests (stable over 3 runs), including `filterTasks` for each filter with search, `computeStats` on 0, 1 and 500 tasks, `n` typed in search, `/` and `n` from a checkbox, and `?filter=overdue` on reload. The typing-guard test fails with the guard removed. The browser checks (Phase 5, 11/11) use trusted key events. First Load JS went from 209.1 to 210.7 KB gzip.
Study: roving focus and why native radios beat a custom `role="radiogroup"` (search "WAI-ARIA radio group pattern native").

## 2026-11-07 — Phase 4's Codex review skipped (usage limit); its two leads checked by hand
Decided by: Anthony, because Codex hit its usage limit before finishing (the first run returned no structured findings; the second returned "You've hit your usage limit… try again at 10:28 AM").
Claim: instead of waiting, investigate the two areas Codex's partial run named, test-first: (1) can a retried legacy import bring back a task deleted after the first import, and (2) can a save that finishes overwrite newer typing?
Verdict: both were real bugs; both fixed. The next review runs against `main`, so it covers Phase 4's code too.
Because:
- **(1) Yes, through Phase 4's tombstone purge.** If the source marker failed to land, then on a later load the purge hard-deleted a deleted import's tombstone, and the insert-only retry re-added it. Insert-only only skips rows that still exist. Fix: the authoritative marker is now in the destination's `meta` store, written in the same transaction as the inserts, so a re-run stops before touching the old database. The source marker is just a hint.
- **(2) Yes, in both forms.** Text typed while a save was in flight was dropped when the inline editor closed, or when the add form cleared. Fix: the editor compares the latest draft (from a ref, not a stale closure) with what it submitted, and stays open with the newer text, or saves it at once if focus already left. The add form clears a field only if it still holds what was submitted.

Checked: 4 new tests (one import, three pending-save), each confirmed failing with its fix reverted and passing with it. 73 tests pass, stable over 3 runs. The 15-step smoke check and the browser legacy import also pass.
Study: "stale closures in async React handlers", and why idempotency markers belong in the same transaction as the work they mark.

## 2026-11-07 — Phase 4: grouped list, delete with undo, and where focus goes
Decided by: Claude, building Phase 4 of the plan.
Claim: tasks group into Overdue, Today, Tomorrow, Upcoming, No date and Done through a pure `groupTasks(tasks, today)`. Delete tombstones the task and shows one 6-second Undo toast. Focus is placed deliberately after every delete and undo.
Verdict: SHIPPED
Because:
- **Order.** Inside a group it's due date, then newest first, so a task you just added appears at the top of its group. Done is most recently completed first, because sorting finished work by due date isn't useful.
- **Undo.** Only one toast at a time: a new delete replaces it and the earlier delete stands. The timer pauses on hover or focus (WCAG 2.2.1). The live region stays mounted, because screen readers only announce changes to a region that already exists.
- **Focus.** After a delete it goes to the next row in the group, else the group's heading, else the add field (`focusAfterRemoving`). After Undo it goes to the restored row. Without this, deleting with a keyboard drops focus to `<body>`.
- **Double-click.** No guard in the list: a second `remove()` finds the tombstone and returns no token, so there's one toast and one rev bump. That's tested through the UI.
- **Midnight.** `useToday()` re-groups at midnight and on `visibilitychange`, so the grouping stays pure and the hook owns the clock.
- **Clear samples.** Built here, because no phase owned it; one Undo restores all of them.
- **Purge.** Guest tombstones past the window are purged once per load; signed-in users' tombstones are kept for sync.

Alternatives: hiding a row and committing the delete when the toast closes lost because a closed tab would leave the screen and the store disagreeing. A focus-trap library or a custom listbox lost to native checkboxes, buttons and date inputs.
Study: managing focus after removing the focused element (search "focus management deleting list item accessibility").

## 2026-11-07 — Codex review 5: Phase 3 truncated, swallowed and stranded
Codex challenged: (1) the legacy import truncates descriptions over 500 characters, then marks the import done; (2) both forms swallow save failures, including the new 500-character limit; (3) a failed legacy import is invisible, with no retry; (4) deleting the only row on page 2 leaves an empty list with no way back.
Verdict: AGREE on all four; DISAGREE only with clamping the page (pagination removed instead)
Because: (1) The old app had no limit, so cutting text at 500 lost user content. Imports now keep full text, edits may keep or shorten a long title but never grow it, and Phase 8's server cap becomes 10,000, with anything longer kept on the device and reported. (2) Both forms now show a `role="alert"` message, keep the draft, carry `maxLength` and state the limit. (3) A failed import now shows an alert saying the old tasks are safe, with a Try again button that re-runs it without a reload. (4) Phase 5 deletes pagination anyway, so clamping would be new code in something about to be removed; deleting it now removes the whole class of bug. Found on the way: a second spacing bug from the Phase 0 format commit (`41bc7ae`) in the pagination text ("1 of2"). It went with the code, and a wider scan of the tree finds no others.
Changed: `legacyImport.ts`, `repository.ts` (`TitleError`, the never-grow rule), both forms, `hooks.ts` (`retryLegacyImport`), `page.tsx`, and `todoList.tsx` (pagination removed). New tests cover a 687-character import, the length limit, form alerts, failed-import retry and the no-pagination delete (39 pass; each new form test fails without its fix). `docs/plan.md` Phases 5, 8 and 9 are updated.
Study: "never truncate on migration": why import code should widen its target constraints rather than narrow the user's data.

## 2026-11-07 — Dexie + useLiveQuery as the task store (f610633)
Decided by: Anthony (owner direction): use Dexie unless Phase 3 finds a concrete reason against it.
Claim: IndexedDB through Dexie 4.4, read with `dexie-react-hooks`' `useLiveQuery`, replacing TanStack Query and the hand-written wrapper.
Verdict: SHIPPED; no concrete reason against
Because: the two open checks both came back clean. The static export prerenders `/` with no IndexedDB error: the instance is created on first use, never at module load. First Load JS for `/` went from 186.3 to 208.5 KB gzipped (+22.2 KB), net of removing TanStack Query. In return, `populate` gives seed-once inside the creation transaction, and every repository write is a read-check-write whose promise settles on commit or abort. Live queries also re-run on writes from other tabs, which the `idb` + `useSyncExternalStore` alternative would need a `BroadcastChannel` to match; that's what made Dexie win over a smaller hand-built store.
Also decided here: undo tokens carry `rev`, not `deletedAt`, because two deletes in the same millisecond share a timestamp and an old token could undo a newer delete (tested with a frozen clock). And `fake-indexeddb` loads from its own first setup file, because the import sorter moved it below `dexie`, which captures `indexedDB` at import.
Study: Dexie's liveQuery and how it tracks which keys a query read (search "Dexie liveQuery observability").

## 2026-11-07 — Codex review 4: Phase 2 left no way to delete a task
Codex challenged: removing the detail route also removed the only Delete control, so users can't remove tasks. The plan's "nothing working is lost" overlooked that Phase 0 had already made those deletes persist.
Verdict: AGREE; DISAGREE only with "not shippable", since `revamp` doesn't deploy until the checkpoint after Phase 7
Because: the premise was stale. Phase 0 stopped the reseed that used to resurrect deleted rows, so from then on a delete from the detail page stuck. Restoring delete costs one button and one test. It also keeps delete inside the CRUD smoke check while Phase 3 replaces the data layer, which is exactly when a broken delete would otherwise go unnoticed until Phase 4.
Changed: a Delete button on each list row (accessible name, disabled while pending, `role="alert"` on failure), and `todoList.test.tsx` (delete, remount from IndexedDB, still gone; fails without the button). The smoke check gains delete-then-reload steps, and `docs/plan.md` Phases 2 and 3 are updated. There's no confirmation or undo until Phase 4.
Study: why a plan's "nothing is lost" claim has to be re-checked after every earlier phase changes the ground under it (search "stale preconditions").

## 2026-11-07 — Codex review 3: a write that aborts, and a Node range nothing could meet (8130665, 96f0605)
Codex challenged: (1) `updateTodo` handles `complete` and `error` but not `abort`, so a transaction that aborts after its put succeeds leaves the promise pending forever; (2) `engines` says `>=20.9`, but Vitest 5 needs Node `^22.12` and jsdom 31 needs `^22.22.2`, so the declared minimum can't run the test gate.
Verdict: AGREE on both; DISAGREE only with the option of choosing Node-20-compatible test tooling
Because: (1) Reproduced: a test that aborts right after `put()` succeeds hung on the old code. The same class of bug was in `saveTodo` and `deleteTodo`, which resolved before commit, so all three now settle on `complete` and reject on `abort`. (2) Worse than stated: jsdom 31's range excluded this machine (22.22.1), so the gate was passing outside its support. Node 20 reached end of life on 2026-04-30, so supporting it isn't worth older tooling. jsdom moves to 29.1.1, `engines` becomes the intersection of every locked range (`^22.13.0 || ^24.0.0 || >=26.0.0`), and `engine-strict` makes a mismatch fail at install.
Changed: `src/lib/indexedDB.ts` (`settle()`), `todoService.test.ts` (abort test; 8/8 pass); `package.json`, `.npmrc`, lockfile.
Study: why a request's `success` isn't durability in IndexedDB (search "IDBTransaction complete vs request success").

## 2026-11-07 — Codex review 2: Phase 0 and the sync design could still lose or resurrect tasks (9a665b0)
Codex challenged: (1) `updateTodo` reads and writes in separate transactions, so a racing delete is undone; (2) deleting `TodoAppDB` after the snapshot loses an old tab's later writes; (3) a `server_updated_at` cursor skips late commits, because `now()` is the transaction's start time, and it drops ties at page boundaries; (4) sign-out evicts rows but keeps the cursor, so they never come back; (5) the clamp leaves a fast-clock device's local copy permanently ahead; (6) `legacy-7` isn't a valid uuid. It also noted that RLS is still only a specification.
Verdict: AGREE on all six; DISAGREE only with the fix for 3 (full reconciliation on every sync)
Because: (1) Reproduced: two new tests failed on the old code, and one readwrite transaction fixes it. (2) Fixed with a version-2 upgrade that can't run until old tabs close, after which old code can't open it; the source is kept. (3) Full pulls cost egress on every 60s tick. An overlap of 60s is safe because the 8s statement timeout bounds commit lag, applying is idempotent, and keyset paging by `(ts, id)` fixes ties. (4) Cursor deleted in the eviction transaction. (5) Clients now adopt the server's returned row, gated by a `rev` counter, so only the trigger ever judges a conflict. (6) UUID v5 namespaced by a per-install id. RLS is unverified by design until Phase 8, which is where its tests sit.
Changed: `src/lib/indexedDB.ts` and `todoService.ts`, plus `todoService.test.ts` (7 tests pass, stable over 5 runs); `docs/plan.md`: invariants, Phase 3 cutover, ids and `rev`, Phase 8 timeout and index, Phase 9 push, pull, bootstrap and sign-out, with tests for each.
Study: read-modify-write races and lost updates; why `now()` cursors miss late commits (search "transaction commit order vs timestamp change data capture").

## 2026-11-07 — Codex review 1: the plan could destroy, resurrect and break (docs, reviewed uncommitted on 21f6bf0)
Codex challenged: (1) deleting `TodoAppDB` destroys the user's own tasks; (2) undo from a remembered snapshot can overwrite another tab's edit; (3) Phase 2 deletes `useTodo.ts` while `todoDetail.tsx` still imports it; (4) Phase 3 removes the old store before its consumers move; (5) the false portfolio claims shouldn't wait until the last phase. Next steps: stop the overwrite before the upgrade; shortcuts, URL state and the bundle-size check don't earn their delay.
Verdict: AGREE on findings 1–5; DISAGREE with the fix for 2 and with the next step about features
Because: (1) `isLocal` rows are user-written, so it's now an insert-only import with `legacy-<id>` ids, and the source is deleted only after commit; retries and two tabs are harmless. (2) The cure isn't an atomic snapshot but no snapshot at all: delete tombstones the row and undo clears only `deletedAt`, gated by a one-shot token, and sync needs tombstones anyway. (3, 4) Confirmed; each removal now ships with its consumers. (5) and the overwrite are one-commit fixes, now in Phase 0. Shortcuts are an owner requirement and the bundle check is two numbers from build output, so neither delays the recruiter-facing result; a deploy checkpoint after Phase 7 does that job instead.
Changed: `docs/plan.md`: invariants section; Phase 0 gains the overwrite fix and portfolio correction; Phase 2 is one cutover; Phase 3 does the legacy import, tombstones and UI rewire; Phase 4 uses token undo; ship checkpoint after Phase 7; CRUD smoke check at every boundary.
Study: idempotent, insert-only migrations, and why tombstones beat snapshots for undo (search "CRDT tombstone delete-wins").
