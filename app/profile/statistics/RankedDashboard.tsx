'use client'

/**
 * One duelist's ranked dashboard: how they are doing (KPIs, Elo, last results), with which decks, against
 * which decks, the recent matches and the analysis lines. Everything but turn order is cut from
 * `record.timeline` by the period and the picked deck; turn order is the whole selection.
 */

import { useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { Avatar } from '@ui/avatar'
import { LineChart, WinRateRing } from '@ui/chart'
import { Icon } from '@ui/icon'
import { ModeTabs } from '@ui/mode-tabs'
import { Panel } from '@ui/panel'
import { ResultPill } from '@ui/result'
import { TierBadge } from '@ui/tier-badge'
import { Art, faceOf, NOTE, num, NUM, pct, ROW, SortHeads, sortBy, useSort, type Getters } from '@app/statistics/DeepDive'
import { archKey, type PlayerStatisticsData, type Tally3, type TimelineRow, type TurnSplit } from '@utils/statistics'
import type { EloPoint, Match, Tier } from '@utils/types'
import {
  byDeck, byOpponent, byPair, eloChange, gameTally, inPeriod, insights, matchTally, MIN_MATCHES, pairKey, played,
  previousPeriod, streaks, winRate, type Period, type Split,
} from './insights'

/** Own chunk, fetched on the first open, like the profile's match history. */
const MatchAnalytics = dynamic(() => import('@omega/analytics/match-analytics').then((m) => m.MatchAnalytics))

export type LadderStanding = { elo: number; tier: Tier; rank: number | null; eloHistory?: EloPoint[] }

type Props = {
  data: PlayerStatisticsData
  standing: LadderStanding | null
  /** The profile's first page of ranked matches, already the selection's format. */
  matches: Match[]
  profileId: string
}

const LAST = 10
const MATRIX_ROWS = 5
const MATRIX_COLS = 6
/** Under this many matches a cell is drawn but not colored. */
const CELL_MIN = 5
/** `start`: since the season began (the whole selection); 14 and 30 only once the season is that long. */
const PERIODS = [
  { id: 'start', days: null },
  { id: '7', days: 7 },
  { id: '14', days: 14 },
  { id: '30', days: 30 },
] as const
const DAY_MS = 86_400_000

const tone = (rate: number | null, n: number) =>
  rate === null || n < CELL_MIN ? 'bg-surface-100 text-ink-muted' : rate >= 0.55 ? 'bg-win/20 text-win' : rate < 0.45 ? 'bg-loss/20 text-loss' : 'bg-surface-200 text-ink-dim'

const Delta = ({ value, unit }: { value: number | null; unit: string }) =>
  value === null ? null : (
    <span className={twMerge('font-mono text-xs', value > 0 ? 'text-win' : value < 0 ? 'text-loss' : 'text-ink-muted')}>
      {value > 0 ? '▲ +' : value < 0 ? '▼ ' : ''}
      {value.toFixed(unit === 'pts' ? 1 : 0)}
      {unit === '%' ? '%' : unit === 'pts' ? ' pts' : ''}
    </span>
  )

const Kpi = ({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) => (
  <Panel title={title} className={twMerge('min-w-0', className)}>{children}</Panel>
)

const DECK_COLS = 'minmax(200px, 2fr) minmax(80px, 0.6fr) minmax(150px, 1.2fr) minmax(90px, 0.8fr) minmax(80px, 0.6fr)'
type DeckSort = 'name' | 'matches' | 'rate' | 'games'

export const RankedDashboard = ({ data, standing, matches, profileId }: Props) => {
  const t = useTranslations('PlayerStatistics')
  const locale = useLocale()
  const [periodId, setPeriodId] = useState<(typeof PERIODS)[number]['id']>('start')
  const [deck, setDeck] = useState<string | null>(null)
  const [sort, onSort] = useSort<DeckSort>()
  // The render's clock, read once: the periods count back from it.
  const [now] = useState(() => Date.now())

  // A season shorter than a window makes that window the same as "since the start": not offered. Every
  // season (no `season`) offers them all.
  const seasonDays = data.season ? (now - Date.parse(data.season.startsAt)) / DAY_MS : Infinity
  const periods = PERIODS.filter((p) => p.days === null || p.days === 7 || p.days < seasonDays)
  const days: Period = periods.find((p) => p.id === periodId)?.days ?? null
  const timeline = data.record.timeline ?? []
  const names = (key: string) => data.record.deckNames?.[key] ?? `Setcode ${key.split('+').join(' / ')}`
  const artOf = new Map(data.archetypes.map((a) => [archKey(a.archetype), faceOf(a)]))
  const art = (key: string) => artOf.get(key.split('+').join('-'))

  const rows = inPeriod(timeline, days, now)
  const before = previousPeriod(timeline, days, now)
  const focus = deck ? rows.filter((r) => r[2] === deck) : rows
  const tally = matchTally(rows)
  const prior = before ? matchTally(before) : null
  const rate = winRate(tally)
  const priorRate = prior ? winRate(prior) : null
  const streak = streaks(timeline)
  const elo = standing ? eloChange(standing.eloHistory, standing.elo, days, now) : null
  const decks = byDeck(rows)
  const best = decks.filter((d) => played(d.matches) >= MIN_MATCHES).sort((a, b) => winRate(b.matches)! - winRate(a.matches)!)[0]

  if (!data.record.timeline)
    return <p className={twMerge(NOTE, 'mt-6')}>{t('oldApi')}</p>

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ModeTabs
          label={t('period.label')}
          items={periods.map((p) => ({ id: p.id, label: p.id === 'start' && !data.season ? t('period.all') : t(`period.${p.id}`) }))}
          value={periodId}
          onChange={setPeriodId}
        />
        <span className="text-ink-muted signal-sm">{t('analyzed', { analyzed: num(data.matches.analyzed), total: num(data.matches.total) })}</span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 min-[720px]:grid-cols-2 min-[1200px]:grid-cols-3">
        <Kpi title={t('kpi.rank')}>
          {standing ? (
            <div className="flex flex-col gap-2">
              <TierBadge tier={standing.tier} size="lg" />
              <span className="font-display text-[32px] leading-none text-ink tabular-nums">{num(standing.elo)}</span>
              <span className="text-ink-muted signal-sm">{standing.rank ? t('kpi.rankPlace', { rank: num(standing.rank) }) : t('kpi.unranked')}</span>
              <span className="flex items-center gap-2 text-ink-muted signal-sm">{t('kpi.eloChange')} <Delta value={elo} unit="" />{elo === null ? '—' : null}</span>
            </div>
          ) : (
            <p className={NOTE}>{t('kpi.noStanding')}</p>
          )}
        </Kpi>
        <Kpi title={t('kpi.winRate')}>
          <div className="flex items-center gap-4">
            <WinRateRing wins={tally.wins} losses={tally.losses} draws={tally.draws} size={92} />
            <div className="flex flex-col gap-1">
              <span className="font-mono text-sm text-ink">{t('kpi.ofMatches', { wins: tally.wins, total: played(tally) })}</span>
              <Delta value={rate !== null && priorRate !== null ? (rate - priorRate) * 100 : null} unit="pts" />
              {prior ? <span className="text-ink-muted signal-sm">{t('kpi.vsPrevious')}</span> : null}
            </div>
          </div>
        </Kpi>
        <Kpi title={t('kpi.matches')}>
          <div className="flex flex-col gap-1">
            <span className="font-display text-[32px] leading-none text-ink tabular-nums">{num(rows.length)}</span>
            <span className="text-ink-muted signal-sm">{t('kpi.games', { count: num(played(gameTally(rows))) })}</span>
            {prior && played(prior) ? <Delta value={((played(tally) - played(prior)) / played(prior)) * 100} unit="%" /> : null}
            {prior ? <span className="text-ink-muted signal-sm">{t('kpi.vsPrevious')}</span> : null}
          </div>
        </Kpi>
        <Kpi title={t('kpi.record')}>
          <dl className="grid grid-cols-3 gap-2 text-center">
            {([['wins', 'text-win'], ['losses', 'text-loss'], ['draws', 'text-ink-dim']] as const).map(([k, color]) => (
              <div key={k} className="flex flex-col gap-0.5">
                <dt className={twMerge('signal-sm', color)}>{t(`kpi.${k}`)}</dt>
                <dd className="font-display text-2xl leading-none text-ink tabular-nums">{num(tally[k])}</dd>
                <dd className="font-mono text-[11px] text-ink-muted">{pct(played(tally) ? tally[k] / played(tally) : null)}</dd>
              </div>
            ))}
          </dl>
        </Kpi>
        <Kpi title={t('kpi.streak')}>
          {streak.current ? (
            <div className="flex flex-col gap-1">
              <span className={twMerge('font-display text-[32px] leading-none tabular-nums', streak.current.result === 'W' ? 'text-win' : streak.current.result === 'L' ? 'text-loss' : 'text-ink')}>
                {streak.current.count}
              </span>
              <span className="text-ink-dim signal-sm">{t(`kpi.streakOf.${streak.current.result}`, { count: streak.current.count })}</span>
              <span className="text-ink-muted signal-sm">{t('kpi.bestStreak', { count: streak.bestWins })}</span>
            </div>
          ) : (
            <p className={NOTE}>{t('kpi.noMatches')}</p>
          )}
        </Kpi>
        <Kpi title={t('kpi.gameRate')}>
          {(() => {
            const games = gameTally(rows)
            return (
              <div className="flex flex-col gap-1">
                <span className="font-display text-[32px] leading-none text-ink tabular-nums">{pct(winRate(games))}</span>
                <span className="text-ink-muted signal-sm">{t('kpi.ofGames', { wins: games.wins, total: played(games) })}</span>
              </div>
            )
          })()}
        </Kpi>
      </div>

      {/* Elo: a row of its own */}
      <Panel title={t('elo.title')} meta={standing?.eloHistory?.length ? t('elo.meta') : undefined}>
          {standing?.eloHistory?.length ? (
            (() => {
              const points = days === null ? standing.eloHistory : standing.eloHistory.filter((p) => Date.parse(`${p.day}T00:00:00Z`) >= now - days * 86_400_000)
              const shown = points.length >= 2 ? points : standing.eloHistory.slice(-2)
              const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
              return (
                <LineChart
                  labels={[...shown.map((p) => day(p.day)), t('elo.now')]}
                  series={[{ name: 'Elo', data: [...shown.map((p) => p.elo), standing.elo] }]}
                  format={(v) => num(Math.round(v))}
                  height={240}
                  directLabels={false}
                  className="border-0 bg-transparent p-0"
                />
              )
            })()
          ) : (
            <p className={NOTE}>{t('elo.none')}</p>
          )}
      </Panel>

      {/* Decks, then matchups: a row each */}
      <Panel title={t('decks.title')} meta={deck ? t('decks.filtered', { name: names(deck) }) : t('decks.meta')}>
          {decks.length ? (
            <>
              <div className="overflow-x-auto">
                <div role="table" aria-label={t('decks.title')} className="min-w-[620px] border border-line">
                  <SortHeads
                    cols={DECK_COLS}
                    labels={[t('decks.cols.deck'), t('decks.cols.matches'), t('decks.cols.rate'), t('decks.cols.games'), t('decks.cols.share')]}
                    keys={['name', 'matches', 'rate', 'games', null]}
                    sort={sort}
                    onSort={onSort}
                    right={(i) => i > 0}
                  />
                  {sortBy(decks, sort, {
                    name: (d) => names(d.key),
                    matches: (d) => played(d.matches),
                    rate: (d) => winRate(d.matches),
                    games: (d) => winRate(d.games),
                  } satisfies Getters<Split, DeckSort>).map((d) => {
                    const r = winRate(d.matches)
                    const small = played(d.matches) < MIN_MATCHES
                    return (
                      <button
                        key={d.key}
                        type="button"
                        aria-pressed={deck === d.key}
                        onClick={() => setDeck(deck === d.key ? null : d.key)}
                        className={twMerge(ROW, 'w-full cursor-pointer text-left aria-pressed:bg-ground-cyan aria-pressed:text-ink aria-pressed:shadow-selected')}
                        style={{ gridTemplateColumns: DECK_COLS }}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <Art card={art(d.key)} size={28} className="size-7" />
                          <span className="truncate font-bold text-ink">{names(d.key)}</span>
                          {d === decks[0] ? <span className="shrink-0 font-mono text-[9px] text-cyan uppercase">{t('decks.mostPlayed')}</span> : null}
                          {d === best ? <span className="shrink-0 font-mono text-[9px] text-gold uppercase">{t('decks.best')}</span> : null}
                        </span>
                        <span className={NUM}>{num(played(d.matches))}</span>
                        <span className="grid grid-cols-[minmax(0,1fr)_56px] items-center gap-2">
                          <span className="relative block h-2 bg-surface-200">
                            <span className={twMerge('block h-2', small ? 'bg-ink-muted' : r !== null && r >= 0.5 ? 'bg-win' : 'bg-loss')} style={{ width: `${(r ?? 0) * 100}%` }} />
                          </span>
                          <span className={twMerge(NUM, 'font-mono text-xs', small ? 'text-ink-muted italic' : 'text-ink')}>{pct(r)}</span>
                        </span>
                        <span className={twMerge(NUM, 'text-xs')}>{pct(winRate(d.games))}</span>
                        <span className={twMerge(NUM, 'text-xs')}>{pct(rows.length ? played(d.matches) / rows.length : null)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
              <p className={twMerge(NOTE, 'mt-3')}>{t('decks.note', { min: MIN_MATCHES })}</p>
            </>
          ) : (
            <p className={NOTE}>{t('kpi.noMatches')}</p>
          )}
      </Panel>
      <PersonalMatrix rows={focus} names={names} art={art} />

      {/* Recent matches (with the last results on top) and the analysis */}
      <div className="grid grid-cols-1 gap-4 min-[1200px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <RecentMatches matches={deck ? matches.filter((m) => m.self.deck === names(deck)) : matches} last={timeline.slice(0, LAST)} names={names} profileId={profileId} />
        <Panel title={t('analysis.title')} meta={t('analysis.meta')}>
          {(() => {
            const lines = insights({ rows, previous: before, elo, names })
            return lines.length ? (
              <ul className="flex flex-col gap-2">
                {lines.map((line) => (
                  <li key={line.id} className="flex items-start gap-2.5 border border-line bg-surface-200 p-2.5 text-[13px] leading-5 text-ink-dim">
                    <span className={twMerge('mt-0.5 grid size-5 shrink-0 place-items-center', line.tone === 'good' ? 'bg-win/15 text-win' : line.tone === 'bad' ? 'bg-loss/15 text-loss' : 'bg-surface-300 text-ink-muted')}>
                      <Icon name={line.tone === 'good' ? 'chart' : line.tone === 'bad' ? 'down' : 'info'} size={12} />
                    </span>
                    {t(`analysis.lines.${line.id}`, line.values)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={NOTE}>{t('analysis.none', { min: MIN_MATCHES })}</p>
            )
          })()}
        </Panel>
      </div>

      <TurnOrder split={data.turnOrder} />
    </div>
  )
}

/** Their decks (rows) against the decks they faced most (columns), "others" the rest. */
const PersonalMatrix = ({ rows, names, art }: { rows: TimelineRow[]; names: (key: string) => string; art: (key: string) => { id: number; name: string | null } | undefined }) => {
  const t = useTranslations('PlayerStatistics.matrix')
  const mine = byDeck(rows).slice(0, MATRIX_ROWS)
  const opponents = byOpponent(rows)
  const cols = opponents.slice(0, MATRIX_COLS)
  const shown = new Set(cols.map((c) => c.key))
  const pairs = new Map(byPair(rows).map((p) => [p.key, p.matches]))
  const others = (deck: string) =>
    matchTally(rows.filter((r) => r[2] === deck && r[3] !== null && !shown.has(r[3])))
  const cell = (key: string, m: Tally3 | undefined) => {
    const n = m ? played(m) : 0
    const r = m ? winRate(m) : null
    return (
      <td key={key} title={t('cell', { n })} className={twMerge('h-10 min-w-14 border border-space-000 text-center text-[12px] tabular-nums', tone(r, n), n > 0 && n < CELL_MIN && 'italic')}>
        {n ? `${Math.round((r ?? 0) * 100)}%` : '—'}
      </td>
    )
  }
  return (
    <Panel title={t('title')} meta={t('meta')}>
      {mine.length && cols.length ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <caption className="sr-only">{t('caption')}</caption>
              <thead>
                <tr>
                  <th className="sticky left-0 bg-surface-100 px-2 pb-2 text-left signal-sm text-ink-muted">{t('corner')}</th>
                  {cols.map((c) => (
                    <th key={c.key} scope="col" title={names(c.key)} className="px-0.5 pb-2 align-bottom">
                      <span className="flex flex-col items-center gap-1">
                        <Art card={art(c.key)} size={24} className="size-6" />
                        <span className="block max-w-14 truncate text-[10px] font-normal text-ink-muted">{names(c.key)}</span>
                      </span>
                    </th>
                  ))}
                  <th scope="col" className="px-0.5 pb-2 align-bottom text-[10px] font-normal text-ink-muted">{t('others')}</th>
                </tr>
              </thead>
              <tbody>
                {mine.map((d) => (
                  <tr key={d.key}>
                    <th scope="row" className="sticky left-0 bg-surface-100 px-2 text-left">
                      <span className="flex w-36 items-center gap-2 text-sm font-semibold text-ink">
                        <Art card={art(d.key)} size={22} className="size-5.5" />
                        <span className="truncate">{names(d.key)}</span>
                      </span>
                    </th>
                    {cols.map((c) => cell(c.key, pairs.get(pairKey(d.key, c.key))))}
                    {cell('others', others(d.key))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-[12px] text-ink-muted">
            <span className="flex items-center gap-1.5"><span className="inline-block size-3 border border-win/30 bg-win/20" />{t('favorable')}</span>
            <span className="flex items-center gap-1.5"><span className="inline-block size-3 border border-line bg-surface-200" />{t('even')}</span>
            <span className="flex items-center gap-1.5"><span className="inline-block size-3 border border-loss/30 bg-loss/20" />{t('unfavorable')}</span>
            <span><i>{t('looseMark')}</i>{t('loose', { min: CELL_MIN })}</span>
          </div>
        </>
      ) : (
        <p className={NOTE}>{t('empty')}</p>
      )}
    </Panel>
  )
}

/** The profile's latest ranked matches; a row opens the duel's timeline and stats, as on the profile. */
const RecentMatches = ({ matches, last, names, profileId }: { matches: Match[]; last: TimelineRow[]; names: (key: string) => string; profileId: string }) => {
  const t = useTranslations('PlayerStatistics.recent')
  const locale = useLocale()
  const [open, setOpen] = useState<string | null>(null)
  return (
    <Panel title={t('title')} meta={t('meta')}>
      {/* The last results, newest first, as a strip of squares: the form at a glance. */}
      {last.length ? (
        <ol aria-label={t('last', { count: last.length })} className="mb-3 flex flex-wrap gap-1">
          {last.map((r, i) => (
            <li
              key={i}
              title={[r[2] ? names(r[2]) : null, r[0] ? new Date(r[0]).toLocaleDateString(locale, { day: '2-digit', month: '2-digit' }) : null].filter(Boolean).join(' · ')}
            >
              <ResultPill result={r[1] ?? 'D'} />
            </li>
          ))}
        </ol>
      ) : null}
      {matches.length ? (
        <div className="flex flex-col border border-line">
          {matches.slice(0, 8).map((m) => {
            const result = m.win === null ? 'D' : m.win ? 'W' : 'L'
            const isOpen = open === m.id
            return (
              <div key={m.id} className="border-b border-line last:border-b-0">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : m.id)}
                  className="grid w-full cursor-pointer grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_64px_92px] items-center gap-3 bg-surface-100 px-3 py-2 text-left text-sm text-ink-dim hover:bg-surface-300 disabled:cursor-default"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Avatar name={m.opponent.name || t('unknown')} src={m.opponent.avatar} cosmetics={m.opponent.cosmetics} size="sm" />
                    <span className="truncate font-semibold text-ink">{m.opponent.name || t('unknown')}</span>
                  </span>
                  <span className="truncate text-xs">{m.self.deck ?? '—'}</span>
                  <span className="flex items-center gap-1.5">
                    <ResultPill result={result} />
                    <span className="font-mono text-xs text-ink">{m.score.self}–{m.score.opponent}</span>
                  </span>
                  <span className="text-right font-mono text-[11px] text-ink-muted">
                    {m.when ? new Date(m.when).toLocaleString(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </span>
                </button>
                {isOpen ? (
                  <div className="border-t border-line px-4 py-5">
                    <MatchAnalytics matchId={m.id} opponentId={m.opponent.id} />
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : (
        <p className={NOTE}>{t('empty')}</p>
      )}
      <Link href={`/profile/${profileId}#matches`} className="mt-3 inline-flex text-[13px] text-azure-lift hover:text-ink">{t('all')}</Link>
    </Panel>
  )
}

/** First / second, game 1 and after siding: the whole selection, not the period (no per-match turn data). */
const TurnOrder = ({ split }: { split: PlayerStatisticsData['turnOrder'] }) => {
  const t = useTranslations('PlayerStatistics.turn')
  const rows: [string, TurnSplit][] = [[t('all'), split.all], [t('game1'), split.game1], [t('postSide'), split.postSide]]
  return (
    <Panel title={t('title')} meta={t('meta')}>
      <div className="grid grid-cols-1 gap-4 min-[720px]:grid-cols-3">
        {rows.map(([label, s]) => (
          <div key={label} className="flex flex-col gap-1.5 border border-line bg-surface-200 p-3">
            <span className="font-bold text-ink text-[13px]">{label}</span>
            <span className="flex justify-between font-mono text-xs text-ink-dim">
              <span>{t('first')} {pct(s.first.winRate)}</span>
              <span className="text-ink-muted">{t('games', { count: num(s.first.games) })}</span>
            </span>
            <span className="flex justify-between font-mono text-xs text-ink-dim">
              <span>{t('second')} {pct(s.second.winRate)}</span>
              <span className="text-ink-muted">{t('games', { count: num(s.second.games) })}</span>
            </span>
          </div>
        ))}
      </div>
    </Panel>
  )
}
