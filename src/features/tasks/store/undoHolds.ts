/**
 * Deletes whose Undo is on screen in this tab, by task id. Sync doesn't send
 * them while they're here, however long the toast stays paused, so pressing
 * Undo never races an outgoing delete (review 11). The toast adds its
 * tasks when it appears and removes them when it closes.
 */
const held = new Set<string>()

export function holdUndo(ids: readonly string[]): () => void {
  ids.forEach(id => held.add(id))
  return () => ids.forEach(id => held.delete(id))
}

export function isUndoHeld(id: string): boolean {
  return held.has(id)
}
