import type { AccountClient } from './client'
import type { FakeRemote } from '@/test/fakeRemote'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { AppHeader } from '@/features/tasks/components/appHeader'
import { getDb } from '@/features/tasks/store/db'
import { accountNameKey, setDisplayName } from '@/features/tasks/store/profile'
import { add } from '@/features/tasks/store/repository'
import { FakeAuth } from '@/test/fakeAuth'
import { AccountProvider } from './accountProvider'
import { GoogleSignInButton } from './googleButton'
import { rememberedAccount } from './session'

// The sign-in polish: the account control, Google's own button, a greeting
// name stored on the account, and telling accounts apart.

const MAIN = '44444444-4444-4444-8444-444444444444'
const OTHER = '66666666-6666-4666-8666-666666666666'

function renderDevice(client: AccountClient | null, { signedIn = true, noticeMs }: { signedIn?: boolean, noticeMs?: number } = {}) {
  if (signedIn)
    window.localStorage.setItem('sb-test-auth-token', '{}')
  const events = userEvent.setup()
  const view = render(
    <AccountProvider configured load={async () => client ?? new FakeAuth().client('none')} noticeMs={noticeMs}>
      <AppHeader />
    </AccountProvider>,
  )
  return { events, ...view }
}

const heading = () => screen.getByRole('heading', { level: 1 })

afterEach(() => window.localStorage.clear())

describe('the account control', () => {
  it('is a clear "Sign in" button for a guest, with a fixed-size icon', async () => {
    renderDevice(null, { signedIn: false })
    const button = await screen.findByRole('button', { name: 'Sign in' })
    expect(button).toHaveClass('bg-gray-900')
    const icon = button.querySelector('svg')!
    expect(icon).toHaveClass('shrink-0')
    expect(icon).toHaveAttribute('aria-hidden', 'true')
  })

  it('shows a signed-in user\'s initial in a fixed-size avatar', async () => {
    const auth = new FakeAuth()
    auth.addUser(MAIN, 'anthony@example.com', 'Anthony')
    renderDevice(auth.client(MAIN))
    const button = await screen.findByRole('button', { name: /^Account: Anthony/ })
    const avatar = button.querySelector('[aria-hidden="true"]')!
    expect(avatar).toHaveTextContent('A')
    expect(avatar).toHaveClass('shrink-0', 'h-8', 'w-8')
  })
})

describe('telling accounts apart (production report, 2026-11-09)', () => {
  // Two Google accounts with the same first name looked identical in the
  // header, so a laptop and a phone signed in to different accounts each
  // showed "Anthony · Synced" and never shared a task.
  it('names the account by email, so two accounts with the same first name differ', async () => {
    const auth = new FakeAuth()
    auth.addUser(MAIN, 'anthonyugwujac@example.com', 'Anthony')
    auth.addUser(OTHER, 'anthony.other@example.com', 'Anthony')

    const first = renderDevice(auth.client(MAIN))
    const mainName = (await screen.findByRole('button', { name: /^Account: Anthony/ })).getAttribute('aria-label')
    first.unmount()
    window.localStorage.clear()
    renderDevice(auth.client(OTHER))
    const otherName = (await screen.findByRole('button', { name: /^Account: Anthony/ })).getAttribute('aria-label')

    expect(mainName).toContain('anthonyugwujac@example.com')
    expect(otherName).toContain('anthony.other@example.com')
    expect(mainName).not.toBe(otherName)
  })

  it('says which account it signed in to, and which account an import goes to', async () => {
    const auth = new FakeAuth()
    auth.addUser(MAIN, 'anthonyugwujac@example.com', 'Anthony')
    await add({ title: 'Made on this phone' })
    window.history.replaceState(null, '', '/?code=abc')
    renderDevice(auth.client(MAIN))

    await waitFor(() => expect(screen.getAllByRole('status')[0]).toHaveTextContent('Signed in as Anthony Ugwuja (anthonyugwujac@example.com)'))
    const offer = await screen.findByRole('dialog', { name: /^Add 1 task from this device/ })
    expect(offer).toHaveTextContent('They\'ll be added to anthonyugwujac@example.com')
  })
})

