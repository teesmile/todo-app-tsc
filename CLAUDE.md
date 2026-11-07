# todo-app-tsc — working rules for Claude Code

## Owner
Anthony (Toni) Ugwuja. Frontend dev (React / Next.js / TypeScript) coming back after a pause. Explain decisions like I'm a dev, not a beginner. Package manager is pnpm, never npm, yarn or bun — in scripts, docs and the README.

## What this repo is
A local-first task app. Next.js App Router (static export), React 19, Tailwind 4, TypeScript. IndexedDB (through Dexie) in the browser is the only store the UI reads. Accounts are optional: a signed-in user's tasks sync through Supabase (auth plus a Postgres table under row-level security), called from the browser with the client SDK. There's no server of our own. Feature code lives in `src/features/<name>/`; shared UI in `src/components/`. The audit is `docs/audit.md`, the phased plan is `docs/plan.md`, and the decision log is `docs/decisions.md`. Work follows the plan's phase order; a phase isn't started until the one before it passes its verification.

## The bar (judge every change against all four)
1. Nothing the user wrote is ever lost, silently overwritten or brought back after deletion. Only four things write to IndexedDB: the user's own actions, the one-time sample seed, the one-time legacy import, and sync applying the same user's changes from their other devices. The invariants are listed in `docs/plan.md`.
2. Mobile-first: phone layout first, then widen. It works fully offline once installed, signed in or not, and it keeps working when Supabase is unreachable.
3. Usable with only a keyboard and with a screen reader: real controls, visible focus, announced changes.
4. Behaviour is proven by tests, not by "it looked right in the browser".

## Hard rules
- Run `pnpm lint && pnpm build && pnpm test` before calling any task done, plus `pnpm test:db` for anything touching Supabase, its migrations or sync. Never disable or skip lint to get a build through.
- The only runtime network calls are Supabase auth and sync for a signed-in user. Sample data is a bundled file, seeded once.
- Keys come from environment variables and are never committed. Only the publishable key reaches the browser; the secret key never appears in the repo, the client or CI. `.env.example` lists the variable names with no values.
- Every Supabase schema change is a migration file in `supabase/migrations/`, and every table has row-level security on, with a test proving one user can't read or write another's rows.
- Store and date logic stay out of components, in plain functions with unit tests.
- Every interactive element is a native control (`button`, `input`, `dialog`, `a`) or carries the full ARIA pattern for its role. An icon-only button has an accessible name.
- Every animation has a `prefers-reduced-motion` path.
- No placeholder routes, dead buttons or empty files. If it isn't built, it isn't in the tree.
- No attribution lines: commit messages never end with a `Co-Authored-By` line, and pull request descriptions never end with a "Generated with Claude Code" line.

## Phase routine
At the end of every phase in `docs/plan.md`, after its **Verified by** checks pass:
1. Run the Codex adversarial review yourself, in the foreground, against `main`:
   `node ~/.claude/plugins/cache/openai-codex/codex/<version>/scripts/codex-companion.mjs adversarial-review "--base main"`
   Use the installed plugin version (`ls ~/.claude/plugins/cache/openai-codex/codex/`). Pass exactly `--base main`: anything appended to the ref, even a comma, makes git reject it.
2. Wait for it to finish, then show me its findings unedited, from `# Codex Adversarial Review` to the end.
3. Respond under the Codex review protocol below, fixing only what you agree with.
4. Commit, then push `revamp`.
5. Stop. The next phase starts only when I say so.

## Codex review protocol
When Codex reviews a change:
- Answer each point with AGREE or DISAGREE and the reason.
- Fix only what you agree with; defend every disagreement with a concrete case.
- Append to `docs/decisions.md` using its entry format: feature, Codex's challenge, verdict, reasoning and one concept for me to study.
- Explain every trade-off in plain terms before writing code.

## How work gets explained
Claude writes everything. There is no `TODO(human)`: nothing is left half-built as an exercise.

In exchange, every non-trivial piece of state, data or architecture ships with a short explanation: what it does, why this approach, and what the alternative was and why it lost. That explanation goes in two places: the Insight block in the reply, and an entry in `docs/decisions.md` whenever I'd otherwise have to reconstruct the choice later. A storage schema, a migration, an undo mechanism, a caching strategy and a layout system all qualify. A rename does not.
