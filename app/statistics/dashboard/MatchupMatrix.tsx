'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { Select } from '@ui/field'
import { Lookup, type LookupOption } from '@ui/lookup'
import { Panel } from '@ui/panel'
import { archKey, deckHref, intervalOf, matchupStatus, strengthOf } from '@utils/statistics'
import type { Matchup, MatchupOthers, StatArchetype, MatchupStatus, StatisticsScope } from '@utils/statistics'
import { pct, num, nameOf, faceOf, Art, NOTE } from '../DeepDive'
import { DeckPicker, FilterField, matches } from './controls'

type CellView = 'winRate' | 'games'

type MatchupMatrixProps = {
  archetypes: StatArchetype[]
  matchups: Matchup[]
  scope: StatisticsScope
}

/** A matchup cell, or the row's record against every deck outside the page's list. */
export type Cell = Pick<Matchup, 'games' | 'winRate' | 'wilsonLower' | 'ci' | 'adjusted' | 'turnOrder'> | MatchupOthers

/** Past this 95% margin the rate is too loose to call: the cell is drawn neutral and flagged. */
export const LOOSE_MARGIN = 0.06
const OTHERS = 'others'
const DEFAULT_COLUMNS = 10
const MAX_COLUMNS = 12
const FOLD = 10
const MIN_GAMES = [1, 50, 100, 250] as const
/** Under 100 games a cell is mostly noise (90% of the TCG matrix in 2026-11): the reader opts into those. */
const DEFAULT_MIN_GAMES = 100

/** The call reads the adjusted interval (shrunk toward the deck's win rate); raw Wilson from an older server. */
export const statusOf = (c: Cell): MatchupStatus => (c.winRate == null ? 'neutral' : matchupStatus(intervalOf(c)))
const marginOf = (c: Cell) => intervalOf(c)?.margin ?? (c.winRate != null && c.wilsonLower != null ? c.winRate - c.wilsonLower : null)
export const isLoose = (c: Cell) => (marginOf(c) ?? 1) > LOOSE_MARGIN

export const TONE = { favorable: 'bg-win/20 text-win', neutral: 'bg-surface-200 text-ink-dim', unfavorable: 'bg-loss/20 text-loss' } as const
export const TEXT = { favorable: 'text-win', neutral: 'text-ink-dim', unfavorable: 'text-loss' } as const
const BAR = { favorable: 'bg-win', neutral: 'bg-series-3', unfavorable: 'bg-loss' } as const
/** A rate's position on the 40–70% bar scale. */
export const at = (rate: number) => `${Math.min(100, Math.max(0, ((rate - 0.4) / 0.3) * 100))}%`

type Hover = { row: string; col: string; cell: Cell | undefined; x: number; y: number }

