/**
 * The My statistics page's numbers, pure: verdict reads, gaps in points, records per deck from the timeline,
 * week labels and the running-total chart. No 'use client': the server sections call these too.
 */

import type { PlayerSlice, TimelineRow } from '@utils/statistics'
import type { Read } from '@app/statistics/format'

export const readOf = (s: Pick<PlayerSlice, 'verdict'>): Read => (s.verdict === 'above' ? 'good' : s.verdict === 'below' ? 'bad' : 'flat')

/** A slice in points: your rate and the expected (0–1), the gap and its interval (points). Null without games. */
export const gap = (s: PlayerSlice) =>
  s.n === 0 || s.xWr === null || s.pve === null || s.pveLo === null || s.pveHi === null
    ? null
    : { you: Math.round((s.xWr + s.pve) * 1e4) / 1e4, exp: s.xWr, gap: Math.round(s.pve * 1e3) / 10, lo: Math.round(s.pveLo * 1e3) / 10, hi: Math.round(s.pveHi * 1e3) / 10 }

/** The overview's headline: the season's verdict, or `few` under its floor. */
export const headlineOf = (verdict: PlayerSlice['verdict']) => (verdict === 'above' || verdict === 'below' || verdict === 'unclear' ? verdict : 'few')

export type DeckRecord = { wins: number; losses: number; draws: number; matches: number }

/** Games won, lost and drawn and matches per deck (or per opponent deck), mirrors included: the duelist's record, not the comparison. */
export const deckRecords = (timeline: readonly TimelineRow[], side: 'deck' | 'opponent' = 'deck'): Record<string, DeckRecord> => {
  const out: Record<string, DeckRecord> = {}
  for (const row of timeline) {
    const [, , , , w, l, d] = row
    const deck = row[side === 'deck' ? 2 : 3]
    if (!deck) continue
    const r = (out[deck] ??= { wins: 0, losses: 0, draws: 0, matches: 0 })
    r.wins += w
    r.losses += l
    r.draws += d
    r.matches += 1
  }
  return out
}

const DAY_MS = 86_400_000
const dayParts = (iso: string, locale: string) => {
  const date = new Date(`${iso}T00:00:00Z`)
  const part = (o: Intl.DateTimeFormatOptions) => date.toLocaleDateString(locale, { ...o, timeZone: 'UTC' })
  return { weekday: part({ weekday: 'short' }), day: part({ day: '2-digit' }), month: part({ month: 'short' }) }
}

/** `Mon 19 – Sun 25 Oct`, `Mon 26 Oct – Sun 01 Nov`; a week past the last swept day is `Since Mon 02 Nov`. */
export const weekDates = (firstDay: string, sweptThrough: string | null, locale: string, since = (day: string) => `Since ${day}`) => {
  const lastDay = new Date(Date.parse(`${firstDay}T00:00:00Z`) + 6 * DAY_MS).toISOString().slice(0, 10)
  const a = dayParts(firstDay, locale)
  if (sweptThrough && lastDay > sweptThrough) return since(`${a.weekday} ${a.day} ${a.month}`)
  const b = dayParts(lastDay, locale)
  return a.month === b.month ? `${a.weekday} ${a.day} – ${b.weekday} ${b.day} ${b.month}` : `${a.weekday} ${a.day} ${a.month} – ${b.weekday} ${b.day} ${b.month}`
}

const STEPS = [1, 2, 4, 5, 10, 20, 25, 50, 100, 200, 250, 500]

/** A y range with zero in it, half a step of air on each side, and the round ticks inside. */
export const ticksFor = (min: number, max: number) => {
  const low = Math.min(0, min)
  const high = Math.max(0, max)
  if (high - low === 0) return { lo: -1, hi: 1, ticks: [0] }
  const step = STEPS.find((s) => (high - low) / s <= 3) ?? STEPS[STEPS.length - 1]!
  const lo = Math.floor(low / step) * step - step / 2
  const hi = Math.ceil(high / step) * step + step / 2
  const ticks: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v)
  return { lo, hi, ticks }
}

/** At most this many points on the line: a season is a few thousand games, the chart a few hundred pixels. */
const MAX_POINTS = 300
const pct = (v: number) => `${v.toFixed(2)}%`

/**
 * The running wins above expected as an SVG polyline on a 0–100 box, game 0 at zero; dashed week boundaries and a
 * `W<n>` label in the middle of each week (`weeks` are benchmarked games per week, oldest first).
 */
export const runningChart = (running: readonly number[], weeks: readonly { week: number; n: number }[]) => {
  const total = running.length
  if (!total) return { line: '', area: '', grid: [], zeroTop: '50%', endTop: '50%', end: 0, weekLines: [], weekLabels: [] }
  const { lo, hi, ticks } = ticksFor(Math.min(...running), Math.max(...running))
  const y = (v: number) => ((hi - v) / (hi - lo)) * 100
  const every = Math.ceil(total / MAX_POINTS)
  const points: string[] = [`0.00,${y(0).toFixed(2)}`]
  for (let i = 0; i < total; i++) if ((i + 1) % every === 0 || i === total - 1) points.push(`${(((i + 1) / total) * 100).toFixed(2)},${y(running[i]!).toFixed(2)}`)
  const line = points.join(' ')
  const end = running[total - 1]!
  let at = 0
  const weekLines: string[] = []
  const weekLabels: { label: string; left: string }[] = []
  weeks.forEach((w, i) => {
    weekLabels.push({ label: `W${w.week}`, left: pct(((at + w.n / 2) / total) * 100) })
    at += w.n
    if (i < weeks.length - 1) weekLines.push(pct((at / total) * 100))
  })
  return {
    line,
    area: `0,${y(0).toFixed(2)} ${line} 100,${y(0).toFixed(2)}`,
    grid: ticks.map((value) => ({ value, top: pct(y(value)) })),
    zeroTop: pct(y(0)),
    endTop: pct(y(end)),
    end,
    weekLines,
    weekLabels,
  }
}

const ELO_STEPS = [10, 20, 40, 50, 100, 200, 400, 500]

/** The season's rating as a polyline on a 0–100 box, half a step of air around it, round ticks inside. */
export const eloChart = (elo: readonly number[]) => {
  if (elo.length < 2) return { line: '', grid: [], delta: 0 }
  const min = Math.min(...elo)
  const max = Math.max(...elo)
  const step = ELO_STEPS.find((s) => (max - min) / s <= 3) ?? ELO_STEPS[ELO_STEPS.length - 1]!
  const lo = min - step / 2
  const hi = max + step / 2
  const y = (v: number) => ((hi - v) / (hi - lo)) * 100
  const grid: { value: number; top: string }[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) grid.push({ value: v, top: pct(y(v)) })
  const line = elo.map((v, i) => `${((i / (elo.length - 1)) * 100).toFixed(2)},${y(v).toFixed(2)}`).join(' ')
  return { line, grid, delta: elo[elo.length - 1]! - elo[0]! }
}
