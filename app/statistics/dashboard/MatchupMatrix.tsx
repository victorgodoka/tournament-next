'use client'

import { useState, useRef } from 'react'
import { twMerge } from 'tailwind-merge'
import { Panel } from '@ui/panel'
import { pct, num, nameOf, faceOf, Art, NOTE } from '../DeepDive'
import { archKey } from '@utils/statistics'
import type { Matchup, StatArchetype, MatchupStatus, ArchetypeKey, LeanArchetype } from '@utils/statistics'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CellView = 'winRate' | 'games' | 'status'

type MatchupMatrixProps = {
  archetypes: StatArchetype[]
  matchups: Matchup[]
  maxDecks?: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Shortened archetype name for column headers (≤ 10 chars). */
function abbrev(name: string): string {
  if (name.length <= 10) return name
  // Try first two meaningful words
  const words = name.split(/\s+/)
  if (words.length >= 2) return words.slice(0, 2).join(' ')
  return name.slice(0, 10)
}

function statusLabel(s: MatchupStatus | undefined, winRate: number | null): MatchupStatus {
  if (s) return s
  if (winRate == null) return 'neutral'
  if (winRate >= 0.55) return 'favorable'
  if (winRate >= 0.45) return 'neutral'
  return 'unfavorable'
}

function statusPt(s: MatchupStatus): string {
  switch (s) {
    case 'favorable':   return 'Favorável'
    case 'unfavorable': return 'Desfavorável'
    default:            return 'Neutro'
  }
}

/** CSS classes for the colored cell background + text. */
function cellColors(m: Matchup | undefined): string {
  if (!m || m.winRate == null) return 'bg-surface-100 text-ink-muted'
  const s = statusLabel(m.status, m.winRate)
  switch (s) {
    case 'favorable':   return 'bg-win/20 text-win'
    case 'unfavorable': return 'bg-loss/20 text-loss'
    default:            return 'bg-surface-200 text-ink-dim'
  }
}

/** A matchup lookup key. */
function mkKey(a: ArchetypeKey, b: ArchetypeKey): string {
  return `${archKey(a)}+${archKey(b)}`
}

/** Wilson CI margin — the `ci.margin` field if present, else a rough estimate. */
function ciMargin(m: Matchup): string {
  if (m.ci?.margin != null) return (m.ci.margin * 100).toFixed(1)
  // Fallback: approximate from lower bound
  if (m.winRate != null && m.wilsonLower != null)
    return ((m.winRate - m.wilsonLower) * 100).toFixed(1)
  return '?'
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

type TooltipData = {
  rowName: string
  colName: string
  matchup: Matchup | undefined
  x: number
  y: number
}

const Tooltip = ({ data }: { data: TooltipData }) => {
  const { rowName, colName, matchup: m } = data
  const s = m ? statusLabel(m.status, m.winRate) : undefined

  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-50 min-w-44 max-w-56 rounded border border-line-mid bg-surface-300 px-3 py-2.5 text-[12px] leading-5 shadow-lg"
      style={{ left: data.x, top: data.y }}
    >
      <p className="mb-1.5 font-bold text-ink">
        {rowName} <span className="text-ink-muted font-normal">vs</span> {colName}
      </p>
      {m && m.winRate != null ? (
        <>
          <p className="tabular-nums text-ink-dim">
            <span className="font-mono">{pct(m.winRate)}</span>
            {m.ci || m.wilsonLower != null ? (
              <span className="text-ink-muted"> ± {ciMargin(m)}%</span>
            ) : null}
          </p>
          <p className="text-ink-muted">{num(m.games)} partidas</p>
          {s ? (
            <p
              className={twMerge(
                'mt-1 font-semibold',
                s === 'favorable'   ? 'text-win' :
                s === 'unfavorable' ? 'text-loss' : 'text-ink-dim',
              )}
            >
              {statusPt(s)}
            </p>
          ) : null}
          {m.turnOrder && (
            <p className="mt-1 text-ink-muted">
              Primeiro:{' '}
              <span className="tabular-nums text-ink-dim font-mono">
                {pct(m.turnOrder.first.winRate)}
              </span>{' '}
              · Segundo:{' '}
              <span className="tabular-nums text-ink-dim font-mono">
                {pct(m.turnOrder.second.winRate)}
              </span>
            </p>
          )}
        </>
      ) : (
        <p className="text-ink-muted">Sem dados</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Cell
// ---------------------------------------------------------------------------

type CellProps = {
  view: CellView
  matchup: Matchup | undefined
  isDiagonal: boolean
  rowName: string
  colName: string
  onHover: (data: TooltipData | null) => void
}

const MatrixCell = ({ view, matchup: m, isDiagonal, rowName, colName, onHover }: CellProps) => {
  const ref = useRef<HTMLDivElement>(null)

  if (isDiagonal) {
    return (
      <div
        className="flex min-h-12 min-w-[52px] items-center justify-center bg-surface-200 text-ink-muted select-none"
        aria-label={`${rowName} vs ${rowName} — diagonal`}
      >
        <span className="tabular-nums text-[11px]">—</span>
      </div>
    )
  }

  const label = (() => {
    if (!m || m.winRate == null) return '—'
    if (view === 'games') return num(m.games)
    if (view === 'status') {
      const s = statusLabel(m.status, m.winRate)
      return s === 'favorable' ? 'Fav' : s === 'unfavorable' ? 'Desf' : 'Neu'
    }
    return (m.winRate * 100).toFixed(0) + '%'
  })()

  const titleAttr = m && m.winRate != null
    ? `${rowName} vs ${colName}: ${pct(m.winRate)} (${num(m.games)} jogos)`
    : `${rowName} vs ${colName}: sem dados`

  const handleMouseEnter = (e: React.MouseEvent) => {
    const rect = ref.current?.getBoundingClientRect()
    const parentRect = ref.current?.closest('[data-matrix-wrap]')?.getBoundingClientRect()
    if (!rect || !parentRect) return
    onHover({
      rowName,
      colName,
      matchup: m,
      x: rect.left - parentRect.left,
      y: rect.bottom - parentRect.top + 6,
    })
  }

  return (
    <div
      ref={ref}
      title={titleAttr}
      className={twMerge(
        'flex min-h-12 min-w-[52px] cursor-default items-center justify-center text-[12px] tabular-nums transition-opacity hover:opacity-80',
        cellColors(m),
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => onHover(null)}
    >
      {label}
    </div>
  )
}

// ---------------------------------------------------------------------------
// "Outros" synthetic matchup builder
// ---------------------------------------------------------------------------

function buildOthersMatchup(arch: StatArchetype, opponentKey: ArchetypeKey): Matchup | undefined {
  const o = arch.matchupOthers
  if (!o) return undefined
  return {
    archetype: arch.archetype,
    opponent: opponentKey,
    games: o.games,
    wins: o.wins,
    losses: o.losses,
    draws: o.draws,
    winRate: o.winRate,
    wilsonLower: o.wilsonLower,
    ci: o.ci,
    status: o.status,
    turnOrder: o.turnOrder,
    sideboarding: o.sideboarding,
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const MatchupMatrix = ({ archetypes, matchups, maxDecks = 10 }: MatchupMatrixProps) => {
  const [view, setView] = useState<CellView>('winRate')
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)

  // Responsive cap
  const isMobileLimit = typeof window !== 'undefined' && window.innerWidth < 720
  const mobileMax = 6

  // Slice archetypes to maxDecks
  const decks = archetypes.slice(0, maxDecks)

  // Sentinel key for "Outros" column/row
  const OUTROS_KEY = 'outros'

  // Build O(1) lookup map
  const matchupMap = new Map<string, Matchup>()
  for (const mu of matchups) {
    matchupMap.set(mkKey(mu.archetype, mu.opponent), mu)
  }

  // Lookup helper
  const getMatchup = (rowArch: StatArchetype, colArch: StatArchetype | 'outros'): Matchup | undefined => {
    if (colArch === 'outros') return buildOthersMatchup(rowArch, [])
    return matchupMap.get(mkKey(rowArch.archetype, colArch.archetype))
  }

  const totalMatchups = matchups.length
  const label = `${decks.length} decks · ${totalMatchups} matchups`

  const VIEW_BUTTONS: { key: CellView; label: string }[] = [
    { key: 'winRate', label: 'Win rate' },
    { key: 'games',   label: 'Games' },
    { key: 'status',  label: 'Status' },
  ]

  // Column headers (decks + Outros)
  const colDecks = decks
  const hasOthers = decks.some((d) => d.matchupOthers != null)

  return (
    <Panel
      title="Matchup matrix"
      meta={label}
      actions={
        <div className="ml-auto flex items-center gap-px rounded border border-line overflow-hidden">
          {VIEW_BUTTONS.map((btn) => (
            <button
              key={btn.key}
              type="button"
              onClick={() => setView(btn.key)}
              className={twMerge(
                'px-2.5 py-1 signal-sm transition-colors',
                view === btn.key
                  ? 'bg-surface-300 text-azure-lift'
                  : 'bg-surface-100 text-ink-muted hover:text-ink-dim',
              )}
            >
              {btn.label}
            </button>
          ))}
        </div>
      }
    >
      {/* Mobile notice */}
      <p className={twMerge(NOTE, 'mb-3 min-[720px]:hidden')}>
        Exibindo top {mobileMax} · abra em desktop para ver mais
      </p>

      {/* Scroll wrapper */}
      <div className="overflow-x-auto" data-matrix-wrap="" style={{ position: 'relative' }}>
        {/* Tooltip */}
        {tooltip && (
          <div
            className="pointer-events-none absolute z-50"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            <Tooltip data={tooltip} />
          </div>
        )}

        {/*
         * CSS grid: [row-header] [col1] [col2] … [colN] [outros?]
         * Row header min 120px, each cell min 52px.
         */}
        <div
          className="grid"
          style={{
            gridTemplateColumns: `minmax(120px,180px) repeat(${colDecks.length + (hasOthers ? 1 : 0)}, minmax(52px, 1fr))`,
          }}
        >
          {/* ── Top-left corner (empty) ── */}
          <div className="sticky left-0 z-10 bg-space-000" />

          {/* ── Column headers ── */}
          {colDecks.map((deck) => {
            const face = faceOf(deck)
            const name = nameOf(deck)
            return (
              <div
                key={archKey(deck.archetype)}
                className="flex flex-col items-center justify-end gap-1 pb-2 min-[720px]:hidden"
                aria-label={name}
                title={name}
                style={{ minWidth: 52 }}
              >
                {/* Mobile: just show art */}
                <Art card={face} size={28} className="size-7" />
                <span className="signal-sm text-ink-muted truncate max-w-[52px] text-center">
                  {abbrev(name)}
                </span>
              </div>
            )
          })}
          {/* Desktop column headers: rotated name + art */}
          {colDecks.map((deck) => {
            const face = faceOf(deck)
            const name = nameOf(deck)
            return (
              <div
                key={`dsk-${archKey(deck.archetype)}`}
                aria-label={name}
                title={name}
                className="hidden min-[720px]:flex flex-col items-center justify-end gap-1 pb-2"
                style={{ minWidth: 52 }}
              >
                <Art card={face} size={32} className="size-8" />
                <span
                  className="signal-sm text-ink-muted origin-bottom-left"
                  style={{
                    writingMode: 'vertical-rl',
                    transform: 'rotate(180deg)',
                    maxHeight: 72,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {abbrev(name)}
                </span>
              </div>
            )
          })}
          {hasOthers && (
            <div
              className="flex flex-col items-center justify-end gap-1 pb-2"
              title="Outros"
              style={{ minWidth: 52 }}
            >
              <span
                className="signal-sm text-ink-muted"
                style={{
                  writingMode: 'vertical-rl',
                  transform: 'rotate(180deg)',
                  maxHeight: 72,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                }}
              >
                Outros
              </span>
            </div>
          )}

          {/* ── Rows ── */}
          {decks.map((rowDeck, ri) => {
            const rowName = nameOf(rowDeck)
            const face = faceOf(rowDeck)
            return (
              <>
                {/* Row header */}
                <div
                  key={`rh-${archKey(rowDeck.archetype)}`}
                  className="sticky left-0 z-10 flex min-h-12 min-w-[120px] items-center gap-2 border-b border-line bg-surface-100 px-3 text-sm font-semibold text-ink"
                >
                  <Art card={face} size={24} className="size-6 flex-none" />
                  <span className="truncate" title={rowName}>{rowName}</span>
                </div>

                {/* Cells */}
                {colDecks.map((colDeck, ci) => (
                  <MatrixCell
                    key={`cell-${ri}-${ci}`}
                    view={view}
                    matchup={getMatchup(rowDeck, colDeck)}
                    isDiagonal={ri === ci}
                    rowName={rowName}
                    colName={nameOf(colDeck)}
                    onHover={setTooltip}
                  />
                ))}

                {/* Outros cell */}
                {hasOthers && (
                  <MatrixCell
                    key={`cell-${ri}-outros`}
                    view={view}
                    matchup={getMatchup(rowDeck, 'outros')}
                    isDiagonal={false}
                    rowName={rowName}
                    colName="Outros"
                    onHover={setTooltip}
                  />
                )}
              </>
            )
          })}

          {/* ── Outros row ── */}
          {hasOthers && (
            <>
              <div className="sticky left-0 z-10 flex min-h-12 min-w-[120px] items-center gap-2 border-b border-line bg-surface-100 px-3 text-sm font-semibold text-ink-dim">
                Outros
              </div>
              {colDecks.map((colDeck, ci) => {
                // For the "Outros" row, we look for an archetype whose matchupOthers
                // could represent "other decks vs colDeck" — this isn't directly
                // available per-column, so we show a dash.
                return (
                  <div
                    key={`outros-row-${ci}`}
                    className="flex min-h-12 min-w-[52px] items-center justify-center bg-surface-100 text-ink-muted text-[11px] tabular-nums"
                  >
                    —
                  </div>
                )
              })}
              {/* Outros vs Outros diagonal */}
              <div className="flex min-h-12 min-w-[52px] items-center justify-center bg-surface-200 text-ink-muted text-[11px]">
                —
              </div>
            </>
          )}
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1.5 text-[12px] text-ink-muted">
            <span className="inline-block size-3 rounded-sm bg-win/20 border border-win/30" />
            Favorável ≥ 55%
          </span>
          <span className="flex items-center gap-1.5 text-[12px] text-ink-muted">
            <span className="inline-block size-3 rounded-sm bg-surface-200 border border-line" />
            Neutro 45–55%
          </span>
          <span className="flex items-center gap-1.5 text-[12px] text-ink-muted">
            <span className="inline-block size-3 rounded-sm bg-loss/20 border border-loss/30" />
            Desfavorável &lt; 45%
          </span>
        </div>
      </div>
    </Panel>
  )
}
