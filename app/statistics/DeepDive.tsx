'use client'

/**
 * The tables of a deck's page (tracked cards, engines and techs, what it faced) and the helpers the statistics
 * pages share (formatters, bars, sortable div tables).
 */

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { CardArt } from '@omega/card-art'
import type { AgainstCard, CardGroup, StatCard } from '@utils/statistics'

export const pct = (r: number | null | undefined) => (r == null ? '—' : (r * 100).toFixed(1) + '%')
export const fixed = (n: number | null, digits: number) => (n == null ? '—' : n.toFixed(digits))
export const hhmm = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
export const num =(n: number) => n.toLocaleString('en-US')
export const nameOf = (a: { name: string | null; archetype: number[] }) => a.name ?? `Setcode ${a.archetype.join(' / ')}`
export const cardName = (c: { name: string | null; id: number }) => c.name ?? `#${c.id}`
/** A deck's face: its own (archetype / Series) most included card from the API, else its most included card. */
export const faceOf = (a: { cards: { id: number; name: string | null }[]; face?: { id: number; name: string | null } }) => a.face ?? a.cards[0]

export const ROW = 'grid min-h-12 items-center gap-x-4 border-b border-line bg-surface-100 px-4 text-sm leading-5 text-ink-dim last:border-b-0 hover:bg-surface-300 hover:text-ink'
const HEAD = 'grid min-h-9 items-center gap-x-4 border-b border-line-mid bg-surface-200 px-4 text-ink-muted signal-sm'
export const NUM = 'text-right tabular-nums'
export const NOTE = 'text-[13px] leading-5 text-ink-muted'
/** `minmax(0, …)` everywhere, so a wide table scrolls in its box instead of stretching the column. */
export const SPLIT = 'grid grid-cols-[minmax(0,1fr)] gap-6 min-[980px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]'
const CARD_COLS = 'minmax(180px, 2fr) minmax(130px, 1.3fr) repeat(5, minmax(64px, 0.7fr))'

