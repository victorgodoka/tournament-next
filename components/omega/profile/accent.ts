import type { Accent } from '@utils/types'

/**
 * Class sets for the two ladder accents. The API still sends the legacy names, so they map onto
 * the design system here: `green` is the brand gold, `magenta` the cyan counterpoint.
 */
export const ACCENT_CLASSES: Record<Accent, { bg: string; text: string; onBg: string; tint: string }> = {
  green: { bg: 'bg-gold', text: 'text-gold', onBg: 'text-gold-on', tint: 'bg-ground-gold' },
  magenta: { bg: 'bg-cyan', text: 'text-cyan', onBg: 'text-cyan-on', tint: 'bg-ground-cyan' },
}

/** Shared mono micro-label used for every caption on the profile. */
export const MICRO_LABEL = 'text-ink-muted signal'

/** Chip sizing for the tiny mono tags in the design. */
export const MICRO_TAG = 'gap-0 px-2.5 py-1 signal-chip tracking-[.2em]'

/** Tag colouring for anything withheld or unplayed. */
export const MUTED_TAG = 'border-surface-400 bg-surface-400 text-ink-muted'
