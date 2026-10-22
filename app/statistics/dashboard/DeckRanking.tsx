'use client'

import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Icon } from '@iconify/react'
import { Panel } from '@ui/panel'
import { TabBar } from '@ui/tab-bar'
import { pct, num, nameOf, faceOf, Art, Bar, ROW, NUM, NOTE } from '../DeepDive'
import type { StatArchetype, LeanArchetype, RankingMode, RankingsSummary } from '@utils/statistics'
import { archKey } from '@utils/statistics'

/* ------------------------------------------------------------------ *
 * Types                                                                *
 * ------------------------------------------------------------------ */

type DeckRankingProps = {
  archetypes: StatArchetype[]
  rankings?: RankingsSummary
  onPickArchetype?: (key: string) => void
}

/* ------------------------------------------------------------------ *
 * Constants                                                            *
 * ------------------------------------------------------------------ */

const FOLD = 12

const TABS = [
  { id: 'mostPlayed' as const, label: 'Mais jogados' },
  { id: 'highestWinRate' as const, label: 'Mais vencedores' },
  { id: 'rising' as const, label: 'Em ascensão' },
  { id: 'sleeper' as const, label: 'Sleeper' },
  { id: 'consistent' as const, label: 'Mais consistentes' },
] satisfies ReadonlyArray<{ id: RankingMode; label: string }>

const COLS = '32px minmax(200px, 2fr) minmax(160px, 1.4fr) minmax(80px, 0.8fr) minmax(80px, 0.8fr) minmax(90px, 0.9fr)'

const HEAD_LABELS = ['#', 'Arquétipo', 'Win rate (IC)', 'Partidas', 'Jogadores', 'Métrica']

/* ------------------------------------------------------------------ *
 * Helpers                                                              *
 * ------------------------------------------------------------------ */

/** Small T1/T2/T3/T4 chip coloured by tier. */
const tierBadge = (tier?: 1 | 2 | 3 | 4 | null) => {
  if (!tier) return null
  const colors = {
    1: 'text-tier-diamond',
    2: 'text-tier-platinum',
    3: 'text-tier-silver',
    4: 'text-tier-gold',
  } as const
  return <span className={`font-mono text-[10px] ${colors[tier]}`}>T{tier}</span>
}

/** Reorder `archetypes` by the key-order in a rankings list, unknowns appended. */
const reorderByRanking = (archetypes: StatArchetype[], keys: (string | number[])[]): StatArchetype[] => {
  const map = new Map(archetypes.map((a) => [archKey(a.archetype), a]))
  const ordered: StatArchetype[] = []
  for (const rawKey of keys) {
    const k = Array.isArray(rawKey) ? archKey(rawKey) : rawKey
    const a = map.get(k)
    if (a) {
      ordered.push(a)
      map.delete(k)
    }
  }
  // Append any archetypes not present in the ranking list
  for (const a of map.values()) ordered.push(a)
  return ordered
}

/** Local sort fallback for servers that don't provide RankingsSummary. */
const sortLocally = (archetypes: StatArchetype[], mode: RankingMode): StatArchetype[] => {
  const copy = [...archetypes]
  switch (mode) {
    case 'mostPlayed':
      return copy.sort((a, b) => b.games - a.games)
    case 'highestWinRate':
      return copy.sort((a, b) => (b.wilsonLower ?? -1) - (a.wilsonLower ?? -1))
    case 'rising':
      return copy.sort((a, b) => ((b as any).growth ?? 0) - ((a as any).growth ?? 0))
    case 'sleeper':
      return copy.sort((a, b) => ((b as any).sleeperScore ?? 0) - ((a as any).sleeperScore ?? 0))
    case 'consistent':
      return copy.sort((a, b) => ((b as any).consistencyScore ?? 0) - ((a as any).consistencyScore ?? 0))
  }
}

/* ------------------------------------------------------------------ *
 * Metric cell — changes per tab                                        *
 * ------------------------------------------------------------------ */

const MetricCell = ({ archetype: a, mode }: { archetype: StatArchetype; mode: RankingMode }) => {
  switch (mode) {
    case 'mostPlayed': {
      const maxGames = 1 // will be overridden by caller; here a placeholder — see RankingTable
      return (
        <span className={NUM}>
          <Bar value={a.metaShare} max={1} label={pct(a.metaShare)} color="series-1" w={56} />
        </span>
      )
    }
    case 'highestWinRate':
      return (
        <span className={twMerge(NUM, 'font-mono text-xs text-win')}>
          {a.wilsonLower != null ? `Wilson: ${(a.wilsonLower * 100).toFixed(1)}%` : '—'}
        </span>
      )
    case 'rising': {
      const growth: number | undefined = (a as any).growth
      if (growth == null)
        return <span className={twMerge(NUM, 'text-ink-muted')}>—</span>
      const positive = growth >= 0
      return (
        <span className={twMerge(NUM, 'flex items-center justify-end gap-0.5 font-mono text-xs', positive ? 'text-win' : 'text-loss')}>
          <Icon icon={positive ? 'mdi:arrow-up' : 'mdi:arrow-down'} className="shrink-0 text-[10px]" />
          {positive ? '+' : ''}
          {(growth * 100).toFixed(1)}%
        </span>
      )
    }
    case 'sleeper': {
      const score: number | undefined = (a as any).sleeperScore
      return (
        <span className={twMerge(NUM, 'font-mono text-xs text-gold')}>
          {score != null ? score.toFixed(2) : '—'}
        </span>
      )
    }
    case 'consistent': {
      const score: number | undefined = (a as any).consistencyScore
      if (score == null) return <span className={twMerge(NUM, 'text-ink-muted')}>—</span>
      return (
        <span className={NUM}>
          <Bar value={score} max={1} label={(score * 100).toFixed(0) + '%'} color="series-2" w={56} />
        </span>
      )
    }
  }
}

