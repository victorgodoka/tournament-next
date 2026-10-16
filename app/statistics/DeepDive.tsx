'use client'

/**
 * One archetype's deep dive: the hero, turn order / siding / pace, tracked cards and staff groups.
 * Also home of the helpers MetaStatistics shares with it (formatters, bars, sortable div tables).
 */

import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { CardArt } from '@omega/card-art'
import { BarList, WinRateRing } from '@ui/chart'
import { Panel } from '@ui/panel'
import { StatGrid } from '@ui/stat-grid'
import type { CardGroup, StatArchetype, StatCard } from '@utils/statistics'

export const pct = (r: number | null | undefined) => (r == null ? '—' : (r * 100).toFixed(1) + '%')
export const num = (n: number) => n.toLocaleString('en-US')
export const nameOf = (a: { name: string | null; archetype: number[] }) => a.name ?? `Setcode ${a.archetype.join(' / ')}`
export const cardName = (c: { name: string | null; id: number }) => c.name ?? `Retired card #${c.id}`
/** A deck's face: its most included tracked card, its own signature card in practice. */
export const faceOf = (a: { cards: { id: number; name: string | null }[] }) => a.cards[0]

export const ROW = 'grid min-h-12 items-center gap-x-4 border-b border-line bg-surface-100 px-4 text-sm leading-5 text-ink-dim last:border-b-0 hover:bg-surface-300 hover:text-ink'
const HEAD = 'grid min-h-9 items-center gap-x-4 border-b border-line-mid bg-surface-200 px-4 text-ink-muted signal-sm'
export const NUM = 'text-right tabular-nums'
export const NOTE = 'text-[13px] leading-5 text-ink-muted'
/** `minmax(0, …)` everywhere, so a wide table scrolls in its box instead of stretching the column. */
export const SPLIT = 'grid grid-cols-[minmax(0,1fr)] gap-6 min-[980px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]'
export const THIRDS = 'grid grid-cols-[minmax(0,1fr)] gap-6 min-[980px]:grid-cols-3'
const CARD_COLS = 'minmax(180px, 2fr) minmax(130px, 1.3fr) repeat(4, minmax(64px, 0.7fr))'

/** 8px bar on a surface-200 track with the figure after it. */
export const Bar = ({ value, max = 1, color = 'series-1', label, w = 56 }: { value: number; max?: number; color?: string; label: React.ReactNode; w?: number }) => (
  <span className="grid items-center gap-3" style={{ gridTemplateColumns: `minmax(0, 1fr) ${w}px` }}>
    <span className="block h-2 bg-surface-200">
      <span className="block h-2 rounded-r-xs" style={{ width: `${Math.min(100, (value / (max || 1)) * 100)}%`, background: `var(--color-${color})` }} />
    </span>
    <span className="text-right font-mono text-xs text-ink tabular-nums">{label}</span>
  </span>
)

/** Square artwork crop. `card` undefined (a deck with no tracked card) keeps the slot as an empty well. */
export const Art = ({ card, size, className }: { card?: { id: number; name: string | null }; size: number; className?: string }) =>
  card ? (
    <CardArt art={card} alt="" sizes={`${size}px`} className={twMerge('flex-none border border-line', className)} />
  ) : (
    <span aria-hidden className={twMerge('flex-none border border-line bg-space-000', className)} />
  )

/** A card or deck name with its artwork in front. */
export const Named = ({ card, children }: { card?: { id: number; name: string | null }; children: React.ReactNode }) => (
  <span className="flex min-w-0 items-center gap-3">
    <Art card={card} size={32} className="size-8" />
    {children}
  </span>
)

/* ---------------------------------------------------------------- *
 * Sorting: click a header to sort, again to flip. Nulls always last.
 * ---------------------------------------------------------------- */

export type SortState<K extends string> = { key: K; desc: boolean } | null
export type Getters<R, K extends string> = Record<K, (row: R) => number | string | null | undefined>

/** Numbers start high-first, text A–Z; a second click flips. Before any click, the API's order. */
export const useSort = <K extends string>() => {
  const [sort, setSort] = useState<SortState<K>>(null)
  const toggle = (key: K, text = false) => setSort((s) => ({ key, desc: s?.key === key ? !s.desc : !text }))
  return [sort, toggle] as const
}

export const sortBy = <R, K extends string>(rows: readonly R[], sort: SortState<K>, get: Getters<R, K>): readonly R[] => {
  if (!sort) return rows
  const value = get[sort.key]
  return [...rows].sort((a, b) => {
    const x = value(a), y = value(b)
    if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1
    const c = typeof x === 'string' ? x.localeCompare(String(y)) : x - Number(y)
    return sort.desc ? -c : c
  })
}

export const ariaSort = <K extends string>(sort: SortState<K>, key: K): 'ascending' | 'descending' | 'none' =>
  sort?.key === key ? (sort.desc ? 'descending' : 'ascending') : 'none'

/** The button inside a sortable header cell; the cell itself carries `aria-sort`. */
export const SortButton = ({ label, state, onSort }: { label: string; state: 'ascending' | 'descending' | 'none'; onSort: () => void }) => (
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
export const SortHeads = <K extends string>({ labels, keys, sort, onSort, right, cols }: {
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

type CardSortKey = 'name' | 'inclusion' | 'averageCopies' | 'playRate' | 'winRateWhenUsed' | 'winRateInDeck'
const CARD_GET: Getters<StatCard, CardSortKey> = {
  name: cardName,
  inclusion: (c) => c.inclusion,
  averageCopies: (c) => c.averageCopies,
  playRate: (c) => c.playRate,
  winRateWhenUsed: (c) => c.winRateWhenUsed,
  winRateInDeck: (c) => c.winRateInDeck,
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

/** `rank` is the deck's place by deck-games. Sorting the cards table is local, so switching decks keeps it. */
export const DeepDive = ({ archetype: focus, rank }: { archetype: StatArchetype; rank: number }) => {
  const [cardSort, sortCards] = useSort<CardSortKey>()
  const nullCardRates = focus.cards.some((c) => c.winRateWhenUsed == null || c.winRateInDeck == null)

  return (
    <>
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
    </>
  )
}
