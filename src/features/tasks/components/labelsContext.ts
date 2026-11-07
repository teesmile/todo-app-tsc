'use client'

import type { Category } from '../store/types'
import { createContext, use } from 'react'

export interface LabelsContextValue {
  /** Live labels, by name. */
  categories: Category[]
  /** Opens the labels manager. */
  openManager: () => void
}

const empty: LabelsContextValue = { categories: [], openManager: () => {} }

/** Labels and the manager, shared by the list with every row. */
export const LabelsContext = createContext<LabelsContextValue>(empty)

export function useLabels(): LabelsContextValue {
  return use(LabelsContext)
}
