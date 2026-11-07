import { TitleError } from '../store/repository'

/**
 * What to tell the user when a save fails. Validation errors explain
 * themselves. Anything else (storage full, a blocked database) gets a plain
 * message that says their text is still there.
 */
export function saveErrorMessage(error: unknown): string {
  if (error instanceof TitleError)
    return error.message
  return 'That couldn\'t be saved. Your text is still here, so try again.'
}
