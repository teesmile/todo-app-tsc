import type { CategoryColor } from '../store/types'

/**
 * The eight label colours. Fixed, so every chip stays readable: each pairs a
 * light background with a dark text shade from the same hue (WCAG AA for
 * small text). Class strings are written out in full so Tailwind finds them.
 */
export const PALETTE: Record<CategoryColor, { name: string, chip: string, dot: string }> = {
  red: { name: 'Red', chip: 'bg-red-50 text-red-800 border-red-200', dot: 'bg-red-500' },
  orange: { name: 'Orange', chip: 'bg-orange-50 text-orange-800 border-orange-200', dot: 'bg-orange-500' },
  amber: { name: 'Amber', chip: 'bg-amber-50 text-amber-900 border-amber-200', dot: 'bg-amber-500' },
  green: { name: 'Green', chip: 'bg-green-50 text-green-800 border-green-200', dot: 'bg-green-600' },
  teal: { name: 'Teal', chip: 'bg-teal-50 text-teal-800 border-teal-200', dot: 'bg-teal-600' },
  blue: { name: 'Blue', chip: 'bg-blue-50 text-blue-800 border-blue-200', dot: 'bg-blue-600' },
  violet: { name: 'Violet', chip: 'bg-violet-50 text-violet-800 border-violet-200', dot: 'bg-violet-600' },
  pink: { name: 'Pink', chip: 'bg-pink-50 text-pink-800 border-pink-200', dot: 'bg-pink-600' },
}
