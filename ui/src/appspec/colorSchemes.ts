/**
 * 12 color schemes for the visual library.
 * Each scheme provides a primary palette array for multi-series visuals
 * plus accent/start/mid/text colors for single-series.
 */

export interface ColorScheme {
  id: string
  label: string
  start: string     // primary accent
  mid: string       // secondary/lighter accent
  text: string      // text color for values
  palette: string[] // multi-series colors (up to 8)
}

export const COLOR_SCHEMES: Record<string, ColorScheme> = {
  teal: {
    id: 'teal', label: 'Teal',
    start: '#14B8A6', mid: '#2DD4BF', text: '#14B8A6',
    palette: ['#14B8A6', '#0D9488', '#2DD4BF', '#5EEAD4', '#99F6E4', '#0F766E', '#115E59', '#134E4A'],
  },
  blue: {
    id: 'blue', label: 'Blue',
    start: '#3B82F6', mid: '#60A5FA', text: '#3B82F6',
    palette: ['#3B82F6', '#2563EB', '#60A5FA', '#93C5FD', '#BFDBFE', '#1D4ED8', '#1E40AF', '#1E3A8A'],
  },
  purple: {
    id: 'purple', label: 'Purple',
    start: '#A855F7', mid: '#C084FC', text: '#A855F7',
    palette: ['#A855F7', '#9333EA', '#C084FC', '#D8B4FE', '#E9D5FF', '#7C3AED', '#6D28D9', '#5B21B6'],
  },
  violet: {
    id: 'violet', label: 'Violet',
    start: '#8B5CF6', mid: '#A78BFA', text: '#8B5CF6',
    palette: ['#8B5CF6', '#7C3AED', '#A78BFA', '#C4B5FD', '#DDD6FE', '#6D28D9', '#5B21B6', '#4C1D95'],
  },
  gold: {
    id: 'gold', label: 'Gold',
    start: '#F59E0B', mid: '#FBBF24', text: '#F59E0B',
    palette: ['#F59E0B', '#D97706', '#FBBF24', '#FCD34D', '#FDE68A', '#B45309', '#92400E', '#78350F'],
  },
  green: {
    id: 'green', label: 'Green',
    start: '#22C55E', mid: '#4ADE80', text: '#22C55E',
    palette: ['#22C55E', '#16A34A', '#4ADE80', '#86EFAC', '#BBF7D0', '#15803D', '#166534', '#14532D'],
  },
  rose: {
    id: 'rose', label: 'Rose',
    start: '#F43F5E', mid: '#FB7185', text: '#F43F5E',
    palette: ['#F43F5E', '#E11D48', '#FB7185', '#FDA4AF', '#FECDD3', '#BE123C', '#9F1239', '#881337'],
  },
  red: {
    id: 'red', label: 'Red',
    start: '#EF4444', mid: '#F87171', text: '#EF4444',
    palette: ['#EF4444', '#DC2626', '#F87171', '#FCA5A5', '#FECACA', '#B91C1C', '#991B1B', '#7F1D1D'],
  },
  orange: {
    id: 'orange', label: 'Orange',
    start: '#F97316', mid: '#FB923C', text: '#F97316',
    palette: ['#F97316', '#EA580C', '#FB923C', '#FDBA74', '#FED7AA', '#C2410C', '#9A3412', '#7C2D12'],
  },
  amber: {
    id: 'amber', label: 'Amber',
    start: '#F59E0B', mid: '#FCD34D', text: '#F59E0B',
    palette: ['#F59E0B', '#D97706', '#FCD34D', '#FDE68A', '#FEF3C7', '#B45309', '#92400E', '#78350F'],
  },
  indigo: {
    id: 'indigo', label: 'Indigo',
    start: '#6366F1', mid: '#818CF8', text: '#6366F1',
    palette: ['#6366F1', '#4F46E5', '#818CF8', '#A5B4FC', '#C7D2FE', '#4338CA', '#3730A3', '#312E81'],
  },
  cyan: {
    id: 'cyan', label: 'Cyan',
    start: '#06B6D4', mid: '#22D3EE', text: '#06B6D4',
    palette: ['#06B6D4', '#0891B2', '#22D3EE', '#67E8F9', '#A5F3FC', '#0E7490', '#155E75', '#164E63'],
  },
}

/** Multi-series fallback palette (used when scheme doesn't have enough colors) */
export const MULTI_COLORS = ['#14B8A6', '#3B82F6', '#A855F7', '#F59E0B', '#22C55E', '#F43F5E', '#6366F1', '#06B6D4']

/** Get a scheme by id, with teal fallback */
export function getColorScheme(id?: string): ColorScheme {
  return COLOR_SCHEMES[id || 'teal'] || COLOR_SCHEMES.teal
}

export default COLOR_SCHEMES
