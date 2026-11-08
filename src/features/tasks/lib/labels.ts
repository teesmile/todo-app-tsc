import type { Category } from '../store/types'

/**
 * For each label that shares its name with an older one (ignoring case), the
 * older one: the pair two offline devices make when both create "Work".
 */
export function duplicatesOf(categories: Category[]): Map<string, Category> {
  const byName = new Map<string, Category>()
  const result = new Map<string, Category>()
  for (const c of [...categories].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))) {
    const key = c.name.toLowerCase()
    const first = byName.get(key)
    if (first)
      result.set(c.id, first)
    else
      byName.set(key, c)
  }
  return result
}
