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

## 2026-11-07 — Codex review 1: the plan could destroy, resurrect and break (docs, reviewed uncommitted on 21f6bf0)
Codex challenged: (1) deleting `TodoAppDB` destroys the user's own tasks; (2) undo from a remembered snapshot can overwrite another tab's edit; (3) Phase 2 deletes `useTodo.ts` while `todoDetail.tsx` still imports it; (4) Phase 3 removes the old store before its consumers move; (5) the false portfolio claims shouldn't wait until the last phase. Next steps: stop the overwrite before the upgrade; shortcuts, URL state and the bundle-size check don't earn their delay.
Verdict: AGREE on findings 1–5; DISAGREE with the fix for 2 and with the next step about features
Because: (1) `isLocal` rows are user-written, so it's now an insert-only import with `legacy-<id>` ids, and the source is deleted only after commit; retries and two tabs are harmless. (2) The cure isn't an atomic snapshot but no snapshot at all: delete tombstones the row and undo clears only `deletedAt`, gated by a one-shot token, and sync needs tombstones anyway. (3, 4) Confirmed; each removal now ships with its consumers. (5) and the overwrite are one-commit fixes, now in Phase 0. Shortcuts are an owner requirement and the bundle check is two numbers from build output, so neither delays the recruiter-facing result; a deploy checkpoint after Phase 7 does that job instead.
Changed: `docs/plan.md`: invariants section; Phase 0 gains the overwrite fix and portfolio correction; Phase 2 is one cutover; Phase 3 does the legacy import, tombstones and UI rewire; Phase 4 uses token undo; ship checkpoint after Phase 7; CRUD smoke check at every boundary.
Study: idempotent, insert-only migrations, and why tombstones beat snapshots for undo (search "CRDT tombstone delete-wins").
