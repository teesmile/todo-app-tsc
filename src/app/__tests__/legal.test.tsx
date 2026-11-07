import type { AxeResults } from 'axe-core'
import type { AccountClient } from '@/features/account/client'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { describe, expect, it, vi } from 'vitest'
import { AccountProvider } from '@/features/account/accountProvider'
import { AppHeader } from '@/features/tasks/components/appHeader'
import { runLegacyImport } from '@/features/tasks/store/legacyImport'
import Home from '../page'
import PrivacyPage from '../privacy/page'
import TermsPage from '../terms/page'

vi.mock('@/features/tasks/store/legacyImport', () => ({ runLegacyImport: vi.fn() }))
vi.mocked(runLegacyImport).mockResolvedValue({ status: 'no-legacy-db' })

async function violations() {
  const result: AxeResults = await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } })
  return result.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)
}

const text = () => document.body.textContent?.replace(/\s+/g, ' ') ?? ''

describe('privacy and terms', () => {
  it('links both from the home page footer', async () => {
    render(<Home />)
    const footer = await screen.findByRole('contentinfo')
    const legal = within(footer).getByRole('navigation', { name: 'Legal' })
    expect(within(legal).getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy')
    expect(within(legal).getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms')
  })

  it('privacy covers the device, Supabase in London, Google, selling, and deletion', async () => {
    render(<PrivacyPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Privacy' })).toBeInTheDocument()
    for (const name of ['On your device', 'When you sign in', 'What Google sign-in shares', 'What never happens', 'Deleting your data'])
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument()
    expect(text()).toMatch(/IndexedDB/)
    expect(text()).toMatch(/Supabase, in its London \(UK\) data centre/)
    expect(text()).toMatch(/Google shares your name, email address and profile picture/)
    expect(text()).toMatch(/never sold/)
    expect(text()).toMatch(/choose “Delete account” and confirm/)
    // Honest about Phase 9: signing in doesn't sync tasks yet.
    expect(text()).toMatch(/Today, signing in doesn't copy your tasks anywhere/)
    expect(screen.getByRole('link', { name: /Back to your tasks/ })).toHaveAttribute('href', '/')
    expect(await violations()).toEqual([])
  })

  it('terms are present, plain, and point to the privacy page', async () => {
    render(<TermsPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Terms' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'privacy page' })).toHaveAttribute('href', '/privacy')
    expect(text()).toMatch(/provided as it is, with no warranty/)
    expect(text()).toMatch(/The privacy page explains how/)
    expect(await violations()).toEqual([])
  })

  it('the sign-in and account dialogs pass axe', async () => {
    const user = userEvent.setup()
    window.localStorage.setItem('sb-test-auth-token', '{}')
    const client: AccountClient = {
      currentUser: async () => ({ user: { id: 'u1', email: 'a@example.com', firstName: 'Ada', fullName: 'Ada L' }, error: null }),
      onChange: () => () => {},
      signInWithGoogle: async () => null,
      signOut: async () => null,
      deleteAccount: async () => null,
    }
    render(<AccountProvider configured load={async () => client}><AppHeader /></AccountProvider>)
    await user.click(await screen.findByRole('button', { name: 'Account: Ada' }))
    expect(await violations()).toEqual([])
    await user.click(screen.getByRole('button', { name: 'Delete account…' }))
    expect(await violations()).toEqual([])
    window.localStorage.clear()
  })
})
