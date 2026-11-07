'use client'

import { createContext, use, useState } from 'react'

/** An open inline editor, kept outside the row so it survives a remount. */
export interface EditDraft {
  draft: string
  /** The title when editing began: the base for "untouched" and for compare-and-set. */
  base: string
  /** True after a conflict: blur must not overwrite; only Enter or Escape decides. */
  conflicted: boolean
  focused: boolean
}

/**
 * Drafts keyed by task id, owned by the list. A task that moves to another
 * group (at midnight, or after another tab changes its date) is unmounted
 * from one group and mounted in the next; without this its editor, draft
 * and focus would be lost (review of Phases 4-6).
 */
export class EditDrafts {
  private drafts = new Map<string, EditDraft>()
  get(id: string) {
    return this.drafts.get(id)
  }

  set(id: string, draft: EditDraft) {
    this.drafts.set(id, draft)
  }

  delete(id: string) {
    this.drafts.delete(id)
  }
}

export const EditDraftsContext = createContext<EditDrafts | null>(null)

export function useEditDrafts(): EditDrafts {
  const shared = use(EditDraftsContext)
  // A row rendered on its own (in tests) gets a private store, so no draft
  // can leak between rows; it just doesn't survive moving groups.
  const [own] = useState(() => new EditDrafts())
  return shared ?? own
}
