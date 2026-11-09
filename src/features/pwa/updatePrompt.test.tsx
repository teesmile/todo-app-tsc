import type { AxeResults } from 'axe-core'
import type { ContainerLike, RegistrationLike, WorkerLike } from './serviceWorker'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { describe, expect, it, vi } from 'vitest'
import { registerServiceWorker } from './serviceWorker'
import { UpdatePrompt } from './updatePrompt'

function fakeWorker(state = 'installing') {
  const listeners: (() => void)[] = []
  const worker: WorkerLike & { messages: unknown[], become: (s: string) => void } = {
    state,
    messages: [],
    postMessage: message => worker.messages.push(message),
    addEventListener: (_type, listener) => listeners.push(listener),
    become: (s) => {
      worker.state = s
      listeners.forEach(l => l())
    },
  }
  return worker
}

function fakeContainer({ controlled, waiting = null }: { controlled: boolean, waiting?: WorkerLike | null }) {
  const found: (() => void)[] = []
  const changed: (() => void)[] = []
  const registration: RegistrationLike = {
    installing: null,
    waiting,
    update: vi.fn(async () => {}),
    addEventListener: (_type, listener) => found.push(listener),
  }
  const container: ContainerLike & { registered: string[] } = {
    controller: controlled ? {} : null,
    registered: [],
    register: async (url) => {
      container.registered.push(url)
      return registration
    },
    addEventListener: (_type, listener) => changed.push(listener),
  }
  return {
    container,
    registration,
    /** A new version starts installing. */
    install: (worker: WorkerLike) => {
      registration.installing = worker
      found.forEach(l => l())
    },
    /** A worker took control of the page. */
    controllerChange: () => changed.forEach(l => l()),
  }
}

describe('the service worker and its update prompt', () => {
  it('offers an update that was already waiting, and applies it only when asked', async () => {
    const waiting = fakeWorker('installed') as ReturnType<typeof fakeWorker>
    const fake = fakeContainer({ controlled: true, waiting })
    const reload = vi.fn()
    let apply: (() => void) | null = null
    await registerServiceWorker(fake.container, { onUpdate: a => (apply = a), reload })

    expect(apply).not.toBeNull()
    expect(waiting.messages).toEqual([])
    apply!()
    expect(waiting.messages).toEqual([{ type: 'SKIP_WAITING' }])
    expect(reload).not.toHaveBeenCalled()
    fake.controllerChange()
    expect(reload).toHaveBeenCalledOnce()
  })

  it('offers an update found later, once it has installed', async () => {
    const fake = fakeContainer({ controlled: true })
    const onUpdate = vi.fn()
    await registerServiceWorker(fake.container, { onUpdate, reload: vi.fn() })
    const next = fakeWorker()
    fake.install(next)
    expect(onUpdate).not.toHaveBeenCalled()
    next.become('installed')
    expect(onUpdate).toHaveBeenCalledOnce()
  })

  it('takes control silently on the first install: no prompt, no reload', async () => {
    const fake = fakeContainer({ controlled: false })
    const onUpdate = vi.fn()
    const reload = vi.fn()
    await registerServiceWorker(fake.container, { onUpdate, reload })
    const first = fakeWorker()
    fake.install(first)
    first.become('installed')
    fake.controllerChange()
    expect(onUpdate).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
  })

  it('shows "Update available" with a Reload button that applies it', async () => {
    const waiting = fakeWorker('installed') as ReturnType<typeof fakeWorker>
    const fake = fakeContainer({ controlled: true, waiting })
    const user = userEvent.setup()
    render(<UpdatePrompt container={fake.container} enabled />)
    expect(await screen.findByText('Update available.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reload' }))
    expect(waiting.messages).toEqual([{ type: 'SKIP_WAITING' }])
  })

  it('checks for a new version when the tab is shown again', async () => {
    const fake = fakeContainer({ controlled: true })
    render(<UpdatePrompt container={fake.container} enabled />)
    await act(async () => {})
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(fake.registration.update).toHaveBeenCalled()
  })

  it('does nothing in development builds', async () => {
    const fake = fakeContainer({ controlled: false })
    render(<UpdatePrompt container={fake.container} enabled={false} />)
    await act(async () => {})
    expect(fake.container.registered).toEqual([])
  })

  it('passes axe, with the prompt in a status region so it is announced', async () => {
    const fake = fakeContainer({ controlled: true, waiting: fakeWorker('installed') })
    render(<UpdatePrompt container={fake.container} enabled />)
    const text = await screen.findByText('Update available.')
    expect(text.closest('[role=status]')).not.toBeNull()
    const result: AxeResults = await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } })
    expect(result.violations.map(v => v.id)).toEqual([])
  })

  it('does not listen for tab visibility after unmounting mid-registration', async () => {
    const fake = fakeContainer({ controlled: true })
    const { unmount } = render(<UpdatePrompt container={fake.container} enabled />)
    unmount()
    await act(async () => {})
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(fake.registration.update).not.toHaveBeenCalled()
  })
})
