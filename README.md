# Todo App

A task list that keeps everything on your device: no account, nothing lost, and it's built for a phone first.

**[Open the live app →](https://todo-app-tsc-mauve.vercel.app/)**

<p>
  <img src="docs/screenshots/app-phone.webp" alt="The app on a phone: a greeting with today's date, search and filters, then tasks grouped into Overdue and Today, each with when it was added, a due-date chip and labels." width="260">
  <img src="docs/screenshots/app-desktop.webp" alt="The app on a desktop: the add form, search, filters and grouped tasks on the left, and a summary of done, open, overdue and due-today counts on the right." width="560">
</p>

- **Grouped by when it's due:** Overdue, Today, Tomorrow, Upcoming, No date and Done, re-grouped at midnight.
- **Add, edit in place, complete, and delete with Undo** (Ctrl+Z works too).
- **Vital tasks and colour labels**, with search and filters that survive a reload.
- **Local-first:** your tasks live in your browser's IndexedDB and are never overwritten. Edits made in two tabs at once don't silently replace each other.
- **Keyboard and screen-reader friendly:** `n` adds, `/` searches, there's a skip link, and axe finds no violations, contrast included.

## Run it

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm test       # Vitest + Testing Library
```

Built with Next.js 16, React 19, TypeScript, Tailwind CSS 4 and Dexie. The reasoning behind each choice, including every adversarial code review and how it was answered, is in [`docs/decisions.md`](docs/decisions.md).
