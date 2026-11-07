/**
 * Seeded once, on the first visit, so a new user sees how the app works.
 * Due dates are day offsets from the day of seeding, so whatever day that is,
 * there's one overdue task, one due today, one tomorrow, one later and one
 * with no date.
 */
export interface SampleTask {
  title: string
  dueInDays: number | null
}

export const sampleTasks: SampleTask[] = [
  { title: 'Renew your passport', dueInDays: -2 },
  { title: 'Water the plants', dueInDays: 0 },
  { title: 'Book a dentist appointment', dueInDays: 1 },
  { title: 'Plan the weekend trip', dueInDays: 5 },
  { title: 'Try editing or deleting these sample tasks', dueInDays: null },
]
