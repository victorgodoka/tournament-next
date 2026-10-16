'use client'

/**
 * The public meta report, ported from the Omega Hub canvas
 * (https://claude.ai/artifact/74YyyyuWBQUfZuduKW2BtE, "Statistics page" and "Statistics states")
 * and wired to GET /statistics. Ladder and season live in the URL; everything else is view state.
 */

import { Fragment, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@iconify/react'
import { twMerge } from 'tailwind-merge'
import { CardArt } from '@omega/card-art'
import { Button } from '@ui/button'
import { BarList, LineChart, WinRateRing } from '@ui/chart'
import { Chip } from '@ui/chip'
import { Segmented } from '@ui/choice'
import { DataTable, type Column } from '@ui/data-table'
import { Select } from '@ui/field'
import { ModeTabs } from '@ui/mode-tabs'
import { Notice } from '@ui/notice'
import { PageHeader } from '@ui/page-header'
import { Panel } from '@ui/panel'
import { RailHead } from '@ui/rail-head'
import { StatGrid } from '@ui/stat-grid'
import { TabBar } from '@ui/tab-bar'
import {
  archKey,
  type CardGroup,
  type HandTrap,
  type StatArchetype,
  type StatCard,
  type Statistics,
  type StatisticsResult,
  type Staple,
  type TurnSplit,
} from '@utils/statistics'
import type { PastSeason, RankedLadderId } from '@utils/types'

const FORMAT: Record<RankedLadderId, string> = { tcg: 'TCG', genesys: 'Genesys' }
/** Rows the archetype table shows before "Show all". */
const FOLD = 12
const TREND_DECKS = 5
const PICKS = 8
const PALETTE = [1, 2, 3, 4, 5, 6].map((n) => `var(--color-series-${n})`)

const pct = (r: number | null | undefined) => (r == null ? '—' : (r * 100).toFixed(1) + '%')
const num = (n: number) => n.toLocaleString('en-US')
const nameOf = (a: { name: string | null; archetype: number[] }) => a.name ?? `Setcode ${a.archetype.join(' / ')}`
const cardName = (c: { name: string | null; id: number }) => c.name ?? `Retired card #${c.id}`
/** "14 Aug" of a `YYYY-MM-DD` or ISO date, `plus` days later. UTC, so server and client agree. */
const day = (iso: string, plus = 0) => {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso)
  d.setUTCDate(d.getUTCDate() + plus)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}
/** The 95% Wilson interval reaches more than 1.2 points under the rate. */
const isSmall = (a: { winRate: number | null; wilsonLower: number | null }) =>
  a.winRate != null && a.wilsonLower != null && a.winRate - a.wilsonLower > 0.012

const ROW = 'grid min-h-12 items-center gap-x-4 border-b border-line bg-surface-100 px-4 text-sm leading-5 text-ink-dim last:border-b-0 hover:bg-surface-300 hover:text-ink'
const HEAD = 'grid min-h-9 items-center gap-x-4 border-b border-line-mid bg-surface-200 px-4 text-ink-muted signal-sm'
const NUM = 'text-right tabular-nums'
const NOTE = 'text-[13px] leading-5 text-ink-muted'
/** `minmax(0, …)` everywhere, so a wide table scrolls in its box instead of stretching the column. */
const SPLIT = 'grid grid-cols-[minmax(0,1fr)] gap-6 min-[980px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]'
const THIRDS = 'grid grid-cols-[minmax(0,1fr)] gap-6 min-[980px]:grid-cols-3'

const Section = ({ num: n, label, stamp, id, children }: { num: string; label: string; stamp?: React.ReactNode; id?: string; children: React.ReactNode }) => (
  <section id={id} aria-label={label} className="mt-12 flex scroll-mt-24 flex-col gap-6 min-[720px]:mt-16">
    {/* The stamp is provenance, not content: it gives way on a phone. */}
    <RailHead num={n} label={label} stamp={stamp ? <span className="max-[720px]:hidden">{stamp}</span> : undefined} as="h2" className="px-0" />
    {children}
  </section>
)

/** 8px bar on a surface-200 track with the figure after it. */
const Bar = ({ value, max = 1, color = 'series-1', label, w = 56 }: { value: number; max?: number; color?: string; label: React.ReactNode; w?: number }) => (
  <span className="grid items-center gap-3" style={{ gridTemplateColumns: `minmax(0, 1fr) ${w}px` }}>
    <span className="block h-2 bg-surface-200">
      <span className="block h-2 rounded-r-xs" style={{ width: `${Math.min(100, (value / (max || 1)) * 100)}%`, background: `var(--color-${color})` }} />
    </span>
    <span className="text-right font-mono text-xs text-ink tabular-nums">{label}</span>
  </span>
)

/** Square artwork crop. `card` undefined (a deck with no tracked card) keeps the slot as an empty well. */
const Art = ({ card, size, className }: { card?: { id: number; name: string | null }; size: number; className?: string }) =>
  card ? (
    <CardArt art={card} alt="" sizes={`${size}px`} className={twMerge('flex-none border border-line', className)} />
  ) : (
    <span aria-hidden className={twMerge('flex-none border border-line bg-space-000', className)} />
  )