const Tooltip = ({ hover: { row, col, cell, x, y } }: { hover: Hover }) => {
  const t = useTranslations('Statistics.matrix')
  const margin = cell && marginOf(cell)
  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-50 w-56 -translate-x-1/2 -translate-y-full border border-line-mid bg-surface-300 px-3 py-2.5 text-[12px] leading-5 shadow-lift"
      style={{ left: x, top: y }}
    >
      <p className="mb-1.5 font-bold text-ink">{t('versus', { row, col })}</p>
      {cell && cell.winRate != null ? (
        <>
          <p className="tabular-nums text-ink-dim">
            <span className="font-mono">{pct(cell.winRate)}</span>
            {margin != null ? <span className="text-ink-muted"> ± {(margin * 100).toFixed(1)} pts</span> : null}
            <span className="text-ink-muted"> · {t('games', { count: num(cell.games) })}</span>
          </p>
          <p className={twMerge('mt-1 font-semibold', isLoose(cell) ? 'text-gold' : TEXT[statusOf(cell)])}>
            {isLoose(cell) ? t('loose') : t(`status.${statusOf(cell)}`)}
          </p>
          {cell.turnOrder ? (
            <p className="mt-1 text-ink-muted">
              {t('turn', { first: pct(cell.turnOrder.first.winRate), second: pct(cell.turnOrder.second.winRate) })}
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-ink-muted">{t('noGames')}</p>
      )}
    </div>
  )
}

/** On a phone the matrix is one deck at a time: its matchups as bars, each with its 95% interval on a 40–70% scale. */
export const MatchupRow = ({ archetypes, matchups, scope, className }: MatchupMatrixProps & { className?: string }) => {
  const t = useTranslations('Statistics.matrix')
  const [key, setKey] = useState(archetypes[0] ? archKey(archetypes[0].archetype) : '')
  const rows = matchups
    .filter((m) => archKey(m.archetype) === key && m.winRate != null)
    .sort((a, b) => b.games - a.games)
    .slice(0, 12)
  const names = new Map(archetypes.map((a) => [archKey(a.archetype), nameOf(a)]))
  return (
    <div className={twMerge('flex flex-col gap-3', className)}>
      <Select label={t('pickDeck')} value={key} onChange={(e) => setKey(e.target.value)} options={archetypes.map((a) => ({ value: archKey(a.archetype), label: nameOf(a) }))} />
      <ul className="flex flex-col gap-px border border-line bg-line">
        {rows.map((m) => {
          const opponent = archKey(m.opponent)
          const status = statusOf(m)
          const ci = intervalOf(m)
          return (
            <li key={opponent} className="flex flex-col gap-2 bg-surface-100 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <Link href={deckHref(m.opponent, scope)} className="truncate font-bold text-ink">{t('versusShort', { name: names.get(opponent) ?? opponent })}</Link>
                <span className={twMerge('font-mono text-sm font-bold', TEXT[status])}>{pct(m.winRate)}</span>
              </div>
              <div className="relative h-3.5 bg-surface-200" aria-hidden>
                <span className="absolute top-0 bottom-0 w-px bg-line-strong" style={{ left: at(0.5) }} />
                {ci ? <span className={twMerge('absolute top-1 h-1.5', BAR[status])} style={{ left: at(ci.lower), right: `calc(100% - ${at(ci.upper)})` }} /> : null}
                <span className="absolute top-0 h-3.5 w-0.5 bg-ink" style={{ left: at(m.winRate ?? 0.5) }} />
              </div>
              <span className="text-ink-muted signal-sm">{ci ? `±${(ci.margin * 100).toFixed(1)} · ` : ''}{t('games', { count: num(m.games) })}</span>
            </li>
          )
        })}
      </ul>
      <p className={NOTE}>{t('barNote')}</p>
    </div>
  )
}

/** Rows: every listed deck, searchable. Columns: the decks picked (top 10 to start), plus "outside the list". */
export const MatchupMatrix = ({ archetypes, matchups, scope }: MatchupMatrixProps) => {
  const t = useTranslations('Statistics.matrix')
  const [view, setView] = useState<CellView>('winRate')
  const [hover, setHover] = useState<Hover | null>(null)
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [columns, setColumns] = useState(() => archetypes.slice(0, DEFAULT_COLUMNS).map((a) => archKey(a.archetype)))
  // Rows ordered by their win rate against one column: "who beats X" / "who loses to X". Columns stay put.
  const [sortCol, setSortCol] = useState<{ key: string; desc: boolean } | null>(null)
  // Cells under this many games read "—": the noise of a handful of games out of the way.
  const [minGames, setMinGames] = useState<(typeof MIN_GAMES)[number]>(DEFAULT_MIN_GAMES)
  const [order, setOrder] = useState<'popularity' | 'name'>('popularity')

  const byKey = new Map(archetypes.map((a) => [archKey(a.archetype), a]))
  const cols = columns.flatMap((k) => byKey.get(k) ?? [])
  const byPair = new Map(matchups.map((m) => [`${archKey(m.archetype)}+${archKey(m.opponent)}`, m]))
  const cellOf = (row: StatArchetype, col: StatArchetype): Cell | undefined => byPair.get(`${archKey(row.archetype)}+${archKey(col.archetype)}`)
  const hasOthers = archetypes.some((d) => d.matchupOthers)

  const rateVs = (row: StatArchetype, colKey: string) => {
    if (colKey === OTHERS) return row.matchupOthers?.winRate ?? null
    const col = byKey.get(colKey)
    return col && col !== row ? (cellOf(row, col)?.winRate ?? null) : null
  }
  const pool = order === 'name' ? [...archetypes].sort((a, b) => nameOf(a).localeCompare(nameOf(b))) : archetypes
  const filtered = query ? pool.filter((a) => matches(nameOf(a), query)) : pool
  const sorted = sortCol
    ? [...filtered].sort((a, b) => {
        const x = rateVs(a, sortCol.key), y = rateVs(b, sortCol.key)
        if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1
        return sortCol.desc ? y - x : x - y
      })
    : filtered
  const rows = expanded || query ? sorted : sorted.slice(0, FOLD)
  const shown = rows.reduce((n, r) => n + cols.filter((c) => c !== r && cellOf(r, c)).length, 0)
  const sortOn = (key: string) => setSortCol((s) => (s?.key === key ? (s.desc ? { key, desc: false } : null) : { key, desc: true }))
  const ariaSortOf = (key: string) => (sortCol?.key === key ? (sortCol.desc ? 'descending' : 'ascending') : undefined)
  const arrow = (key: string) => (sortCol?.key === key ? (sortCol.desc ? '↓ ' : '↑ ') : null)

  /** The tooltip is fixed above the cell, in viewport coordinates, so it never stretches the panel or its scroll box. */
  const enter = (e: React.MouseEvent<HTMLElement>, row: string, col: string, cell: Cell | undefined) => {
    const box = e.currentTarget.getBoundingClientRect()
    setHover({ row, col, cell, x: box.left + box.width / 2, y: box.top - 6 })
  }

  const renderCell = (rowName: string, colName: string, cell: Cell | undefined, key: string) => {
    const empty = !cell || cell.winRate == null || cell.games < minGames
    const loose = cell ? isLoose(cell) : true
    return (
      <td
        key={key}
        aria-label={empty ? t('cellEmpty', { row: rowName, col: colName }) : t('cell', { row: rowName, col: colName, rate: pct(cell.winRate), games: num(cell.games) })}
        onMouseEnter={(e) => enter(e, rowName, colName, cell)}
        onMouseLeave={() => setHover(null)}
        className={twMerge(
          'h-11 min-w-14 border border-space-000 text-center text-[12px] tabular-nums',
          empty || loose ? 'bg-surface-100 text-ink-muted' : TONE[statusOf(cell)],
          loose && !empty && 'italic',
        )}
      >
        {empty ? '—' : view === 'games' ? num(cell.games) : pct(cell.winRate)}
      </td>
    )
  }

  return (
    <Panel
      title={t('title')}
      meta={t('meta', { rows: rows.length, cols: cols.length, count: num(shown) })}
      actions={
        <div className="flex items-center gap-px border border-line">
          {(['winRate', 'games'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={twMerge('cursor-pointer px-2.5 py-1 signal-sm transition-colors', view === v ? 'bg-surface-300 text-azure-lift' : 'bg-surface-100 text-ink-muted hover:text-ink-dim')}
            >
              {t(`view.${v}`)}
            </button>
          ))}
        </div>
      }
    >
      <MatchupRow archetypes={archetypes} matchups={matchups} scope={scope} className="min-[720px]:hidden" />
      <div className="mb-4 flex flex-col gap-3 max-[719px]:hidden">
        <div className="flex flex-wrap items-center gap-4">
          <FilterField label={t('searchRows')} value={query} onChange={setQuery} />
          <div role="group" aria-label={t('minGames')} className="flex items-center gap-1">
            <span className="mr-1 text-ink-muted signal-sm">{t('minGames')}</span>
            {MIN_GAMES.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={minGames === n}
                onClick={() => setMinGames(n)}
                className={twMerge('cursor-pointer px-2 py-0.5 font-mono text-xs', minGames === n ? 'bg-surface-300 text-azure-lift' : 'text-ink-muted hover:bg-surface-200 hover:text-ink')}
              >
                {n === 1 ? t('any') : `${n}+`}
              </button>
            ))}
          </div>
          <div role="group" aria-label={t('order')} className="flex items-center gap-1">
            <span className="mr-1 text-ink-muted signal-sm">{t('order')}</span>
            {(['popularity', 'name'] as const).map((o) => (
              <button
                key={o}
                type="button"
                aria-pressed={order === o}
                onClick={() => setOrder(o)}
                className={twMerge('cursor-pointer px-2 py-0.5 font-mono text-xs', order === o ? 'bg-surface-300 text-azure-lift' : 'text-ink-muted hover:bg-surface-200 hover:text-ink')}
              >
                {t(`orders.${o}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-ink-muted signal-sm">{t('columns')}</span>
          <DeckPicker pool={archetypes} selected={columns} onChange={setColumns} max={MAX_COLUMNS} label={t('addColumn')} removeLabel={(name) => t('removeColumn', { name })} />
        </div>
      </div>

      <div className="max-[719px]:hidden">
        {hover ? <Tooltip hover={hover} /> : null}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <caption className="sr-only">{t('caption')}</caption>
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-10 bg-surface-100 px-2 pb-2 text-left align-bottom signal-sm text-ink-muted">{t('corner')}</th>
                {cols.map((d) => {
                  const key = archKey(d.archetype)
                  return (
                    <th key={key} scope="col" aria-sort={ariaSortOf(key)} className="px-0.5 pb-2 align-bottom">
                      <button
                        type="button"
                        onClick={() => sortOn(key)}
                        title={t('sortBy', { name: nameOf(d) })}
                        className={twMerge('flex w-full cursor-pointer flex-col items-center gap-1 hover:text-ink', sortCol?.key === key ? 'text-cyan' : 'text-ink-muted')}
                      >
                        <Art card={faceOf(d)} size={28} className="size-7" />
                        <span className="text-[10px] font-normal">{arrow(key)}<span className="sr-only">{nameOf(d)}</span></span>
                      </button>
                    </th>
                  )
                })}
                {hasOthers ? (
                  <th scope="col" aria-sort={ariaSortOf(OTHERS)} className="px-0.5 pb-2 align-bottom">
                    <button
                      type="button"
                      onClick={() => sortOn(OTHERS)}
                      title={t('othersHint', { count: archetypes.length })}
                      className={twMerge('w-full cursor-pointer text-[10px] font-normal hover:text-ink', sortCol?.key === OTHERS ? 'text-cyan' : 'text-ink-muted')}
                    >
                      {arrow(OTHERS)}{t('others')}
                    </button>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const rowName = nameOf(row)
                const rowKey = archKey(row.archetype)
                return (
                  <tr key={rowKey}>
                    <th scope="row" className="sticky left-0 z-10 bg-surface-100 p-0 text-left">
                      <Link href={deckHref(row.archetype, scope)} title={rowName} className="flex h-11 w-36 items-center gap-2 px-2 text-sm font-semibold text-ink hover:text-cyan min-[720px]:w-44">
                        <Art card={faceOf(row)} size={24} className="size-6" />
                        <span className="truncate">{rowName}</span>
                      </Link>
                    </th>
                    {cols.map((col) =>
                      col === row ? (
                        <td key={archKey(col.archetype)} aria-label={t('mirror')} className="h-11 min-w-14 border border-space-000 bg-surface-200 text-center text-[11px] text-ink-muted">—</td>
                      ) : (
                        renderCell(rowName, nameOf(col), cellOf(row, col), archKey(col.archetype))
                      ),
                    )}
                    {hasOthers ? renderCell(rowName, t('others'), row.matchupOthers, OTHERS) : null}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      {!query && sorted.length > FOLD ? (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-3 cursor-pointer text-[13px] text-azure-lift transition-colors hover:text-ink max-[719px]:hidden">
          {expanded ? t('showTop', { count: FOLD }) : t('showAll', { count: sorted.length })}
        </button>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-4 text-[12px] text-ink-muted max-[719px]:hidden">
        <span className="flex items-center gap-1.5"><span className="inline-block size-3 border border-win/30 bg-win/20" />{t('legend.favorable')}</span>
        <span className="flex items-center gap-1.5"><span className="inline-block size-3 border border-line bg-surface-200" />{t('legend.neutral')}</span>
        <span className="flex items-center gap-1.5"><span className="inline-block size-3 border border-loss/30 bg-loss/20" />{t('legend.unfavorable')}</span>
        <span className="flex items-center gap-1.5"><i>{t('legend.looseMark')}</i>{t('legend.loose', { margin: LOOSE_MARGIN * 100 })}</span>
      </div>
      <p className={twMerge(NOTE, 'mt-2 max-[719px]:hidden')}>{t('note')}</p>
    </Panel>
  )
}

const BEATS_ROWS = 8
const BEATS_TILES = 10

/** Who wins most against one deck, from the same matrix: no extra data, only the rows that have a sample. */
export const WhatBeatsIt = ({ archetypes, matchups, scope }: MatchupMatrixProps) => {
  const t = useTranslations('Statistics.matrix')
  const [target, setTarget] = useState(archetypes[0] ? archKey(archetypes[0].archetype) : '')
  const names = new Map(archetypes.map((a) => [archKey(a.archetype), a]))
  // Lookup wants a stable search: it changes only with the data.
  const search = useCallback(
    async (text: string): Promise<LookupOption[]> =>
      archetypes
        .filter((a) => matches(nameOf(a), text))
        .slice(0, 12)
        .map((a) => ({
          key: archKey(a.archetype),
          label: <span className="flex min-w-0 items-center gap-2"><Art card={faceOf(a)} size={20} className="size-5" /><span className="truncate">{nameOf(a)}</span></span>,
          meta: num(a.games),
        })),
    [archetypes],
  )
  const rows = matchups
    .filter((m) => archKey(m.opponent) === target && m.winRate != null)
    .filter((m) => m.games >= DEFAULT_MIN_GAMES)
    .sort((a, b) => (strengthOf(b) ?? 0) - (strengthOf(a) ?? 0))
    .slice(0, BEATS_ROWS)
  const picked = names.get(target)
  return (
    <Panel title={t('beatsTitle')}>
      {/* The deck to beat: its art and season line beside the picker, so the pick reads as a target, not a form. */}
      <div className="mb-5 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 border border-line bg-surface-200 p-3 min-[720px]:grid-cols-[auto_minmax(0,1fr)_16rem]">
        <Art card={picked ? faceOf(picked) : undefined} size={56} className="size-14" />
        <div className="min-w-0">
          <p className="text-ink-muted signal-sm">{t('beatsPick')}</p>
          {picked ? (
            <>
              <Link href={deckHref(picked.archetype, scope)} className="block truncate text-lg font-bold text-ink hover:text-cyan">{nameOf(picked)}</Link>
              <p className="font-mono text-xs text-ink-muted tabular-nums">{t('beatsStats', { share: pct(picked.metaShare), winRate: pct(picked.winRate), games: num(picked.games) })}</p>
            </>
          ) : null}
        </div>
        <div className="min-w-0 max-[719px]:col-span-2">
          <Lookup label={t('beatsSearch')} placeholder={t('beatsSearch')} search={search} onPick={({ key }) => setTarget(String(key))} />
        </div>
        {/* The top 10 by meta share as art tiles: the usual targets one tap away, the search for the rest. */}
        <ul className="col-span-full flex flex-wrap gap-1.5">
          {archetypes.slice(0, BEATS_TILES).map((a) => {
            const key = archKey(a.archetype)
            const pressed = key === target
            return (
              <li key={key}>
                <button
                  type="button"
                  aria-pressed={pressed}
                  title={nameOf(a)}
                  onClick={() => setTarget(key)}
                  className={twMerge('block cursor-pointer transition-opacity', pressed ? 'opacity-100' : 'opacity-50 hover:opacity-100')}
                >
                  <Art card={faceOf(a)} size={56} className={twMerge('size-12 min-[720px]:size-14', pressed && 'border-2 border-cyan')} />
                  <span className="sr-only">{nameOf(a)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
      <ol className="flex flex-col divide-y divide-line">
        {rows.map((m, i) => {
          const deck = names.get(archKey(m.archetype))
          const status = statusOf(m)
          const ci = intervalOf(m)
          return (
            <li key={archKey(m.archetype)} className="grid grid-cols-[20px_32px_minmax(0,1fr)_auto] items-center gap-3 py-2.5">
              <span className="font-mono text-xs text-ink-muted">{i + 1}</span>
              <Art card={deck ? faceOf(deck) : undefined} size={32} className="size-8" />
              <div className="flex min-w-0 flex-col gap-1.5">
                <Link href={deckHref(m.archetype, scope)} className="truncate font-bold text-ink hover:text-cyan">{deck ? nameOf(deck) : archKey(m.archetype)}</Link>
                <div className="relative h-2 bg-surface-200" aria-hidden>
                  <span className="absolute inset-y-0 w-px bg-line-strong" style={{ left: at(0.5) }} />
                  {ci ? <span className={twMerge('absolute inset-y-0', BAR[status])} style={{ left: at(ci.lower), right: `calc(100% - ${at(ci.upper)})` }} /> : null}
                  <span className="absolute -inset-y-0.5 w-0.5 bg-ink" style={{ left: at(m.winRate ?? 0.5) }} />
                </div>
              </div>
              <span className="flex flex-col items-end font-mono text-xs tabular-nums">
                <span className={twMerge('text-sm font-bold', TEXT[status])}>{pct(m.winRate)}</span>
                <span className="text-ink-muted">
                  {ci ? <span className="max-[719px]:hidden">±{(ci.margin * 100).toFixed(1)} · </span> : null}
                  {t('games', { count: num(m.games) })}
                </span>
              </span>
            </li>
          )
        })}
      </ol>
      {!rows.length ? <p className={NOTE}>{t('beatsEmpty')}</p> : null}
      <p className={twMerge(NOTE, 'mt-3')}>{t('beatsNote')} {t('barNote')}</p>
    </Panel>
  )
}
