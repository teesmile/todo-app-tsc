import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { runLegacyImport } from '@/features/tasks/store/legacyImport'
import Home from '../page'
import PrivacyPage from '../privacy/page'
import TermsPage from '../terms/page'

vi.mock('@/features/tasks/store/legacyImport', () => ({ runLegacyImport: vi.fn() }))
vi.mocked(runLegacyImport).mockResolvedValue({ status: 'no-legacy-db' })

// Google's brand verification checks that the home page shows the consent
// screen's app name, "Todo App", exactly, in the HTML the server sends (not
// only after JavaScript runs). These render with React's server renderer,
// as the static export does.

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/\s+/g, ' ')

describe('the app name in the server-rendered HTML', () => {
  it('home: a "Todo App" wordmark linking home, with its icon, and "Todo App by Anthony Ugwuja" in the footer', () => {
    const html = renderToString(<Home />)
    expect(html).toMatch(/<a [^>]*href="\/"[^>]*>(?:(?!<\/a>)[\s\S])*<img [^>]*alt=""[^>]*icon-192\.png(?:(?!<\/a>)[\s\S])*<span>Todo App<\/span><\/a>/)
    expect(text(html)).toContain('Todo App by Anthony Ugwuja')
    expect(html).toMatch(/href="\/privacy"/)
    expect(html).toMatch(/href="\/terms"/)
  })

  it.each([['privacy', PrivacyPage], ['terms', TermsPage]] as const)('/%s uses the same name', (_page, Page) => {
    const html = renderToString(<Page />)
    expect(html).toMatch(/<span>Todo App<\/span><\/a>/)
    expect(text(html)).toContain('Todo App by Anthony Ugwuja')
  })
})