/** A card or deck name with its artwork in front. */
const Named = ({ card, children }: { card?: { id: number; name: string | null }; children: React.ReactNode }) => (
  <span className="flex min-w-0 items-center gap-3">
    <Art card={card} size={32} className="size-8" />
    {children}
  </span>
)

/* ---------------------------------------------------------------- *
 * Sorting: click a header to sort, again to flip. Nulls always last.
 * ---------------------------------------------------------------- */

type SortState<K extends string> = { key: K; desc: boolean } | null
type Getters<R, K extends string> = Record<K, (row: R) => number | string | null | undefined>

/** Numbers start high-first, text A–Z; a second click flips. Before any click, the API's order. */
const useSort = <K extends string>() => {
  const [sort, setSort] = useState<SortState<K>>(null)
  const toggle = (key: K, text = false) => setSort((s) => ({ key, desc: s?.key === key ? !s.desc : !text }))
  return [sort, toggle] as const
}

const sortBy = <R, K extends string>(rows: readonly R[], sort: SortState<K>, get: Getters<R, K>): readonly R[] => {
  if (!sort) return rows
  const value = get[sort.key]
  return [...rows].sort((a, b) => {
    const x = value(a), y = value(b)
    if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1
    const c = typeof x === 'string' ? x.localeCompare(String(y)) : x - Number(y)
    return sort.desc ? -c : c
  })
}

const ariaSort = <K extends string>(sort: SortState<K>, key: K): 'ascending' | 'descending' | 'none' =>
  sort?.key === key ? (sort.desc ? 'descending' : 'ascending') : 'none'

/** The button inside a sortable header cell; the cell itself carries `aria-sort`. */
const SortButton = ({ label, state, onSort }: { label: string; state: 'ascending' | 'descending' | 'none'; onSort: () => void }) => (
  <button
    type="button"
    onClick={onSort}
    className={twMerge('group/sort inline-flex cursor-pointer items-center gap-1 uppercase hover:text-ink focus-visible:outline-2 focus-visible:outline-cyan', state !== 'none' && 'text-ink')}
  >
    {label}
    <span aria-hidden className={twMerge('w-2 text-[8px]', state === 'none' && 'opacity-0 group-hover/sort:opacity-60')}>
      {state === 'ascending' ? '▲' : '▼'}
    </span>
  </button>
)

/** Header row of the div tables: a plain label where `keys[i]` is null, a sort button elsewhere. `name` sorts as text. */
const SortHeads = <K extends string>({ labels, keys, sort, onSort, right, cols }: {
  labels: string[]
  keys: (K | null)[]
  sort: SortState<K>
  onSort: (key: K, text?: boolean) => void
  /** Right-aligned (number) columns. */
  right: (i: number) => boolean
  cols: string
}) => (
  <div role="row" className={HEAD} style={{ gridTemplateColumns: cols }}>
    {labels.map((label, i) => {
      const key = keys[i]
      return (
        <span key={label} role="columnheader" aria-sort={key ? ariaSort(sort, key) : undefined} className={right(i) ? NUM : undefined}>
          {key ? <SortButton label={label} state={ariaSort(sort, key)} onSort={() => onSort(key, key === 'name')} /> : label}
        </span>
      )
    })}
  </div>
)

type ArchSortKey = 'name' | 'metaShare' | 'winRate' | 'games' | 'players' | 'mirrorShare'
const ARCH_GET: Getters<StatArchetype, ArchSortKey> = {
  name: nameOf,
  metaShare: (a) => a.metaShare,
  winRate: (a) => a.winRate,
  games: (a) => a.games,
  players: (a) => a.players,
  mirrorShare: (a) => a.mirrorShare,
}

type CardSortKey = 'name' | 'inclusion' | 'averageCopies' | 'playRate' | 'winRateWhenUsed' | 'winRateInDeck'
const CARD_GET: Getters<StatCard, CardSortKey> = {
  name: cardName,
  inclusion: (c) => c.inclusion,
  averageCopies: (c) => c.averageCopies,
  playRate: (c) => c.playRate,
  winRateWhenUsed: (c) => c.winRateWhenUsed,
  winRateInDeck: (c) => c.winRateInDeck,
}

type TrapSortKey = 'name' | 'inclusion' | 'activations' | 'respondedRate' | 'calledRate' | 'crossoutRate' | 'ashedOrPurgedRate' | 'winRateWhenUsed'
const TRAP_GET: Getters<HandTrap, TrapSortKey> = {
  name: cardName,
  inclusion: (t) => t.inclusion,
  activations: (t) => t.activations,
  respondedRate: (t) => t.respondedRate,
  calledRate: (t) => t.calledRate,
  crossoutRate: (t) => t.crossoutRate,
  ashedOrPurgedRate: (t) => t.ashedOrPurgedRate,
  winRateWhenUsed: (t) => t.whenUsed?.winRate ?? null,
}

type StapleSortKey = 'name' | 'inclusion' | 'archetypes' | 'playRate' | 'winRateWhenUsed'
type StapleRow = Staple & { rank: number }
const STAPLE_GET: Getters<StapleRow, StapleSortKey> = {
  name: cardName,
  inclusion: (s) => s.inclusion,
  archetypes: (s) => s.archetypes,
  playRate: (s) => s.playRate,
  winRateWhenUsed: (s) => s.winRateWhenUsed,
}

/** A deck's face: its most included tracked card, its own signature card in practice. */
const faceOf = (a: { cards: { id: number; name: string | null }[] }) => a.cards[0]

