/**
 * The statistics pages' formatters and class names. No 'use client': server components (the dashboard, the
 * routes, Best against) call these, and a client module's exports are only references on the server.
 */

import { leadOf } from '@utils/statistics'

/** Thousands with a space: `48 216`. */
export const n = (v: number) => v.toLocaleString('en-US').replace(/,/g, ' ')
const MINUS = '−'
/** A signed figure with its own sign: `+3.8`, `−2.9`, `±0.0`. */
export const signed = (v: number, digits = 1) => {
  // the sign of what is printed: 0.04 is `±0.0`, not `+0.0`
  const shown = Number(v.toFixed(digits))
  return `${shown > 0 ? '+' : shown < 0 ? MINUS : '±'}${Math.abs(shown).toFixed(digits)}`
}
/** A rate (0–1) as a percent with one decimal. */
export const pc = (r: number | null | undefined) => (r == null ? '–' : `${(r * 100).toFixed(1)}%`)
/** An interval with one decimal on each end: `54.0–56.4`. */
export const ci = (lo: number, hi: number) => `${(lo * 100).toFixed(1)}–${(hi * 100).toFixed(1)}`
/** Where `x` sits on [lo, hi], clamped, as a CSS percent. */
export const at = (x: number, lo: number, hi: number) => `${(Math.max(0, Math.min(1, (x - lo) / (hi - lo))) * 100).toFixed(2)}%`
/** The width of [a, b] on [lo, hi], clipped to it. */
export const span = (a: number, b: number, lo: number, hi: number) => `${((Math.max(0, Math.min(b, hi) - Math.max(a, lo)) / (hi - lo)) * 100).toFixed(2)}%`
/** A gap in points: green past +0.05, red under −0.05, grey between. */
export const tone = (points: number) => (points > 0.05 ? 'text-win' : points < -0.05 ? 'text-loss' : 'text-draw')
/** A mark as the page prints it: 55%, 52.5%. */
export const mark = (r: number) => `${Number((r * 100).toFixed(1))}%`
/** `name` is `null` for a setcode without a name: the key stands in. */
export const nameOf = (a: { key: string; name: string | null }) => a.name ?? ((a.key.endsWith('*') ? leadOf(a.key) : a.key) || '?')

export type Faces = Record<string, number | null>

/** Each deck's card by key, from the meta rows (`face`). */
export const facesOf = (decks: readonly { key: string; face?: number | null }[]): Faces => Object.fromEntries(decks.map((d) => [d.key, d.face ?? null]))

/** A mixed deck's second archetype's card: the face of its own deck (`B`), else of its lead row (`B*`). `A` alone has none. */
export const subFace = (key: string, faces: Faces): number | null => {
  const second = key.split('>')[1]
  return second ? (faces[second] ?? faces[`${second}*`] ?? null) : null
}

/** Grid table: 1px line between rows. */
export const ROWS = 'grid gap-px bg-line'
export const HEAD_ROW = 'grid min-h-11 items-center bg-surface-200'
export const ROW = 'grid items-center bg-surface-100 transition-colors duration-[120ms] ease-out hover:bg-surface-300'
export const TH = 'text-ink-muted signal'
export const NUMERIC = 'text-right tabular-nums'
export const LINK_BTN = 'inline-flex min-h-11 cursor-pointer items-center gap-2 text-cyan signal-strong hover:text-ink focus-visible:shadow-focus-ring focus-visible:outline-none'
/** Only on wide screens, only on narrow ones: the tables turn into lists under 720px. */
export const WIDE = 'max-[719px]:hidden'
export const NARROW = 'min-[720px]:hidden'

export type Read = 'good' | 'bad' | 'flat'
/** Matchup color: green or red only when the gap's interval clears zero. */
export const BAR: Record<Read, string> = { good: 'bg-win', bad: 'bg-loss', flat: 'bg-[#4a5578]' }
export const WHISKER: Record<Read, string> = { good: 'bg-win', bad: 'bg-loss', flat: 'bg-ink-muted' }

/** A .ydk file of the zones, copies repeated. */
export const ydk = (zones: { main: { id: number; count: number }[]; extra: { id: number; count: number }[]; side?: { id: number; count: number }[] }) => {
  const lines = (cards: { id: number; count: number }[]) => cards.flatMap((c) => Array.from({ length: c.count }, () => String(c.id)))
  return ['#created by Omega Hub', '#main', ...lines(zones.main), '#extra', ...lines(zones.extra), '!side', ...lines(zones.side ?? []), ''].join('\n')
}
