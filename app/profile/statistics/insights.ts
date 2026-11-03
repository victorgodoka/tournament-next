/**
 * One duelist's ranked numbers cut from `record.timeline`: a period, the period before it, per-deck and
 * per-matchup tallies, streaks, and the "performance analysis" lines. Pure, so it has its own test.
 */

import type { EloPoint, Profile, RankedLadderId } from '@utils/types'
import type { Tally3, TimelineRow } from '@utils/statistics'
import type { LadderStanding } from './RankedDashboard'

/** Rating, tier, rank and the daily Elo points of the pick: a season's own, or the live ladder (open season's points). */
export const standingOf = (profile: Extract<Profile, { isPrivate: false }>, pick: { season?: string; ladder: RankedLadderId }): LadderStanding | null => {
  const ladder = profile.ladders.find((l) => l.format === (pick.ladder === 'genesys' ? 'Genesys' : 'TCG'))
  if (!ladder?.played) return null
  const open = ladder.seasons.find((s) => s.open)
  if (pick.season) {
    const season = ladder.seasons.find((s) => s.code === pick.season)
    // Owner only: elo is never hidden from them, the fallbacks only satisfy the type.
    return season ? { elo: season.elo ?? 0, tier: season.tier ?? 'Iron', rank: season.rank ?? null, eloHistory: season.eloHistory } : null
  }
  return { elo: ladder.elo ?? 0, tier: ladder.tier ?? 'Iron', rank: open?.rank ?? null, eloHistory: open?.eloHistory }
}

export type Period = 7 | 14 | 30 | null
const DAY_MS = 86_400_000
/** Under this many matches a deck or matchup is listed, never called better or worse. */
export const MIN_MATCHES = 10

export const played = (t: Tally3) => t.wins + t.losses + t.draws
export const winRate = (t: Tally3) => (played(t) ? t.wins / played(t) : null)
const empty = (): Tally3 => ({ wins: 0, losses: 0, draws: 0 })
const add = (t: Tally3, result: TimelineRow[1]) => {
  if (result === 'W') t.wins += 1
  else if (result === 'L') t.losses += 1
  else if (result === 'D') t.draws += 1
}

const ms = (row: TimelineRow) => (row[0] ? Date.parse(row[0]) : null)

/** The rows of the last `days` (every row for `null`); a row without a date only counts in "all". */
export const inPeriod = (rows: TimelineRow[], days: Period, now: number) =>
  days === null ? rows : rows.filter((r) => (ms(r) ?? -Infinity) >= now - days * DAY_MS)

/** The span just before the period, as long as it; `null` for "all" (nothing before it). */
export const previousPeriod = (rows: TimelineRow[], days: Period, now: number) => {
  if (days === null) return null
  return rows.filter((r) => {
    const t = ms(r)
    return t !== null && t >= now - 2 * days * DAY_MS && t < now - days * DAY_MS
  })
}

export const matchTally = (rows: TimelineRow[]) => {
  const t = empty()
  for (const r of rows) add(t, r[1])
  return t
}
export const gameTally = (rows: TimelineRow[]): Tally3 =>
  rows.reduce((t, r) => ({ wins: t.wins + r[4], losses: t.losses + r[5], draws: t.draws + r[6] }), empty())

export type Split = { key: string; matches: Tally3; games: Tally3 }

/** Tallies by a key of the row (their deck, the opponent's, or the pair); unknown decks left out. */
const splitBy = (rows: TimelineRow[], keyOf: (r: TimelineRow) => string | null): Split[] => {
  const out = new Map<string, Split>()
  for (const r of rows) {
    const key = keyOf(r)
    if (!key) continue
    const s = out.get(key) ?? out.set(key, { key, matches: empty(), games: empty() }).get(key)!
    add(s.matches, r[1])
    s.games.wins += r[4]
    s.games.losses += r[5]
    s.games.draws += r[6]
  }
  return [...out.values()].sort((a, b) => played(b.matches) - played(a.matches) || (a.key < b.key ? -1 : 1))
}
export const byDeck = (rows: TimelineRow[]) => splitBy(rows, (r) => r[2])
export const byOpponent = (rows: TimelineRow[]) => splitBy(rows, (r) => r[3])
export const pairKey = (deck: string, opponent: string) => `${deck}|${opponent}`
export const byPair = (rows: TimelineRow[]) => splitBy(rows, (r) => (r[2] && r[3] ? pairKey(r[2], r[3]) : null))