/* ------------------------------------------------------------------ *
 * Header row                                                           *
 * ------------------------------------------------------------------ */

const HEAD_CLS = 'grid min-h-9 items-center gap-x-4 border-b border-line-mid bg-surface-200 px-4 text-ink-muted signal-sm'

const TableHead = ({ mode }: { mode: RankingMode }) => {
  const metricLabel =
    mode === 'mostPlayed' ? 'Meta share'
    : mode === 'highestWinRate' ? 'Wilson CI'
    : mode === 'rising' ? 'Crescimento'
    : mode === 'sleeper' ? 'Sleeper score'
    : 'Consistência'

  const labels = [...HEAD_LABELS.slice(0, 5), metricLabel]

  return (
    <div role="row" className={HEAD_CLS} style={{ gridTemplateColumns: COLS }}>
      {labels.map((label, i) => (
        <span key={label} role="columnheader" className={i >= 2 ? NUM : undefined}>
          {label}
        </span>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Single archetype row                                                 *
 * ------------------------------------------------------------------ */

const ArchRow = ({
  archetype: a,
  rank,
  mode,
  onPick,
}: {
  archetype: StatArchetype
  rank: number
  mode: RankingMode
  onPick?: () => void
}) => {
  const face = faceOf(a)
  const ci: { margin: number } | undefined = (a as any).ci
  const tier: 1 | 2 | 3 | 4 | null | undefined = (a as any).tier

  return (
    <div
      role="row"
      className={twMerge(ROW, onPick && 'cursor-pointer')}
      style={{ gridTemplateColumns: COLS }}
      onClick={onPick}
    >
      {/* # */}
      <span role="cell" className="font-mono text-xs text-ink-muted tabular-nums">
        {rank}
      </span>

      {/* Arquétipo */}
      <span role="cell" className="flex min-w-0 items-center gap-2">
        <Art card={face} size={32} className="size-8 shrink-0" />
        <span className="flex min-w-0 flex-col">
          <span className="flex min-w-0 items-baseline gap-1.5">
            <span className="truncate font-bold text-ink">{nameOf(a)}</span>
            {tierBadge(tier)}
          </span>
        </span>
      </span>

      {/* Win rate (IC) */}
      <span role="cell" className={NUM}>
        <span className="font-bold text-ink">{pct(a.winRate)}</span>
        {ci != null && (
          <span className="ml-1 text-xs text-ink-muted">
            ±&thinsp;{(ci.margin * 100).toFixed(1)}%
          </span>
        )}
      </span>

      {/* Partidas */}
      <span role="cell" className={twMerge(NUM, 'text-xs')}>
        {num(a.games)}
      </span>

      {/* Jogadores */}
      <span role="cell" className={twMerge(NUM, 'text-xs')}>
        {num(a.players)}
      </span>

      {/* Métrica */}
      <span role="cell">
        <MetricCell archetype={a} mode={mode} />
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Main component                                                       *
 * ------------------------------------------------------------------ */

export const DeckRanking = ({ archetypes, rankings, onPickArchetype }: DeckRankingProps) => {
  const [activeTab, setActiveTab] = useState<RankingMode>('mostPlayed')
  const [expanded, setExpanded] = useState(false)

  const sorted: StatArchetype[] = (() => {
    if (rankings?.[activeTab]) {
      return reorderByRanking(archetypes, rankings[activeTab])
    }
    return sortLocally(archetypes, activeTab)
  })()

  const visible = expanded ? sorted : sorted.slice(0, FOLD)
  const hasMore = sorted.length > FOLD

  return (
    <Panel title="Ranking de decks" meta={`${num(archetypes.length)} arquétipos`}>
      {/* Tab bar */}
      <TabBar
        tabs={TABS}
        active={activeTab}
        onSelect={setActiveTab}
        label="Modo de ranking"
        idPrefix="deck-ranking"
        fit
        className="mb-4 -mx-1"
      />

      {/* Table */}
      <div className="overflow-x-auto">
        <div role="table" aria-label="Ranking de arquétipos" className="min-w-[680px] border border-line">
          <TableHead mode={activeTab} />
          {visible.map((a, i) => (
            <ArchRow
              key={archKey(a.archetype)}
              archetype={a}
              rank={i + 1}
              mode={activeTab}
              onPick={onPickArchetype ? () => onPickArchetype(archKey(a.archetype)) : undefined}
            />
          ))}
        </div>
      </div>

      {/* Fold toggle */}
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 cursor-pointer text-[13px] text-azure-lift hover:text-ink transition-colors"
        >
          {expanded ? `Ver top ${FOLD}` : `Ver todos (${num(sorted.length)})`}
        </button>
      )}

      {/* Note */}
      <p className={twMerge(NOTE, 'mt-3')}>
        Win rate exclui mirrors. IC 95% Wilson. ⚠ Amostra pequena: o intervalo chega a mais de 1,2 ponto abaixo da taxa.
      </p>
    </Panel>
  )
}