/* ---------------------------------------------------------------- *
 * Page shell: header, ladder and season, then the report or a state
 * ---------------------------------------------------------------- */

type MetaStatisticsProps = { ladder: RankedLadderId; season?: string; past: PastSeason[]; result: StatisticsResult }

export const MetaStatistics = ({ ladder, season, past, result }: MetaStatisticsProps) => {
  const router = useRouter()
  const [pending, start] = useTransition()
  const go = (l: RankedLadderId, s?: string) =>
    start(() => router.push(`/statistics?${new URLSearchParams(s ? { ladder: l, season: s } : { ladder: l })}`, { scroll: false }))
  const data = result.ok ? result.data : null
  const format = FORMAT[ladder]
  const days = data?.syncedDays

  return (
    <div aria-busy={pending} className={twMerge('transition-opacity', pending && 'opacity-60')}>
      <PageHeader
        eyebrow="Meta report"
        eyebrowMeta={data ? `${format} · ${data.season.label}` : format}
        title="Meta statistics"
        lead="Archetype shares, win rates, trends and card choices from every ranked duel of the season. The numbers refresh once a day, after the nightly sweep."
      />

      <div className="mt-8 flex flex-wrap items-end justify-between gap-6">
        <ModeTabs
          label="Ladder"
          items={[{ id: 'tcg', label: 'TCG' }, { id: 'genesys', label: 'Genesys' }] as const}
          value={ladder}
          onChange={(l) => go(l)}
        />
        <div className="flex flex-wrap items-end gap-4">
          {days ? (
            <div className="flex flex-col items-end gap-2">
              {days.first && days.last ? (
                <span className="text-ink-muted signal-sm">
                  Synced {day(days.first)} – {day(days.last)} · {days.count} days
                </span>
              ) : null}
              <div className="flex gap-2">
                <Chip>Ranked duels only</Chip>
                <Chip>Cached 5 min</Chip>
              </div>
            </div>
          ) : null}
          <Select
            label="Season"
            value={season ?? ''}
            onChange={(e) => go(ladder, e.target.value || undefined)}
            options={[
              { value: '', label: !season && data ? `${data.season.label} · open` : 'Open season' },
              ...past.map((s) => ({ value: s.code, label: s.label })),
            ]}
          />
        </div>
      </div>

      {data ? <Report data={data} /> : <Failure status={result.ok ? 0 : result.status} format={format} season={season} past={past} onPast={(code) => go(ladder, code)} onRetry={() => start(() => router.refresh())} />}
    </div>
  )
}

const Failure = ({ status, format, season, past, onPast, onRetry }: { status: number; format: string; season?: string; past: PastSeason[]; onPast: (code: string) => void; onRetry: () => void }) => {
  const latest = past[0]
  if (status === 404)
    return (
      <Panel title={season ? 'Season not found' : 'No open season'} meta="404 · NOT_FOUND" className="mt-12">
        <div className="flex flex-col items-start gap-4">
          <p className="text-ink-dim body">
            {season ? `There is no ${format} season "${season}".` : `The ${format} ladder has no open season right now.`}
            {latest ? ' Pick a past season to see its numbers.' : ''}
          </p>
          {latest ? <Button size="sm" variant="secondary" onClick={() => onPast(latest.code)}>View {latest.label}</Button> : null}
        </div>
      </Panel>
    )
  return (
    <Panel title={status === 429 ? 'Too many requests' : "Couldn't read the statistics"} meta={status === 429 ? '429 · 60 a minute' : status ? `${status}` : 'Offline'} className="mt-12">
      <div className="flex flex-col items-start gap-4">
        <p className="text-ink-dim body">
          {status === 429
            ? 'Statistics take 60 requests a minute from one connection. Try again in a minute.'
            : "The game server didn't answer. Try again in a moment."}
        </p>
        <Button size="sm" variant="secondary" onClick={onRetry}>Retry</Button>
      </div>
    </Panel>
  )
}

/* ---------------------------------------------------------------- *
 * The report
 * ---------------------------------------------------------------- */

const TurnBlock = ({ title, meta, split }: { title: string; meta: string; split: TurnSplit }) => {
  const f = split.first.winRate, s = split.second.winRate
  const share = f != null && s != null && f + s > 0 ? (f / (f + s)) * 100 : 50
  return (
    <Panel title={title} meta={meta}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="font-display text-[40px] leading-none text-ink">{pct(f)}</span>
          <span className="text-ink-muted signal">Going first</span>
        </div>
        <div className="flex h-2 gap-0.5" aria-hidden>
          <span className="block h-2 rounded-l-xs bg-series-1" style={{ width: `${share}%` }} />
          <span className="block h-2 flex-1 rounded-r-xs bg-series-3" />
        </div>
        <div className="flex justify-between gap-3 text-[13px] leading-5 text-ink-dim">
          <span className="flex items-center gap-2"><span className="size-2 bg-series-1" />First {pct(f)}</span>
          <span className="flex items-center gap-2"><span className="size-2 bg-series-3" />Second {pct(s)}</span>
        </div>
        <div className="flex justify-between gap-3 border-t border-line pt-3">
          <span className="text-[13px] leading-5 font-bold text-ink">
            {f != null && s != null ? `${f >= s ? '+' : '−'}${Math.abs((f - s) * 100).toFixed(1)} pts going first` : 'No rated games'}
          </span>
          <span className="text-ink-muted signal-sm">{num(split.first.games)} games a side</span>
        </div>
      </div>
    </Panel>
  )
}

