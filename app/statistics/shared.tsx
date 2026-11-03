'use client'

/** The helpers the statistics pages share: formatters, bars, sortable div tables. */

import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { CardArt } from '@omega/card-art'
import type { CardStat, SampleDeck } from '@utils/statistics'

export const pct = (r: number | null | undefined) => (r == null ? '—' : (r * 100).toFixed(1) + '%')
export const fixed = (n: number | null, digits: number) => (n == null ? '—' : n.toFixed(digits))
export const num = (n: number) => n.toLocaleString('en-US')
const points = (r: number) => String(Number((r * 100).toFixed(1)))
/** An interval as a range, never as ±: `54–56`. */
export const range = (lo: number | null | undefined, hi: number | null | undefined) => (lo == null || hi == null ? '—' : `${points(lo)}–${points(hi)}`)
/** A rate with no decimals past what it has: `55`, `55.2`. */
export const value = (r: number) => points(r)
/** `name` is `null` for a setcode without a name: the key stands in. */
export { nameOf } from './format'
export const cardName = (c: { name: string | null; id: number }) => c.name ?? `#${c.id}`
/** A deck's face: its sample deck's cover, else its most included card. */
export const faceOf = ({ cards, sampleDeck }: { cards: Pick<CardStat, 'card'>[]; sampleDeck: Pick<SampleDeck, 'coverCardId'> | null }) => {
  const id = sampleDeck?.coverCardId ?? cards[0]?.card
  return id ? { id, name: null } : undefined
}

export const ROW = 'grid min-h-12 items-center gap-x-4 border-b border-line bg-surface-100 px-4 text-sm leading-5 text-ink-dim last:border-b-0 hover:bg-surface-300 hover:text-ink'
const HEAD = 'grid min-h-9 items-center gap-x-4 border-b border-line-mid bg-surface-200 px-4 text-ink-muted signal-sm'
export const NUM = 'text-right tabular-nums'
export const NOTE = 'text-[13px] leading-5 text-ink-muted'
/** `minmax(0, …)` everywhere, so a wide table scrolls in its box instead of stretching the column. */
export const SPLIT = 'grid grid-cols-[minmax(0,1fr)] gap-6 min-[980px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]'

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

/** A deck's tier. A deck without one shows nothing: that is not "missing". */
export const TierTag = ({ children }: { children: React.ReactNode }) => (
  <span className="cut px-2 py-0.5 text-cyan signal-strong [--cut:var(--cut-xs)] [--edge:var(--color-cyan)] [--fill:var(--color-ground-cyan)]">{children}</span>
)

/** Square artwork crop. `card` undefined (a deck with no tracked card) keeps the slot as an empty well. */
export const Art = ({ card, size, className }: { card?: { id: number; name: string | null }; size: number; className?: string }) =>
  card ? (
    <CardArt art={card} alt="" sizes={`${size}px`} className={twMerge('flex-none border border-line', className)} />
  ) : (
    <span aria-hidden className={twMerge('flex-none border border-line bg-space-000', className)} />
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