/** 8px bar on a surface-200 track with the figure after it. `mark`: a tick on the track at that value (0.5 = even). */
export const Bar = ({ value, max = 1, color = 'series-1', label, w = 56, mark }: { value: number; max?: number; color?: string; label: React.ReactNode; w?: number; mark?: number }) => (
  <span className="grid items-center gap-3" style={{ gridTemplateColumns: `minmax(0, 1fr) ${w}px` }}>
    <span className="relative block h-2 bg-surface-200">
      <span className="block h-2 rounded-r-xs" style={{ width: `${Math.min(100, (value / (max || 1)) * 100)}%`, background: `var(--color-${color})` }} />
      {mark != null ? <span aria-hidden className="absolute -top-1 h-4 w-px bg-ink-muted" style={{ left: `${(mark / (max || 1)) * 100}%` }} /> : null}
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
const Named = ({ card, children }: { card?: { id: number; name: string | null }; children: React.ReactNode }) => (
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
export const SortHeads = <K extends string>({ labels, keys, sort, onSort, right, cols, sticky }: {
  labels: string[]
  keys: (K | null)[]
  sort: SortState<K>
  onSort: (key: K, text?: boolean) => void
  /** Right-aligned (number) columns. */
  right: (i: number) => boolean
  cols: string
  /** Stays on top while its box scrolls (the box needs a max height and `overflow-auto`). */
  sticky?: boolean
}) => (
  <div role="row" className={twMerge(HEAD, sticky && 'sticky top-0 z-10')} style={{ gridTemplateColumns: cols }}>
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

type CardSortKey = 'name' | 'inclusion' | 'sideRate' | 'averageCopies' | 'playRate' | 'winRateWhenUsed' | 'winRateInDeck'
const CARD_GET: Getters<StatCard, CardSortKey> = {
  name: cardName,
  inclusion: (c) => c.inclusion,
  sideRate: (c) => c.sideRate,
  averageCopies: (c) => c.averageCopies,
  playRate: (c) => c.playRate,
  winRateWhenUsed: (c) => c.winRateWhenUsed,
  winRateInDeck: (c) => c.winRateInDeck,
}

/** `hrefOf`: each name links to the card's page. */
export const CardsTable = ({ cards, label, hrefOf }: { cards: StatCard[]; label: string; hrefOf: (id: number) => string }) => {
  const t = useTranslations('Statistics.deepDive')
  const [sort, onSort] = useSort<CardSortKey>()
  return (
    <div className="overflow-x-auto">
      <div role="table" aria-label={label} className="min-w-160 border border-line">
        <SortHeads
          cols={CARD_COLS}
          labels={[t('cols.card'), t('cols.inclusion'), t('cols.side'), t('cols.copies'), t('cols.played'), t('cols.wrUsed'), t('cols.wrInDeck')]}
          keys={['name', 'inclusion', 'sideRate', 'averageCopies', 'playRate', 'winRateWhenUsed', 'winRateInDeck']}
          sort={sort}
          onSort={onSort}
          right={(i) => i > 1}
        />
        {sortBy(cards, sort, CARD_GET).map((c) => (
          <div key={c.id} role="row" className={ROW} style={{ gridTemplateColumns: CARD_COLS }}>
            <span role="cell"><Named card={c}><Link href={hrefOf(c.id)} title={cardName(c)} className="truncate font-bold text-ink hover:text-cyan">{cardName(c)}</Link></Named></span>
            <span role="cell"><Bar value={c.inclusion} label={pct(c.inclusion)} w={52} /></span>
            <span role="cell" className={NUM}>{pct(c.sideRate)}</span>
            <span role="cell" className={NUM}>{c.averageCopies.toFixed(2)}</span>
            <span role="cell" className={NUM}>{pct(c.playRate)}</span>
            <span role="cell" className={twMerge(NUM, 'font-bold text-ink')}>{pct(c.winRateWhenUsed)}</span>
            <span role="cell" className={NUM}>{pct(c.winRateInDeck)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const GROUP_COLS = '24px minmax(200px, 2fr) minmax(90px, 0.7fr) minmax(140px, 1.2fr) minmax(80px, 0.7fr) minmax(70px, 0.5fr)'

/** Engines and techs in one table; a row with cards opens them under it. */
export const GroupsTable = ({ engines, techs, hrefOf }: { engines: CardGroup[]; techs: CardGroup[]; hrefOf: (id: number) => string }) => {
  const t = useTranslations('Statistics.deepDive')
  const [open, setOpen] = useState<string | null>(null)
  const rows = [...engines.map((g) => ({ ...g, kind: 'engine' as const })), ...techs.map((g) => ({ ...g, kind: 'tech' as const }))]
  if (!rows.length) return <p className={NOTE}>{t('noGroups')}</p>
  return (
    <div className="overflow-x-auto">
      <div role="table" aria-label={t('tabs.groups')} className="min-w-160 border border-line">
        <div role="row" className="grid min-h-9 items-center gap-x-4 border-b border-line-mid bg-surface-200 px-4 text-ink-muted signal-sm" style={{ gridTemplateColumns: GROUP_COLS }}>
          <span />
          <span>{t('cols.group')}</span>
          <span>{t('cols.kind')}</span>
          <span className={NUM}>{t('cols.inclusion')}</span>
          <span className={NUM}>{t('cols.winRate')}</span>
          <span className={NUM}>{t('cols.cards')}</span>
        </div>
        {rows.map((g) => {
          const id = `${g.kind}-${g.id}`
          const expandable = !!g.cards?.length
          const isOpen = open === id
          const color = g.kind === 'engine' ? 'series-3' : 'series-4'
          const cells = (
            <>
              <span aria-hidden className="text-ink-muted">{expandable ? (isOpen ? '▾' : '▸') : ''}</span>
              <span className="truncate font-bold text-ink">{g.name}</span>
              <span className="font-mono text-[11px] text-ink-muted">{t(`kind.${g.kind}`)}</span>
              <Bar value={g.inclusion} color={color} label={pct(g.inclusion)} w={52} />
              <span className={twMerge(NUM, 'font-bold text-ink')}>{pct(g.winRate)}</span>
              <span className={NUM}>{g.cards?.length ?? '—'}</span>
            </>
          )
          return (
            <div key={id}>
              {expandable ? (
                <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : id)} className={twMerge(ROW, 'w-full cursor-pointer text-left')} style={{ gridTemplateColumns: GROUP_COLS }}>
                  {cells}
                </button>
              ) : (
                <div role="row" className={ROW} style={{ gridTemplateColumns: GROUP_COLS }}>{cells}</div>
              )}
              {isOpen && g.cards ? (
                <div className="border-b border-line bg-space-000 p-3">
                  <CardsTable cards={g.cards} label={g.name} hrefOf={hrefOf} />
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const AGAINST_COLS = 'minmax(220px, 2fr) minmax(140px, 1.2fr) minmax(90px, 0.8fr) minmax(90px, 0.8fr)'
type AgainstSort = 'name' | 'games' | 'winRate'
const AGAINST_GET: Getters<AgainstCard, AgainstSort> = {
  name: cardName,
  games: (c) => c.games,
  winRate: (c) => c.winRate,
}

/** Generic cards the opponent used against the deck, hand traps tagged: how often it faced each, and how it did then. */
export const AgainstTable = ({ cards }: { cards?: AgainstCard[] | null }) => {
  const t = useTranslations('Statistics.deepDive')
  const [sort, onSort] = useSort<AgainstSort>()
  if (!cards) return <p className={NOTE}>{t('againstMissing')}</p>
  if (!cards.length) return <p className={NOTE}>{t('againstEmpty')}</p>
  const max = Math.max(...cards.map((c) => c.rate ?? 0), 0.01)
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <div role="table" aria-label={t('tabs.against')} className="min-w-160 border border-line">
          <SortHeads
            cols={AGAINST_COLS}
            labels={[t('cols.card'), t('cols.faced'), t('cols.games'), t('cols.deckWinRate')]}
            keys={['name', 'games', null, 'winRate']}
            sort={sort}
            onSort={onSort}
            right={(i) => i > 1}
          />
          {sortBy(cards, sort, AGAINST_GET).map((c) => (
            <div key={c.id} role="row" className={ROW} style={{ gridTemplateColumns: AGAINST_COLS }}>
              <span role="cell">
                <Named card={c}>
                  <span title={cardName(c)} className="truncate font-bold text-ink">{cardName(c)}</span>
                  {c.group ? <span className="shrink-0 font-mono text-[9px] text-cyan uppercase">{t('kind.engine')}</span> : null}
                  {c.handTrap ? <span className="shrink-0 font-mono text-[9px] text-gold uppercase">{t('handTrap')}</span> : null}
                </Named>
              </span>
              <span role="cell"><Bar value={c.rate ?? 0} max={max} color="loss" label={pct(c.rate)} w={52} /></span>
              <span role="cell" className={NUM}>{num(c.games)}</span>
              <span role="cell" className={twMerge(NUM, 'font-bold', (c.winRate ?? 0.5) < 0.45 ? 'text-loss' : (c.winRate ?? 0.5) >= 0.55 ? 'text-win' : 'text-ink')}>{pct(c.winRate)}</span>
            </div>
          ))}
        </div>
      </div>
      <p className={NOTE}>{t('againstNote')}</p>
    </div>
  )
}
