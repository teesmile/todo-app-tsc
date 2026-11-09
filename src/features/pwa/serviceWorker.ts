/** The parts of the browser's service worker API this uses, so tests can pass a fake. */
export interface WorkerLike {
  state: string
  postMessage: (message: unknown) => void
  addEventListener: (type: 'statechange', listener: () => void) => void
}
export interface RegistrationLike {
  installing: WorkerLike | null
  waiting: WorkerLike | null
  update: () => Promise<unknown>
  addEventListener: (type: 'updatefound', listener: () => void) => void
}
export interface ContainerLike {
  controller: unknown
  register: (url: string, options: { scope: string }) => Promise<RegistrationLike>
  addEventListener: (type: 'controllerchange', listener: () => void) => void
}

/**
 * Registers the service worker and reports a waiting update. `onUpdate` gets
 * a function that applies it: it asks the waiting worker to take over, and
 * the page reloads once it has. Nothing reloads on its own: the first
 * install takes control silently, and an update only applies when asked.
 *
 * Another tab can apply the update first. This page is then still running
 * the old code under the new worker, so it's offered a plain reload, shown
 * the same way and taken only when the user asks (review 18).
 */
export async function registerServiceWorker(container: ContainerLike, { onUpdate, reload }: { onUpdate: (apply: () => void) => void, reload: () => void }): Promise<RegistrationLike> {
  const registration = await container.register('/sw.js', { scope: '/' })
  // Whether a worker controlled this page before the latest change.
  let controlled = !!container.controller
  let requested = false
  let replaced = false
  const offer = (worker: WorkerLike) => onUpdate(() => {
    // Already taken over (from another tab): only this page is behind.
    if (replaced)
      return reload()
    requested = true
    worker.postMessage({ type: 'SKIP_WAITING' })
  })

  // An update that finished installing before this page loaded.
  if (registration.waiting && container.controller)
    offer(registration.waiting)
  registration.addEventListener('updatefound', () => {
    const worker = registration.installing
    worker?.addEventListener('statechange', () => {
      // Installed while an older version controls the page: an update.
      if (worker.state === 'installed' && container.controller)
        offer(worker)
    })
  })
  container.addEventListener('controllerchange', () => {
    const wasControlled = controlled
    controlled = true
    if (requested) {
      requested = false
      reload()
    }
    else if (wasControlled && !replaced) {
      // Another tab applied an update; never on the first install.
      replaced = true
      onUpdate(reload)
    }
  })
  return registration
}
