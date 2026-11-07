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
