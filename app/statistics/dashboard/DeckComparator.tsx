'use client'

/**
 * Deck showdown: up to 3 archetypes side by side, read as findings (who leads, who depends on the die roll, who
 * sides best), their matchups against the top of the meta, a pick by what the reader values, and the raw figures
 * folded under "Detailed stats".
 */

import { Fragment, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { Chip } from '@ui/chip'
import { Segmented } from '@ui/choice'
import { Icon, type IconName } from '@ui/icon'
import { Panel } from '@ui/panel'
import { archKey, deckHref, intervalOf, strengthOf, type Matchup, type StatArchetype, type StatisticsScope } from '@utils/statistics'
import { Art, faceOf, nameOf, NOTE, num, pct } from '../DeepDive'
import { DeckPicker } from './controls'
import { isLoose, statusOf, TONE } from './MatchupMatrix'

const PALETTE = ['series-1', 'series-2', 'series-3'] as const
const MAX_COMPARE = 3
/** Meta decks the matchup block reads across. */
const TOP_OPPONENTS = 5

type Metric = { id: string; value: (a: StatArchetype) => number | null; format: (v: number | null) => string; better?: boolean }
const count = (v: number | null) => (v == null ? '—' : num(v))

const METRICS: Metric[] = [
  { id: 'winRate', value: (a) => a.winRate, format: pct, better: true },
  { id: 'adjusted', value: strengthOf, format: pct, better: true },
  { id: 'metaShare', value: (a) => a.metaShare, format: pct },
  { id: 'games', value: (a) => a.games, format: count },
  { id: 'players', value: (a) => a.players, format: count },
  { id: 'first', value: (a) => a.turnOrder.first.winRate, format: pct, better: true },
  { id: 'second', value: (a) => a.turnOrder.second.winRate, format: pct, better: true },
  { id: 'game1', value: (a) => a.sideboarding.game1.winRate, format: pct, better: true },
  { id: 'postSide', value: (a) => a.sideboarding.postSide.winRate, format: pct, better: true },
  { id: 'consistency', value: (a) => a.consistencyScore ?? null, format: pct, better: true },
  { id: 'mirrors', value: (a) => a.mirrorShare, format: pct },
]

/** Percentage points, one decimal; `signed` keeps the plus. */
const pp = (v: number, signed = false) => `${signed && v > 0 ? '+' : ''}${(v * 100).toFixed(1)} pp`
const margin = (a: StatArchetype) => intervalOf(a)?.margin ?? (a.winRate != null && a.wilsonLower != null ? a.winRate - a.wilsonLower : 0)
/** First minus second: how much the deck leans on the die roll. */
const swing = (a: StatArchetype) => {
  const { first, second } = a.turnOrder
  return first.winRate != null && second.winRate != null ? first.winRate - second.winRate : null
}
/** Games 2–3 minus game 1: what the side deck adds. */
const sideGain = (a: StatArchetype) => {
  const { game1, postSide } = a.sideboarding
  return game1.winRate != null && postSide.winRate != null ? postSide.winRate - game1.winRate : null
}
const maxBy = <T,>(items: T[], value: (item: T) => number | null) => {
  let best: { item: T; value: number } | null = null
  for (const item of items) {
    const v = value(item)
    if (v != null && (best === null || v > best.value)) best = { item, value: v }
  }
  return best
}

type Criterion = 'overall' | 'consistency' | 'popularity' | 'postSide'
const CRITERIA: Record<Criterion, (a: StatArchetype) => number | null> = {
  overall: strengthOf,
  consistency: (a) => { const s = swing(a); return s == null ? null : -Math.abs(s) },
  popularity: (a) => a.metaShare,
  postSide: (a) => a.sideboarding.postSide.winRate,
}

type Finding = { id: string; icon: IconName; value: string; title: string; note: string; tone?: 'win' | 'gold' }

const FindingCard = ({ icon, value, title, note, tone }: Finding) => (
  <li className="flex flex-col gap-1 border border-line bg-surface-100 p-4">
    <Icon name={icon} size={16} className="text-ink-muted" />
    <span className={twMerge('mt-1 font-mono text-xl font-bold tabular-nums', tone === 'win' ? 'text-win' : tone === 'gold' ? 'text-gold' : 'text-ink')}>{value}</span>
    <span className="text-sm font-bold text-ink">{title}</span>
    <span className={NOTE}>{note}</span>
  </li>
)

type DeckComparatorProps = {
  archetypes: StatArchetype[]
  matchups: Matchup[]
  scope: StatisticsScope
  preselected?: StatArchetype[]
  /** The PNG links for the decks picked, in the panel's actions. */
  infographic?: (keys: string[]) => ReactNode
}

export const DeckComparator = ({ archetypes, matchups, scope, preselected = [], infographic }: DeckComparatorProps) => {
  const t = useTranslations('Statistics.comparator')
  const [keys, setKeys] = useState(() => preselected.slice(0, MAX_COMPARE).map((a) => archKey(a.archetype)))
  const [criterion, setCriterion] = useState<Criterion>('overall')
  const byKey = new Map(archetypes.map((a) => [archKey(a.archetype), a]))
  const selected = keys.flatMap((k) => byKey.get(k) ?? [])
  const pair = selected.length > 1

  const bestOf = (m: Metric) => (m.better && pair ? (maxBy(selected, m.value)?.item ?? null) : null)

  // The leader is the best adjusted win rate (shrunk toward the ladder), so a handful of hot games can't take it.
  const leader = pair ? maxBy(selected, strengthOf)?.item : undefined

  const findings: Finding[] = []
  if (pair) {
    let gap: { a: StatArchetype; b: StatArchetype; value: number } | null = null
    for (const a of selected) for (const b of selected) {
      if (a === b || a.winRate == null || b.winRate == null) continue
      const value = a.winRate - b.winRate
      if (gap === null || value > gap.value) gap = { a, b, value }
    }
    if (gap) {
      const loose = gap.value <= margin(gap.a) + margin(gap.b)
      findings.push({ id: 'gap', icon: 'trophy', value: pp(gap.value, true), title: t('gap', { a: nameOf(gap.a), b: nameOf(gap.b) }), note: loose ? t('gapLoose') : t('gapNote'), tone: loose ? 'gold' : 'win' })
    }
  }
  const second = maxBy(selected, (a) => a.turnOrder.second.winRate)
  if (second) {
    const above = selected.filter((a) => (a.turnOrder.second.winRate ?? 0) > 0.5)
    findings.push({
      id: 'second',
      icon: 'sword',
      value: pct(second.value),
      title: t('second'),
      note: above.length === 1 && pair ? t('secondOnly', { name: nameOf(above[0]!) }) : t('secondBest', { name: nameOf(second.item) }),
      tone: second.value > 0.5 ? 'win' : undefined,
    })
  }
  const steadiest = maxBy(selected, (a) => { const s = swing(a); return s == null ? null : -Math.abs(s) })
  if (steadiest) findings.push({ id: 'swing', icon: 'shuffle', value: pp(-steadiest.value), title: t('swing'), note: t('swingNote', { name: nameOf(steadiest.item) }) })
  const sider = maxBy(selected, sideGain)
  if (sider && sider.value > 0) {
    const { game1, postSide } = sider.item.sideboarding
    findings.push({ id: 'side', icon: 'chart', value: pp(sider.value, true), title: t('side', { name: nameOf(sider.item) }), note: t('sideNote', { from: pct(game1.winRate), to: pct(postSide.winRate) }), tone: 'win' })
  }

  const opponents = archetypes.slice(0, TOP_OPPONENTS)
  const byPair = new Map(matchups.map((m) => [`${archKey(m.archetype)}+${archKey(m.opponent)}`, m]))
  const cellOf = (row: StatArchetype, col: StatArchetype) => byPair.get(`${archKey(row.archetype)}+${archKey(col.archetype)}`)

  const pick = pair ? maxBy(selected, CRITERIA[criterion]) : null

  return (
    <Panel title={t('title')} meta={t('meta', { count: MAX_COMPARE })} actions={infographic?.(selected.map((a) => archKey(a.archetype)))}>
      <div className="mb-6">
        <DeckPicker pool={archetypes} selected={keys} onChange={setKeys} max={MAX_COMPARE} label={t('add')} removeLabel={(name) => t('remove', { name })} />
      </div>
      {selected.length === 0 ? (
        <p className={NOTE}>{t('empty', { count: MAX_COMPARE })}</p>
      ) : (
        <div className="flex flex-col gap-8">
          {/* 1. The showdown: art, name, win rate; the leader by adjusted win rate wears the chip. */}
          <section aria-label={t('showdown')}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="text-ink-muted signal-sm">{t('showdown')}</span>
              {leader ? <Chip tone="positive">{t('leader')}</Chip> : null}
            </div>
            <ul className="grid gap-4" style={{ gridTemplateColumns: `repeat(${selected.length}, minmax(0, 1fr))` }}>
              {selected.map((a, i) => {
                const lead = a === leader
                return (
                  <li key={archKey(a.archetype)} className="flex flex-col items-center gap-2 text-center">
                    <Art card={faceOf(a)} size={112} className={twMerge('size-24 min-[720px]:size-28', lead && 'border-2 border-win')} />
                    <Link href={deckHref(a.archetype, scope)} className="flex items-center gap-1.5 text-sm font-bold text-ink hover:text-cyan">
                      <span className="size-2 flex-none" style={{ background: `var(--color-${PALETTE[i]})` }} />
                      <span className="truncate">{nameOf(a)}</span>
                    </Link>
                    <span className={twMerge('font-mono text-2xl font-bold tabular-nums', lead ? 'text-win' : 'text-ink')}>{pct(a.winRate)}</span>
                    <span className={NOTE}>{t('metrics.winRate')}{a.ci ? ` · ±${(a.ci.margin * 100).toFixed(1)}` : ''}</span>
                  </li>
                )
              })}
            </ul>
          </section>

          {/* 2. Findings: the comparisons that say something, each one a card. */}
          {findings.length ? (
            <section aria-label={t('findings')}>
              <h4 className="mb-3 text-ink display-3">{t('findings')}</h4>
              <ul className="grid gap-3 min-[720px]:grid-cols-2">
                {findings.map((f) => <FindingCard key={f.id} {...f} />)}
              </ul>
            </section>
          ) : null}

          {/* 3. Matchups against the top of the meta: the matrix's cells for these rows only. */}
          <section aria-label={t('matchups')}>
            <h4 className="mb-3 text-ink display-3">{t('matchups')}</h4>
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-px bg-line text-sm">
                <thead>
                  <tr>
                    <th scope="col" className="bg-surface-200 px-3 py-2 text-left text-ink-muted signal-sm">{t('versus')}</th>
                    {opponents.map((o) => (
                      <th key={archKey(o.archetype)} scope="col" className="bg-surface-200 px-2 py-2 font-normal">
                        <span className="flex flex-col items-center gap-1">
                          <Art card={faceOf(o)} size={28} className="size-7" />
                          <span className="max-w-24 truncate text-xs text-ink-dim">{nameOf(o)}</span>
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selected.map((a, i) => (
                    <tr key={archKey(a.archetype)}>
                      <th scope="row" className="bg-surface-100 px-3 py-2 text-left font-bold text-ink">
                        <span className="flex items-center gap-1.5"><span className="size-2 flex-none" style={{ background: `var(--color-${PALETTE[i]})` }} />{nameOf(a)}</span>
                      </th>
                      {opponents.map((o) => {
                        const cell = a === o ? undefined : cellOf(a, o)
                        const status = cell ? statusOf(cell) : 'neutral'
                        return (
                          <td key={archKey(o.archetype)} className={twMerge('px-2 py-2 text-center font-mono tabular-nums', cell ? TONE[status] : 'bg-surface-100 text-ink-muted')} title={cell ? t('cell', { games: num(cell.games) }) : undefined}>
                            {cell && cell.winRate != null ? <>{pct(cell.winRate)}{isLoose(cell) ? <i className="text-gold"> *</i> : null}</> : '—'}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className={twMerge(NOTE, 'mt-2')}>{t('matchupsNote')}</p>
          </section>

          {/* 4. Pick your deck: the reader says what counts, the ranking answers. */}
          {pair ? (
            <section aria-label={t('pickTitle')} className="border border-line bg-surface-100 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h4 className="text-ink display-3">{t('pickTitle')}</h4>
                <Segmented size="sm" label={t('pickTitle')} value={criterion} onChange={setCriterion} options={(Object.keys(CRITERIA) as Criterion[]).map((c) => ({ value: c, label: t(`criteria.${c}`) }))} />
              </div>
              {pick ? (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Art card={faceOf(pick.item)} size={40} className="size-10" />
                  <span className="flex flex-col">
                    <Link href={deckHref(pick.item.archetype, scope)} className="text-lg font-bold text-ink hover:text-cyan">{t('pick', { name: nameOf(pick.item) })}</Link>
                    <span className={NOTE}>{t(`reason.${criterion}`, { value: criterion === 'consistency' ? pp(-pick.value) : pct(pick.value) })}</span>
                  </span>
                </div>
              ) : null}
            </section>
          ) : null}

          {/* 5. The figures, folded. */}
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-ink-dim signal-sm hover:text-ink [&::-webkit-details-marker]:hidden">
              <Icon name="right" size={14} className="transition-transform group-open:rotate-90" />
              {t('details')}
            </summary>
            <div className="mt-4 overflow-x-auto">
              <div className="grid gap-px border border-line bg-line" style={{ gridTemplateColumns: `minmax(140px, 1fr) repeat(${selected.length}, minmax(140px, 1fr))` }}>
                <div className="bg-surface-200 px-3 py-2 text-ink-muted signal-sm">{t('metric')}</div>
                {selected.map((a, i) => (
                  <div key={archKey(a.archetype)} className="flex items-center gap-1.5 bg-surface-200 px-3 py-2">
                    <span className="size-2 flex-none" style={{ background: `var(--color-${PALETTE[i]})` }} />
                    <Art card={faceOf(a)} size={20} className="size-5" />
                    <span className="truncate text-sm font-semibold text-ink">{nameOf(a)}</span>
                  </div>
                ))}
                {METRICS.map((m) => {
                  const best = bestOf(m)
                  const max = Math.max(...selected.map((a) => m.value(a) ?? 0), 1e-9)
                  return (
                    <Fragment key={m.id}>
                      <div className="bg-surface-100 px-3 py-2.5 text-xs text-ink-muted">{t(`metrics.${m.id}`)}</div>
                      {selected.map((a, i) => {
                        const v = m.value(a)
                        const isBest = best === a
                        return (
                          <div key={archKey(a.archetype)} className={twMerge('flex flex-col gap-1 bg-surface-100 px-3 py-2.5', isBest && 'bg-ground-win')}>
                            <span className={twMerge('text-sm font-bold tabular-nums', isBest ? 'text-win' : 'text-ink')}>
                              {m.format(v)}
                              {isBest ? <Icon name="star" size={12} label={t('best')} className="ml-1 inline align-[-1px] text-gold" /> : null}
                            </span>
                            {v != null ? (
                              <div className="h-1 bg-surface-300">
                                <div className="h-1" style={{ width: `${Math.min(100, (v / max) * 100)}%`, background: `var(--color-${PALETTE[i]})` }} />
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </Fragment>
                  )
                })}
              </div>
            </div>
          </details>
        </div>
      )}
    </Panel>
  )
}