const Groups = ({ title, items, color }: { title: string; items: CardGroup[]; color: string }) => (
  <Panel title={title} meta="Staff groups">
    {items.length ? (
      <div className="flex flex-col gap-3.5">
        {items.map((e) => {
          const head = (
            <>
              <div className="flex justify-between gap-3 text-[13px] leading-5">
                <span className="font-bold text-ink">{e.name}</span>
                <span className="font-mono text-xs text-ink-dim">{pct(e.winRate)} WR</span>
              </div>
              <Bar value={e.inclusion} color={color} label={pct(e.inclusion)} w={52} />
            </>
          )
          if (!e.cards?.length) return <div key={e.id} className="flex flex-col gap-1.5">{head}</div>
          return (
            <details key={e.id} className="group">
              <summary className="flex cursor-pointer list-none flex-col gap-1.5 [&::-webkit-details-marker]:hidden">
                {head}
                <span className="font-mono text-[10px] tracking-[0.08em] text-ink-muted uppercase">
                  <span className="group-open:hidden">▸</span><span className="hidden group-open:inline">▾</span> {e.cards.length} {e.cards.length === 1 ? 'card' : 'cards'}
                </span>
              </summary>
              <div className="mt-3 flex flex-col border-l border-line-mid pl-3">
                {e.cards.map((c) => (
                  <div key={c.id} className="flex flex-col gap-1.5 border-b border-line py-2.5 last:border-b-0">
                    <Named card={c}>
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span title={cardName(c)} className="truncate text-[13px] leading-5 font-bold text-ink">{cardName(c)}</span>
                        <Bar value={c.inclusion} color={color} label={pct(c.inclusion)} w={52} />
                      </span>
                    </Named>
                    <dl className="grid grid-cols-4 gap-2 pl-11">
                      {[
                        ['Copies', c.averageCopies.toFixed(2)],
                        ['Played', pct(c.playRate)],
                        ['WR used', pct(c.winRateWhenUsed)],
                        ['WR deck', pct(c.winRateInDeck)],
                      ].map(([label, value]) => (
                        <div key={label} className="flex flex-col">
                          <dt className="text-ink-muted signal-sm">{label}</dt>
                          <dd className="font-mono text-xs text-ink tabular-nums">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </div>
            </details>
          )
        })}
      </div>
    ) : (
      <p className={NOTE}>None of this deck&apos;s games ran one.</p>
    )}
  </Panel>
)

/** `#` stays the API's rank by inclusion whatever the sort, so a sorted row still says where it stands. */
const stapleCols = (sort: SortState<StapleSortKey>, onSort: (key: StapleSortKey, text?: boolean) => void): Column<StapleRow>[] => {
  const head = (key: StapleSortKey, label: string) => ({
    key,
    sort: ariaSort(sort, key),
    label: <SortButton label={label} state={ariaSort(sort, key)} onSort={() => onSort(key, key === 'name')} />,
  })
  return [
    { key: 'rank', label: '#', numeric: true, width: 40 },
    { ...head('name', 'Card'), strong: true, render: (s) => <Named card={s}><span className="truncate">{cardName(s)}</span></Named> },
    { ...head('inclusion', 'Inclusion'), numeric: true, render: (s) => pct(s.inclusion) },
    { ...head('archetypes', 'Archetypes'), numeric: true, render: (s) => num(s.archetypes) },
    { ...head('playRate', 'Play rate'), numeric: true, render: (s) => pct(s.playRate) },
    { ...head('winRateWhenUsed', 'WR when used'), numeric: true, strong: true, render: (s) => pct(s.winRateWhenUsed) },
  ]
}

const ARCH_COLS = '32px minmax(240px, 1.6fr) minmax(180px, 1.5fr) repeat(4, minmax(80px, 0.75fr))'
const CARD_COLS = 'minmax(180px, 2fr) minmax(130px, 1.3fr) repeat(4, minmax(64px, 0.7fr))'
const TRAP_COLS = 'minmax(190px, 2fr) repeat(7, minmax(72px, 0.8fr))'

const Report = ({ data }: { data: Statistics }) => {
  const [showAll, setShowAll] = useState(false)
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [metric, setMetric] = useState<'share' | 'wr'>('share')
  const [trapId, setTrapId] = useState<number | null>(null)
  const [archSort, sortArch] = useSort<ArchSortKey>()
  const [cardSort, sortCards] = useSort<CardSortKey>()
  const [stapleSort, sortStaples] = useSort<StapleSortKey>()
  const [trapSort, sortTraps] = useSort<TrapSortKey>()

  const { season, totals, turnOrder, archetypes: arch, minSamples } = data
  const pctAxis = (v: number) => (v * 100).toFixed(1) + '%'

  const glance = (
    <Section num="01" label="Season at a glance" stamp={`${data.syncedDays.count} days synced`}>
      <StatGrid
        columns={5}
        items={[
          { label: 'Deck-games', value: num(totals.games), hint: 'Each game counted once a side' },
          { label: 'Matches', value: num(totals.matches), hint: 'Ranked' },
          { label: 'Unique Duelists', value: num(totals.players), hint: 'Accounts that played ranked' },
          { label: 'Archetypes', value: num(totals.archetypes), hint: `With ${minSamples}+ deck-games` },
          { label: 'Going first', value: pct(turnOrder.all.first.winRate), hint: 'Win rate, whole server' },
        ]}
      />
    </Section>
  )

  const closed = season.endsAt ? (
    <div className="cut notch mt-6 flex items-center gap-3 px-5 py-4 [--cut:var(--cut-md)] [--edge:var(--color-line-mid)] [--fill:var(--color-surface-100)]">
      <span className="size-2 flex-none bg-gold" />
      <span className="text-ink-dim body">{season.label} is closed. These are its final numbers.</span>
    </div>
  ) : null

  if (!arch.length)
    return (
      <>
        {closed}
        {glance}
        <Panel title="No games yet" meta="Nothing swept" className="mt-6">
          <p className="text-ink-dim body">
            No archetype has {minSamples} ranked deck-games in this season yet. The first numbers appear after tonight&apos;s sweep.
          </p>
        </Panel>
      </>
    )

  /* 03 · archetypes */
  const maxShare = arch[0]?.metaShare || 1
  /* Sorted across all listed decks first, then folded: "best win rate" means of all of them. */
  const rankOf = new Map(arch.map((a, i) => [a, i + 1]))
  /* The table lists pure archetypes; a mixed deck shows under each of its setcodes' rows. */
  const pure = arch.filter((a) => a.archetype.length === 1)
  const pureRank = new Map(pure.map((a, i) => [a, i + 1]))
  const sortedArch = sortBy(pure, archSort, ARCH_GET)
  const rows = showAll ? sortedArch : sortedArch.slice(0, FOLD)
  const pick = (key: string) => {
    setFocusKey(key)
    document.getElementById('deep-dive')?.scrollIntoView({ behavior: 'smooth' })
  }
  /** A pure deck's mixes in the list: `[451]` → `[451, 207]`, `[90, 451]`. A mixed deck has none. */
  const combosOf = (a: StatArchetype) =>
    a.archetype.length === 1 ? arch.filter((b) => b.archetype.length > 1 && b.archetype.includes(a.archetype[0]!)) : []
  /** `combos` > 0: the name opens the mixes under the row; otherwise it goes to the deep dive. */
  const archRow = (a: StatArchetype, nested: boolean, combos = 0, open = false) => {
    const key = archKey(a.archetype)
    const rank = rankOf.get(a) ?? 0
    return (
      <div key={key} role="row" className={twMerge(ROW, nested && 'bg-surface-200')} style={{ gridTemplateColumns: ARCH_COLS }}>
        <span role="cell" className={twMerge(NUM, 'font-mono text-xs text-ink-muted')}>{pureRank.get(a)}</span>
        <span role="cell" className={twMerge('flex min-w-0 items-center gap-2.5', nested && 'pl-5')}>
          <span className="size-2 flex-none" style={{ background: rank <= TREND_DECKS ? PALETTE[rank - 1] : 'var(--color-line-mid)' }} />
          <Art card={faceOf(a)} size={32} className="size-8" />
          <button
            type="button"
            onClick={() => (combos ? setOpenKey(open ? null : key) : pick(key))}
            aria-expanded={combos ? open : undefined}
            title={combos ? `Show the decks mixed with ${nameOf(a)}` : 'Open in the deep dive'}
            className="flex min-w-0 cursor-pointer items-center gap-2 font-bold text-ink hover:text-cyan"
          >
            <span className="truncate">{nameOf(a)}</span>
            {combos ? (
              <span className="flex-none font-mono text-[10px] font-normal tracking-[0.08em] text-ink-muted uppercase">
                {open ? '▾' : '▸'} {combos} mixed
              </span>
            ) : null}
          </button>
          {isSmall(a) ? <span title="Small sample" className="flex-none text-gold"><Icon icon="fa7-solid:warning" role="img" aria-label="Small sample" /></span> : null}
        </span>
        <span role="cell"><Bar value={a.metaShare} max={maxShare} label={pct(a.metaShare)} /></span>
        <span role="cell" className={twMerge(NUM, 'font-bold text-ink')}>{pct(a.winRate)}</span>
        <span role="cell" className={NUM}>{num(a.games)}</span>
        <span role="cell" className={NUM}>{num(a.players)}</span>
        <span role="cell" className={NUM}>{pct(a.mirrorShare)}</span>
      </div>
    )
  }

  /* share vs win rate scatter */
  const wrs = arch.flatMap((a) => (a.winRate == null ? [] : [a.winRate]))
  const yMin = Math.min(0.49, Math.floor((Math.min(...wrs, 0.5) - 0.01) * 100) / 100)
  const yMax = Math.max(0.51, Math.ceil((Math.max(...wrs, 0.5) + 0.01) * 100) / 100)
  const xMax = Math.ceil(maxShare * 100 + 1) / 100
  const yPos = (v: number) => ((v - yMin) / (yMax - yMin)) * 100
  const tick = (v: number) => pct(v).replace('.0%', '%')

  const byKey = new Map(arch.map((a) => [archKey(a.archetype), a]))

  /* 04 · trends: a day without a win rate repeats the last known one */
  const trends = data.trends.slice(0, TREND_DECKS)
  const trendLabels = (trends[0]?.points ?? []).map(([d]) => day(season.startsAt, d - 1))
  const trendSeries = trends.map((t) => {
    let last = byKey.get(archKey(t.archetype))?.winRate ?? 0.5
    return { name: nameOf(t), data: t.points.map(([, share, wr]) => (metric === 'share' ? share : (last = wr ?? last))) }
  })

  /* 05 · deep dive */
  const focus = (focusKey && byKey.get(focusKey)) || arch[0]!
  const fKey = archKey(focus.archetype)
  const picks = arch.slice(0, PICKS).some((a) => archKey(a.archetype) === fKey) ? arch.slice(0, PICKS) : [...arch.slice(0, PICKS), focus]
  const rank = arch.indexOf(focus) + 1
  const nullCardRates = focus.cards.some((c) => c.winRateWhenUsed == null || c.winRateInDeck == null)

  /* 07 · hand traps */
  const traps = data.handTraps
  const trap = traps.find((t) => t.id === trapId) ?? traps[0]
  const maxHit = trap?.targets[0]?.activations || 1

  return (
    <>
      {closed}
      {glance}

      <Section num="02" label="Turn order" stamp="Whole server · mirrors and unknown decks in">
        <div className={THIRDS}>
          <TurnBlock title="All games" meta="Mirrors in" split={turnOrder.all} />
          <TurnBlock title="Game 1" meta="Before siding" split={turnOrder.game1} />
          <TurnBlock title="Games 2–3" meta="After siding" split={turnOrder.postSide} />
        </div>
      </Section>

      <Section num="03" label="Archetypes" stamp={`${pure.length} archetypes + ${arch.length - pure.length} mixes of the top ${arch.length} · by deck-games`}>
        <div className="overflow-x-auto">
          <div role="table" aria-label="Archetypes by deck-games" className="min-w-240 border border-line">
            <SortHeads
              cols={ARCH_COLS}
              labels={['#', 'Archetype', 'Meta share', 'Win rate', 'Deck-games', 'Unique Duelists', 'Mirrors']}
              keys={[null, 'name', 'metaShare', 'winRate', 'games', 'players', 'mirrorShare']}
              sort={archSort}
              onSort={sortArch}
              right={(i) => i === 0 || i > 2}
            />
            {rows.map((a) => {
              const key = archKey(a.archetype)
              const combos = combosOf(a)
              const open = openKey === key && combos.length > 0
              return (
                <Fragment key={key}>
                  {archRow(a, false, combos.length, open)}
                  {open ? (
                    <>
                      {sortBy(combos, archSort, ARCH_GET).map((b) => archRow(b, true))}
                      <div role="row" className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line bg-surface-200 py-2 pr-4 pl-15">
                        <span role="cell" className={NOTE}>
                          Mixed decks with {nameOf(a)} in the list. Each is its own archetype: its games are not in {nameOf(a)}&apos;s row.
                        </span>
                        <span role="cell"><Button size="sm" variant="secondary" onClick={() => pick(key)}>Deep dive {nameOf(a)}</Button></span>
                      </div>
                    </>
                  ) : null}
                </Fragment>
              )
            })}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className={NOTE}>Win rate leaves mirrors out. <Icon icon="fa7-solid:warning" aria-hidden className="inline align-[-2px] text-gold" /> Small sample: the 95% Wilson interval reaches more than 1.2 points below the rate.</span>
          {pure.length > FOLD ? (
            <Button size="sm" variant="secondary" onClick={() => setShowAll(!showAll)}>
              {showAll ? `Show top ${FOLD}` : `Show all ${pure.length}`}
            </Button>
          ) : null}
        </div>

        <div className={SPLIT}>
          <Panel title="Share vs win rate" meta="Mirrors out">
            <div className="grid grid-cols-[44px_minmax(0,1fr)] grid-rows-[320px_28px]">
              <div aria-hidden className="relative font-mono text-[10px] leading-3 tracking-[0.08em] text-ink-muted">
                <span className="absolute top-0 right-2">{tick(yMax)}</span>
                <span className="absolute right-2 translate-y-1/2" style={{ bottom: `${yPos(0.5)}%` }}>50%</span>
                <span className="absolute right-2 bottom-0">{tick(yMin)}</span>
              </div>
              <div role="img" aria-label={`Scatter of meta share against win rate for ${arch.length} archetypes`} className="relative border-b border-l border-line-mid bg-space-000">
                <span className="absolute inset-x-0 border-t border-dashed border-line-mid" style={{ bottom: `${yPos(0.5)}%` }} />
                {arch.map((a, k) =>
                  a.winRate == null ? null : (
                    <span
                      key={archKey(a.archetype)}
                      title={`${nameOf(a)} · ${pct(a.metaShare)} share · ${pct(a.winRate)} win rate · ${num(a.wins + a.losses + a.draws)} rated games`}
                      className="absolute size-0"
                      style={{ left: `${(a.metaShare / xMax) * 100}%`, bottom: `${yPos(a.winRate)}%` }}
                    >
                      <span className={twMerge('absolute -top-1.5 -left-1.5 size-3 rounded-round border-2 border-series-1', isSmall(a) ? 'bg-surface-100' : 'bg-series-1')} />
                      {k < 7 ? <span className="absolute -top-2 left-3 text-xs leading-4 font-semibold whitespace-nowrap text-ink-dim">{nameOf(a)}</span> : null}
                    </span>
                  ),
                )}
              </div>
              <span />
              <div aria-hidden className="flex items-end justify-between font-mono text-[10px] leading-3 tracking-[0.08em] text-ink-muted">
                <span>0%</span>
                <span>Meta share</span>
                <span>{tick(xMax)}</span>
              </div>
            </div>
            <p className={twMerge(NOTE, 'mt-4')}>Hollow dots are small samples. Above the dashed line the deck wins more than it loses.</p>
          </Panel>
          <BarList
            title="Unique Duelists"
            subtitle="Players per deck"
            items={[...arch].sort((a, b) => b.players - a.players).slice(0, 8).map((a) => ({ label: nameOf(a), value: a.players }))}
            format={num}
          />
        </div>
      </Section>

      {trendLabels.length ? (
        <Section num="04" label="Season trends" stamp={`Day 1 = ${day(season.startsAt)}`}>
          <TabBar
            label="Trend metric"
            fit
            tabs={[{ id: 'share', label: 'Meta share' }, { id: 'wr', label: 'Win rate' }] as const}
            active={metric}
            onSelect={setMetric}
          />
          <LineChart
            title={metric === 'share' ? 'Meta share by day' : 'Win rate by day'}
            subtitle={`Top ${trends.length} decks · one point per day`}
            labels={trendLabels}
            series={trendSeries}
            format={pctAxis}
            height={280}
            area={metric === 'share'}
          />
        </Section>
      ) : null}

      <Section num="05" id="deep-dive" label="Archetype deep dive" stamp="Mirrors out · up to 15 tracked cards">
        <Segmented
          label="Archetype"
          options={picks.map((a) => ({ value: archKey(a.archetype), label: nameOf(a) }))}
          value={fKey}
          onChange={setFocusKey}
        />

        <Panel tone="steel" title={nameOf(focus)} meta={`#${rank} by deck-games · ${num(focus.players)} unique duelists`}>
          <div className="flex flex-wrap items-center gap-8">
            <Art card={faceOf(focus)} size={148} className="size-37 max-[720px]:hidden" />
            <div className="min-w-0 flex-[999_1_560px]">
              <StatGrid
                columns={4}
                items={[
                  { label: 'Meta share', value: pct(focus.metaShare), hint: `${num(focus.games)} deck-games` },
                  { label: 'Win rate', value: pct(focus.winRate), hint: `Wilson low ${pct(focus.wilsonLower)}` },
                  { label: 'Mirrors', value: pct(focus.mirrorShare), hint: 'Out of the win rate' },
                  { label: 'Unique Duelists', value: num(focus.players), hint: `${(focus.games / (focus.players || 1)).toFixed(1)} games each` },
                ]}
              />
            </div>
            <div className="flex flex-[1_1_160px] justify-center">
              <WinRateRing wins={focus.wins} losses={focus.losses} draws={focus.draws} size={148} />
            </div>
          </div>
        </Panel>

        <div className={THIRDS}>
          <BarList
            title="Turn order"
            subtitle={`${num(focus.turnOrder.first.games)} / ${num(focus.turnOrder.second.games)} games`}
            items={[
              { label: 'Going first', value: focus.turnOrder.first.winRate ?? 0 },
              { label: 'Going second', value: focus.turnOrder.second.winRate ?? 0, color: 'series-3' },
            ]}
            format={pct}
            max={1}
          />
          <BarList
            title="Siding"
            subtitle={`${num(focus.sideboarding.game1.games)} / ${num(focus.sideboarding.postSide.games)} games`}
            items={[
              { label: 'Game 1', value: focus.sideboarding.game1.winRate ?? 0 },
              { label: 'Games 2–3', value: focus.sideboarding.postSide.winRate ?? 0, color: 'series-3' },
            ]}
            format={pct}
            max={1}
          />
          <StatGrid
            columns={2}
            items={[
              { label: 'Turns a game', value: focus.pace.averageTurns.toFixed(2) },
              { label: 'Actions a turn', value: focus.pace.actionsPerTurn.toFixed(1) },
              { label: 'Turn 1 summons', value: focus.pace.turn1SpecialSummons.toFixed(1), hint: 'Special Summons going first' },
              { label: 'Longest chain', value: focus.pace.averageLongestChain.toFixed(2), hint: 'Average per game' },
            ]}
          />
        </div>

        <div className={SPLIT}>
          <Panel title="Cards" meta="By inclusion">
            <div className="overflow-x-auto">
              <div role="table" aria-label="Tracked cards" className="min-w-160 border border-line">
                <SortHeads
                  cols={CARD_COLS}
                  labels={['Card', 'Inclusion', 'Copies', 'Played', 'WR used', 'WR in deck']}
                  keys={['name', 'inclusion', 'averageCopies', 'playRate', 'winRateWhenUsed', 'winRateInDeck']}
                  sort={cardSort}
                  onSort={sortCards}
                  right={(i) => i > 1}
                />
                {sortBy(focus.cards, cardSort, CARD_GET).map((c) => (
                  <div key={c.id} role="row" className={ROW} style={{ gridTemplateColumns: CARD_COLS }}>
                    <span role="cell"><Named card={c}><span title={cardName(c)} className="truncate font-bold text-ink">{cardName(c)}</span></Named></span>
                    <span role="cell"><Bar value={c.inclusion} label={pct(c.inclusion)} w={52} /></span>
                    <span role="cell" className={NUM}>{c.averageCopies.toFixed(2)}</span>
                    <span role="cell" className={NUM}>{pct(c.playRate)}</span>
                    <span role="cell" className={twMerge(NUM, 'font-bold text-ink')}>{pct(c.winRateWhenUsed)}</span>
                    <span role="cell" className={NUM}>{pct(c.winRateInDeck)}</span>
                  </div>
                ))}
              </div>
            </div>
            <p className={twMerge(NOTE, 'mt-4')}>
              Played: games where the card was used, out of games with it in the deck. In deck counts main and Extra, plus side cards the log proves were used.
              {nullCardRates ? ' A dash is not enough data: part of this season was recorded by an older server.' : ''}
            </p>
          </Panel>
          <div className="flex flex-col gap-6">
            <Groups title="Engines" items={focus.engines} color="series-3" />
            <Groups title="Techs" items={focus.techs} color="series-4" />
          </div>
        </div>
      </Section>

      <Section num="06" label="Staples" stamp="Cards in 2+ archetypes · all deck-games">
        <div className="overflow-x-auto">
          <DataTable
            caption="By inclusion over every deck-game"
            className="min-w-160"
            columns={stapleCols(stapleSort, sortStaples)}
            rows={[...sortBy(data.staples.map((s, k) => ({ ...s, rank: k + 1 })), stapleSort, STAPLE_GET)]}
            rowKey={(s) => s.id}
            empty="No generic card is in two archetypes yet."
          />
        </div>
      </Section>

      {trap ? (
        <Section num="07" label="Hand traps" stamp="Most activated first">
          <div className={SPLIT}>
            <div className="overflow-x-auto">
              <div role="table" aria-label="Hand traps" className="min-w-210 border border-line">
                <SortHeads
                  cols={TRAP_COLS}
                  labels={['Hand trap', 'In deck', 'Activations', 'Answered', 'Called', 'Crossout', "Ash'd or Purged", 'Win when used']}
                  keys={['name', 'inclusion', 'activations', 'respondedRate', 'calledRate', 'crossoutRate', 'ashedOrPurgedRate', 'winRateWhenUsed']}
                  sort={trapSort}
                  onSort={sortTraps}
                  right={(i) => i > 0}
                />
                {sortBy(traps, trapSort, TRAP_GET).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={t === trap}
                    onClick={() => setTrapId(t.id)}
                    className={twMerge(ROW, 'w-full cursor-pointer text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-cyan aria-pressed:bg-ground-cyan aria-pressed:text-ink aria-pressed:shadow-selected')}
                    style={{ gridTemplateColumns: TRAP_COLS }}
                  >
                    <Named card={t}><span className="truncate font-bold text-ink">{cardName(t)}</span></Named>
                    <span className={NUM}>{pct(t.inclusion)}</span>
                    <span className={twMerge(NUM, 'font-bold text-ink')}>{num(t.activations)}</span>
                    <span className={NUM}>{pct(t.respondedRate)}</span>
                    <span className={NUM}>{pct(t.calledRate)}</span>
                    <span className={NUM}>{pct(t.crossoutRate)}</span>
                    <span className={NUM}>{pct(t.ashedOrPurgedRate)}</span>
                    <span className={NUM}>{pct(t.whenUsed?.winRate)}</span>
                  </button>
                ))}
              </div>
            </div>
            <Panel title={cardName(trap)} meta={`${num(trap.activations)} activations`}>
              <Art card={trap} size={400} className="mb-5 aspect-[2/1] w-full [&_img]:object-[center_30%]" />
              <span className="mb-4 block text-ink-muted signal">Most hit decks</span>
              {trap.targets.length ? (
                <div className="flex flex-col gap-3.5">
                  {trap.targets.map((g) => (
                    <div key={archKey(g.archetype)} className="flex flex-col gap-1.5">
                      <div className="flex justify-between gap-3 text-[13px] leading-5">
                        <span className="font-bold text-ink">{nameOf(g)}</span>
                        <span className="font-mono text-xs text-ink-dim">
                          {pct(g.respondedRate)} answered · {pct(g.whenUsed?.winRate)} won
                        </span>
                      </div>
                      <Bar value={g.activations} max={maxHit} label={num(g.activations)} w={60} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className={NOTE}>Not activated against a listed deck yet.</p>
              )}
              <p className={twMerge(NOTE, 'mt-4')}>Answered: activations that got a chain response. Called, Crossout and Ash&apos;d or Purged (Ash Blossom or Dominus Purge): share of those answers. Win when used / won: games where it was activated at least once, from the side that used it; against a deck, that matchup. Listed decks only.</p>
            </Panel>
          </div>
        </Section>
      ) : null}

      <section aria-label="Method" className="mt-12 min-[720px]:mt-16">
        <Notice title="How it's counted" date={data.syncedDays.last ? day(data.syncedDays.last) : undefined} mark>
          Every game counts once per deck, so one Bo3 adds up to six deck-games. Win rates leave mirrors and unfinished games out; meta share keeps them in.
          The lists only hold decks with {minSamples} or more deck-games, so their shares don&apos;t add up to 100%.
        </Notice>
      </section>
    </>
  )
}