/**
 * `rows` newest first. Current: the run of the newest result (a match without one is skipped; a draw is
 * its own run). Best: the longest run of wins in the rows read.
 */
export const streaks = (rows: TimelineRow[]) => {
  const results = rows.map((r) => r[1]).filter((r): r is 'W' | 'L' | 'D' => r !== null)
  const head = results[0] ?? null
  let current = 0
  while (head && results[current] === head) current += 1
  let best = 0, run = 0
  for (const r of results) {
    run = r === 'W' ? run + 1 : 0
    best = Math.max(best, run)
  }
  return { current: head ? { result: head, count: current } : null, bestWins: best }
}

/** Elo change over the period from the open season's daily points; `null` without two points in it. */
export const eloChange = (history: EloPoint[] | undefined, current: number | null, days: Period, now: number) => {
  if (!history?.length || current === null) return null
  const from = days === null ? history : history.filter((p) => Date.parse(`${p.day}T00:00:00Z`) >= now - days * DAY_MS)
  const start = from[0] ?? history.at(-1)!
  return current - start.elo
}

/** A line of the performance analysis: an i18n key and its values. Every line names its sample. */
export type Insight = { id: string; tone: 'good' | 'bad' | 'neutral'; values: Record<string, string | number> }

const pts = (a: number, b: number) => Math.round(Math.abs(a - b) * 1000) / 10
const pctOf = (r: number) => `${(r * 100).toFixed(1)}%`

export const insights = ({ rows, previous, elo, names }: {
  rows: TimelineRow[]
  previous: TimelineRow[] | null
  elo: number | null
  names: (key: string) => string
}): Insight[] => {
  const out: Insight[] = []
  if (elo !== null && elo !== 0) out.push({ id: elo > 0 ? 'eloUp' : 'eloDown', tone: elo > 0 ? 'good' : 'bad', values: { points: Math.abs(elo) } })

  const now = matchTally(rows)
  if (previous) {
    const before = matchTally(previous)
    const a = winRate(now), b = winRate(before)
    if (a !== null && b !== null && played(now) >= MIN_MATCHES && played(before) >= MIN_MATCHES && pts(a, b) >= 5)
      out.push({ id: a > b ? 'rateUp' : 'rateDown', tone: a > b ? 'good' : 'bad', values: { points: pts(a, b), now: played(now), before: played(before) } })
  }

  const decks = byDeck(rows)
  const solid = decks.filter((d) => played(d.matches) >= MIN_MATCHES).sort((x, y) => winRate(y.matches)! - winRate(x.matches)!)
  if (solid.length >= 2) {
    const [best, worst] = [solid[0]!, solid.at(-1)!]
    if (pts(winRate(best.matches)!, winRate(worst.matches)!) >= 5)
      out.push({
        id: 'deckCompare',
        tone: 'neutral',
        values: { best: names(best.key), bestRate: pctOf(winRate(best.matches)!), bestN: played(best.matches), worst: names(worst.key), worstRate: pctOf(winRate(worst.matches)!), worstN: played(worst.matches) },
      })
  }
  const top = decks[0]
  if (top && played(top.matches) < MIN_MATCHES) out.push({ id: 'smallSample', tone: 'neutral', values: { deck: names(top.key), n: played(top.matches), min: MIN_MATCHES } })

  const opponents = byOpponent(rows).filter((o) => played(o.matches) >= MIN_MATCHES)
  const weak = opponents.filter((o) => winRate(o.matches)! < 0.45).sort((x, y) => winRate(x.matches)! - winRate(y.matches)!)[0]
  const strong = opponents.filter((o) => winRate(o.matches)! >= 0.55).sort((x, y) => winRate(y.matches)! - winRate(x.matches)!)[0]
  if (weak) out.push({ id: 'weakMatchup', tone: 'bad', values: { deck: names(weak.key), rate: pctOf(winRate(weak.matches)!), n: played(weak.matches) } })
  if (strong) out.push({ id: 'strongMatchup', tone: 'good', values: { deck: names(strong.key), rate: pctOf(winRate(strong.matches)!), n: played(strong.matches) } })
  return out
}
