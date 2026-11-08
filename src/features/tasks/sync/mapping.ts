import type { Category, CategoryColor, Task } from '../store/types'
import type { Outgoing, ServerCategory, ServerTask } from './types'
import { CATEGORY_COLORS } from '../store/types'
import { iso, ms } from './time'

/** The server's title limit (review 5). Longer titles exist only from the legacy import. */
export const SERVER_MAX_TITLE_LENGTH = 10_000

export function taskToServer(task: Task, userId: string): Outgoing<'tasks'> {
  return {
    id: task.id,
    user_id: userId,
    title: task.title,
    completed: task.completed,
    due_date: task.dueDate,
    vital: task.vital === 1,
    category_ids: task.categoryIds,
    created_at: iso(task.createdAt),
    updated_at: iso(task.updatedAt),
    completed_at: task.completedAt === null ? null : iso(task.completedAt),
    deleted_at: task.deletedAt === null ? null : iso(task.deletedAt),
  }
}

/**
 * The server's row as a local task, synced (`dirty: 0`). Local-only fields
 * come from `local` when there is one: `rev` keeps counting, and `isSample`
 * survives. A server tombstone is final, so it carries no undo token
 * (`deletedRev: null`): a late Undo is refused.
 */
export function taskFromServer(row: ServerTask, local?: Task): Task {
  return {
    id: row.id,
    ownerId: row.user_id,
    title: row.title,
    completed: row.completed,
    dueDate: row.due_date,
    isSample: local?.isSample ?? 0,
    dirty: 0,
    rev: local?.rev ?? 0,
    createdAt: ms(row.created_at),
    updatedAt: ms(row.updated_at),
    completedAt: row.completed_at === null ? null : ms(row.completed_at),
    deletedAt: row.deleted_at === null ? null : ms(row.deleted_at),
    deletedRev: null,
    vital: row.vital ? 1 : 0,
    categoryIds: [...row.category_ids],
    serverStamp: row.server_updated_at,
  }
}

export function categoryToServer(category: Category, userId: string): Outgoing<'categories'> {
  return {
    id: category.id,
    user_id: userId,
    name: category.name,
    color: category.color,
    created_at: iso(category.createdAt),
    updated_at: iso(category.updatedAt),
    deleted_at: category.deletedAt === null ? null : iso(category.deletedAt),
  }
}

export function categoryFromServer(row: ServerCategory, local?: Category): Category {
  const color = (CATEGORY_COLORS as readonly string[]).includes(row.color) ? row.color as CategoryColor : 'blue'
  return {
    id: row.id,
    ownerId: row.user_id,
    name: row.name,
    color,
    dirty: 0,
    rev: local?.rev ?? 0,
    createdAt: ms(row.created_at),
    updatedAt: ms(row.updated_at),
    deletedAt: row.deleted_at === null ? null : ms(row.deleted_at),
    serverStamp: row.server_updated_at,
  }
}