describe('the official Google sign-in button', () => {
  it('is a real button named "Continue with Google", with Google\'s own G as decoration', () => {
    render(<GoogleSignInButton onClick={() => {}} />)
    const button = screen.getByRole('button', { name: 'Continue with Google' })
    expect(button).toHaveClass('gsi-button')
    const logo = button.querySelector('img')!
    expect(logo.getAttribute('src')).toContain('/google-g.svg')
    expect(logo).toHaveAttribute('alt', '')
    expect(logo).toHaveAttribute('width', '20')
  })

  it('says it\'s opening Google and can\'t be pressed twice while busy', () => {
    render(<GoogleSignInButton onClick={() => {}} busy disabled />)
    expect(screen.getByRole('button', { name: 'Opening Google…' })).toBeDisabled()
  })

  it('replaces the plain button in the sign-in dialog', async () => {
    const { events } = renderDevice(null, { signedIn: false })
    await events.click(await screen.findByRole('button', { name: 'Sign in' }))
    const dialog = screen.getByRole('dialog', { name: 'Sign in' })
    expect(within(dialog).getByRole('button', { name: 'Continue with Google' })).toHaveClass('gsi-button')
  })
})

describe('the greeting name lives on the account', () => {
  it('changed on the laptop, it reaches the phone, and wins over the Google name', async () => {
    const auth = new FakeAuth()
    auth.addUser(MAIN, 'anthony@example.com', 'Anthony')

    // The laptop.
    const laptop = renderDevice(auth.client(MAIN))
    await waitFor(() => expect(heading()).toHaveTextContent(/, Anthony$/))
    await laptop.events.click(screen.getByRole('button', { name: /^Account: Anthony/ }))
    const field = screen.getByRole('textbox', { name: 'Name in the greeting' })
    expect(field).toHaveValue('Anthony')
    await laptop.events.clear(field)
    await laptop.events.type(field, 'Tony{Enter}')
    await waitFor(() => expect(heading()).toHaveTextContent(/, Tony$/))
    expect(screen.getAllByRole('status')[0]).toHaveTextContent('The greeting now says "Tony" on all your devices.')
    laptop.unmount()

    // The phone, a different device: nothing about the name is on it.
    await getDb().delete()
    await getDb().open()
    renderDevice(auth.client(MAIN))
    await waitFor(() => expect(heading()).toHaveTextContent(/, Tony$/))
  })

  it('reaches a device that was already open when the tab is looked at again', async () => {
    const auth = new FakeAuth()
    auth.addUser(MAIN, 'anthony@example.com', 'Anthony')
    renderDevice(auth.client(MAIN))
    await waitFor(() => expect(heading()).toHaveTextContent(/, Anthony$/))

    // Changed elsewhere meanwhile.
    await auth.client(MAIN).setDisplayName('Tony', MAIN)
    // Coming back to the tab. The listener is added by an effect just after
    // the first render, so keep "coming back" until it has been heard.
    await waitFor(() => {
      act(() => document.dispatchEvent(new Event('visibilitychange')))
      expect(heading()).toHaveTextContent(/, Tony$/)
    })
  })

  it('goes back to the Google name with "Use my Google name"', async () => {
    const auth = new FakeAuth()
    auth.addUser(MAIN, 'anthony@example.com', 'Anthony', { display_name: 'Tony' })
    const { events } = renderDevice(auth.client(MAIN))
    await waitFor(() => expect(heading()).toHaveTextContent(/, Tony$/))
    await events.click(screen.getByRole('button', { name: /^Account: Tony/ }))
    await events.click(await screen.findByRole('button', { name: 'Use my Google name' }))
    await waitFor(() => expect(heading()).toHaveTextContent(/, Anthony$/))
    expect(auth.users.get(MAIN)!.user_metadata.display_name).toBeNull()
  })

  it('says so, and keeps the text, when the account can\'t be reached', async () => {
    const auth = new FakeAuth()
    auth.addUser(MAIN, 'anthony@example.com', 'Anthony')
    const { events } = renderDevice(auth.client(MAIN))
    await events.click(await screen.findByRole('button', { name: /^Account: Anthony/ }))
    auth.failing = 'Failed to fetch'
    const field = screen.getByRole('textbox', { name: 'Name in the greeting' })
    await events.clear(field)
    await events.type(field, 'Tony{Enter}')
    expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent('The name wasn\'t saved: Failed to fetch')
    expect(field).toHaveValue('Tony')
    expect(heading()).toHaveTextContent(/, Anthony$/)
  })

  it('moves a name saved on the device by the previous version to the account, once', async () => {
    const auth = new FakeAuth()
    auth.addUser(MAIN, 'anthony@example.com', 'Anthony')
    await getDb().meta.put({ key: accountNameKey(MAIN), value: 'Tony' })
    renderDevice(auth.client(MAIN))
    await waitFor(() => expect(heading()).toHaveTextContent(/, Tony$/))
    expect(auth.users.get(MAIN)!.user_metadata.display_name).toBe('Tony')
    await waitFor(async () => expect(await getDb().meta.get(accountNameKey(MAIN))).toBeUndefined())
    expect(auth.updates).toBe(1)
  })

  it('leaves the guest\'s own name alone', async () => {
    await setDisplayName('Guest name')
    const auth = new FakeAuth()
    auth.addUser(MAIN, 'anthony@example.com', 'Anthony', { display_name: 'Tony' })
    renderDevice(auth.client(MAIN))
    await waitFor(() => expect(heading()).toHaveTextContent(/, Tony$/))
    expect((await getDb().meta.get('displayName'))?.value).toBe('Guest name')
  })

  it('keeps text typed while a save is in flight (review 12)', async () => {
    const auth = new FakeAuth()
    auth.addUser(MAIN, 'anthony@example.com', 'Anthony')
    let release!: () => void
    auth.gate = new Promise<void>(r => (release = r))
    const { events } = renderDevice(auth.client(MAIN))
    await events.click(await screen.findByRole('button', { name: /^Account: Anthony/ }))
    const field = screen.getByRole('textbox', { name: 'Name in the greeting' })
    await events.clear(field)
    await events.type(field, 'First edit{Enter}')
    await events.clear(field)
    await events.type(field, 'Second edit')
    await act(async () => {
      release()
      await new Promise(r => setTimeout(r, 50))
    })
    await waitFor(() => expect(heading()).toHaveTextContent(/, First edit$/))
    expect(field).toHaveValue('Second edit')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('drops an unsaved draft when another tab signs in as someone else', async () => {
    const auth = new FakeAuth()
    auth.addUser(MAIN, 'anthony@example.com', 'Anthony')
    const ada = auth.addUser(OTHER, 'ada@example.com', 'Ada')
    let switchUser: (u: typeof ada | null) => void = () => {}
    const client = auth.client(MAIN, { onChange: (cb) => {
      switchUser = cb
      return () => {}
    } })
    const { events } = renderDevice(client)
    await events.click(await screen.findByRole('button', { name: /^Account: Anthony/ }))
    const field = screen.getByRole('textbox', { name: 'Name in the greeting' })
    await events.clear(field)
    await events.type(field, 'Tee')

    act(() => switchUser(ada))
    const now = await screen.findByRole('textbox', { name: 'Name in the greeting' })
    await waitFor(() => expect(now).toHaveValue('Ada'))
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(auth.updates).toBe(0)
  })
})

describe('a slow, older read of the account never undoes a newer name', () => {
  it('ignores the start-up refresh when it arrives after a save', async () => {
    const auth = new FakeAuth()
    auth.addUser(MAIN, 'anthony@example.com', 'Anthony')
    let releaseOld!: () => void
    const oldReadDone = new Promise<void>(r => (releaseOld = r))
    const base = auth.client(MAIN)
    let first = true
    const client = auth.client(MAIN, {
      refreshUser: async () => {
        // The start-up read: answered with the old name, but only after a save.
        if (first) {
          first = false
          const stale = await base.refreshUser()
          await oldReadDone
          return stale
        }
        return base.refreshUser()
      },
    })
    const { events } = renderDevice(client)
    await events.click(await screen.findByRole('button', { name: /^Account: Anthony/ }))
    const field = screen.getByRole('textbox', { name: 'Name in the greeting' })
    await events.clear(field)
    await events.type(field, 'Tony{Enter}')
    await waitFor(() => expect(heading()).toHaveTextContent(/, Tony$/))

    await act(async () => {
      releaseOld()
      await new Promise(r => setTimeout(r, 50))
    })
    expect(heading()).toHaveTextContent(/, Tony$/)
  })
})

describe('review 13: late answers never cross accounts or overwrite newer names', () => {
  it('a slow read for account A, finishing after a switch to B, is neither applied nor remembered', async () => {
    const auth = new FakeAuth()
    const a = auth.addUser(MAIN, 'anthony@example.com', 'Anthony')
    const b = auth.addUser(OTHER, 'ada@example.com', 'Ada')
    let releaseA!: () => void
    const aReadDone = new Promise<void>(r => (releaseA = r))
    let switchUser: (u: typeof b | null) => void = () => {}
    const base = auth.client(MAIN)
    const client = auth.client(MAIN, {
      onChange: (cb) => {
        switchUser = cb
        return () => {}
      },
      refreshUser: async () => {
        const answer = await base.refreshUser()
        await aReadDone
        return answer
      },
    })
    const first = renderDevice(client)
    await screen.findByRole('button', { name: /^Account: Anthony/ })

    act(() => switchUser(b))
    await screen.findByRole('button', { name: /^Account: Ada/ })
    await act(async () => {
      releaseA()
      await new Promise(r => setTimeout(r, 50))
    })
    expect(screen.getByRole('button', { name: /^Account: Ada/ })).toBeInTheDocument()
    expect(rememberedAccount()?.id).toBe(OTHER)

    // Reopened offline on this device: it must restore B, never A.
    first.unmount()
    renderDevice(auth.client(MAIN, { currentUser: async () => ({ user: null, error: 'Failed to fetch' }) }))
    expect(await screen.findByRole('button', { name: /^Account: Ada/ })).toBeInTheDocument()
    expect(a.id).not.toBe(OTHER)
  })

  it('never uploads the old device name over a name the account already has on the server', async () => {
    const auth = new FakeAuth()
    auth.addUser(MAIN, 'anthony@example.com', 'Anthony', { display_name: 'New cloud name' })
    await getDb().meta.put({ key: accountNameKey(MAIN), value: 'Old device name' })
    // The saved session predates the cloud name.
    const stale = { id: MAIN, email: 'anthony@example.com', firstName: 'Anthony', fullName: 'Anthony Ugwuja', googleName: 'Anthony', chosenName: null }
    renderDevice(auth.client(MAIN, { currentUser: async () => ({ user: stale, error: null }) }))

    await waitFor(() => expect(heading()).toHaveTextContent(/, New cloud name$/))
    await waitFor(async () => expect(await getDb().meta.get(accountNameKey(MAIN))).toBeUndefined())
    expect(auth.users.get(MAIN)!.user_metadata.display_name).toBe('New cloud name')
    expect(auth.updates).toBe(0)
  })
})

describe('review 14: a late read for one account never migrates its name into another', () => {
  it('leaves B\'s name alone and keeps A\'s device copy when A\'s read lands after a switch to B', async () => {
    const auth = new FakeAuth()
    auth.addUser(MAIN, 'anthony@example.com', 'Anthony')
    const b = auth.addUser(OTHER, 'ada@example.com', 'Ada', { display_name: 'Ada\'s choice' })
    await getDb().meta.put({ key: accountNameKey(MAIN), value: 'Old device name' })
    let releaseA!: () => void
    const aReadDone = new Promise<void>(r => (releaseA = r))
    let switchUser: (u: typeof b | null) => void = () => {}
    const reads = auth.client(MAIN)
    const client: AccountClient = auth.client(MAIN, {
      onChange: (cb) => {
        switchUser = cb
        return () => {}
      },
      refreshUser: async () => {
        const answer = await reads.refreshUser()
        await aReadDone
        return answer
      },
    })
    renderDevice(client)
    await screen.findByRole('button', { name: /^Account: Anthony/ })

    // Another tab signs this browser in as B.
    auth.switchSession(client, OTHER)
    act(() => switchUser(b))
    await screen.findByRole('button', { name: /^Account: Ada/ })
    await act(async () => {
      releaseA()
      await new Promise(r => setTimeout(r, 50))
    })

    expect(auth.users.get(OTHER)!.user_metadata.display_name).toBe('Ada\'s choice')
    expect(auth.updates).toBe(0)
    expect((await getDb().meta.get(accountNameKey(MAIN)))?.value).toBe('Old device name')
  })
})

describe('polish from the phone test, 2026-11-09', () => {
  it('saving a name closes the account dialog and puts focus back on the account button', async () => {
    const auth = new FakeAuth()
    auth.addUser(MAIN, 'anthony@example.com', 'Anthony')
    const { events } = renderDevice(auth.client(MAIN))
    const account = await screen.findByRole('button', { name: /^Account: Anthony/ })
    await events.click(account)
    const field = screen.getByRole('textbox', { name: 'Name in the greeting' })
    await events.clear(field)
    await events.type(field, 'Tony{Enter}')

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(screen.getByRole('button', { name: /^Account: Tony/ })).toHaveFocus())
    expect(screen.getAllByRole('status')[0]).toHaveTextContent('The greeting now says "Tony" on all your devices.')
  })

  it('stays open when more was typed while the save was in flight', async () => {
    const auth = new FakeAuth()
    auth.addUser(MAIN, 'anthony@example.com', 'Anthony')
    let release!: () => void
    auth.gate = new Promise<void>(r => (release = r))
    const { events } = renderDevice(auth.client(MAIN))
    await events.click(await screen.findByRole('button', { name: /^Account: Anthony/ }))
    const field = screen.getByRole('textbox', { name: 'Name in the greeting' })
    await events.clear(field)
    await events.type(field, 'Tony{Enter}')
    await events.type(field, ' B')
    await act(async () => {
      release()
      await new Promise(r => setTimeout(r, 50))
    })
    expect(screen.getByRole('dialog', { name: 'Your account' })).toBeInTheDocument()
    expect(field).toHaveValue('Tony B')
  })

  it('says "Signed in as …" once, then the notice goes away', async () => {
    const auth = new FakeAuth()
    auth.addUser(MAIN, 'anthony@example.com', 'Anthony')
    window.history.replaceState(null, '', '/?code=abc')
    renderDevice(auth.client(MAIN), { noticeMs: 300 })
    const notice = () => screen.getAllByRole('status')[0]
    await waitFor(() => expect(notice()).toHaveTextContent('Signed in as Anthony Ugwuja (anthony@example.com)'))
    await waitFor(() => expect(notice()).toBeEmptyDOMElement())
    // The live region stays in the page, ready for the next notice.
    expect(notice()).toBeInTheDocument()
  })

  it('shows synced as an icon, with the meaning in the tooltip and the name, and no word', async () => {
    const auth = new FakeAuth()
    auth.addUser(MAIN, 'anthony@example.com', 'Anthony')
    renderDevice(auth.client(MAIN))
    const account = await screen.findByRole('button', { name: /^Account: Anthony \(anthony@example.com\), Synced$/ }, { timeout: 5000 })
    expect(account).not.toHaveTextContent('Synced')
    expect(account.querySelector('[data-sync="synced"] svg')).toHaveAttribute('aria-hidden', 'true')
    expect(account).toHaveAttribute('title', 'anthony@example.com · Synced')
  })

  it('shows words only when something needs attention: Offline', async () => {
    const auth = new FakeAuth()
    auth.addUser(MAIN, 'anthony@example.com', 'Anthony')
    const client = auth.client(MAIN)
    ;(client.remote as InstanceType<typeof FakeRemote>).failing = 'offline'
    renderDevice(client)
    const account = await screen.findByRole('button', { name: /, Offline$/ }, { timeout: 5000 })
    expect(account).toHaveTextContent('Offline')
    expect(account).toHaveAttribute('title', 'anthony@example.com · Offline')
  })
})
