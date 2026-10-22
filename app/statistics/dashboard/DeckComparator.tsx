'use client'

/**
 * Deck comparator: side-by-side comparison of up to 3 archetypes.
 * Compares win rate, meta share, consistency and turn-order advantage.
 */

import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Icon } from '@iconify/react'
import { Panel } from '@ui/panel'
import { pct, num, nameOf, faceOf, Art, Bar, NOTE } from '../DeepDive'
import type { StatArchetype } from '@utils/statistics'
import { archKey } from '@utils/statistics'

const PALETTE = ['series-1', 'series-2', 'series-3'] as const
const MAX_COMPARE = 3

type DeckComparatorProps = {
  archetypes: StatArchetype[]
  preselected?: StatArchetype[]
}

type Metric = {
  label: string
  value: (a: StatArchetype) => number | null
  format: (v: number | null) => string
  higher?: 'better' | 'worse'
}

const METRICS: Metric[] = [
  { label: 'Win rate', value: (a) => a.winRate, format: pct, higher: 'better' },
  { label: 'Wilson lower', value: (a) => a.wilsonLower, format: pct, higher: 'better' },
  { label: 'Meta share', value: (a) => a.metaShare, format: pct },
  { label: 'Partidas', value: (a) => a.games, format: (v) => v == null ? '—' : num(v) },
  { label: 'Jogadores únicos', value: (a) => a.players, format: (v) => v == null ? '—' : num(v) },
  { label: 'Indo primeiro', value: (a) => a.turnOrder.first.winRate, format: pct, higher: 'better' },
  { label: 'Indo segundo', value: (a) => a.turnOrder.second.winRate, format: pct, higher: 'better' },
  { label: 'Game 1', value: (a) => a.sideboarding.game1.winRate, format: pct, higher: 'better' },
  { label: 'Pós-side', value: (a) => a.sideboarding.postSide.winRate, format: pct, higher: 'better' },
  { label: 'Consistência', value: (a) => a.consistencyScore ?? null, format: pct, higher: 'better' },
  { label: 'Mirrors', value: (a) => a.mirrorShare, format: pct },
]

export const DeckComparator = ({ archetypes, preselected = [] }: DeckComparatorProps) => {
  const [selected, setSelected] = useState<StatArchetype[]>(preselected.slice(0, MAX_COMPARE))
  const [search, setSearch] = useState('')

  const filtered = archetypes.filter((a) => {
    const name = nameOf(a).toLowerCase()
    const q = search.toLowerCase()
    return name.includes(q) && !selected.some((s) => archKey(s.archetype) === archKey(a.archetype))
  })

  const add = (a: StatArchetype) => {
    if (selected.length >= MAX_COMPARE) return
    setSelected((prev) => [...prev, a])
    setSearch('')
  }

  const remove = (key: string) => {
    setSelected((prev) => prev.filter((s) => archKey(s.archetype) !== key))
  }

  const maxVal = (m: Metric) => {
    const vals = selected.flatMap((a) => {
      const v = m.value(a)
      return v != null ? [v] : []
    })
    return Math.max(...vals, 1)
  }

  const best = (m: Metric): string | null => {
    if (!m.higher || selected.length < 2) return null
    let bestKey: string | null = null
    let bestVal = m.higher === 'better' ? -Infinity : Infinity
    for (const a of selected) {
      const v = m.value(a)
      if (v == null) continue
      if ((m.higher === 'better' && v > bestVal) || (m.higher === 'worse' && v < bestVal)) {
        bestVal = v
        bestKey = archKey(a.archetype)
      }
    }
    return bestKey
  }

  return (
    <Panel
      title="Comparador de decks"
      meta={`Até ${MAX_COMPARE} decks`}
    >
      {/* Deck selector chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {selected.map((a, i) => (
          <div
            key={archKey(a.archetype)}
            className="flex items-center gap-1.5 px-2 py-1 bg-surface-200 border border-line rounded-xs text-sm"
          >
            <span
              className="size-2 rounded-round flex-none"
              style={{ background: `var(--color-${PALETTE[i]})` }}
            />
            <Art card={faceOf(a)} size={20} className="size-5" />
            <span className="text-ink font-semibold truncate max-w-32">{nameOf(a)}</span>
            <button
              type="button"
              aria-label={`Remover ${nameOf(a)}`}
              onClick={() => remove(archKey(a.archetype))}
              className="text-ink-muted hover:text-loss transition-colors cursor-pointer"
            >
              <Icon icon="mdi:close" className="text-sm" />
            </button>
          </div>
        ))}
        {selected.length < MAX_COMPARE && (
          <div className="relative">
            <input
              type="text"
              placeholder="Adicionar deck…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 px-3 text-sm bg-surface-200 border border-line-mid text-ink placeholder:text-ink-muted rounded-xs outline-none focus:border-cyan focus:ring-1 focus:ring-cyan/30"
            />
            {search && filtered.length > 0 && (
              <div className="absolute top-full left-0 mt-1 w-56 bg-surface-200 border border-line-mid rounded-xs shadow-lift z-[--z-dropdown] overflow-hidden">
                {filtered.slice(0, 8).map((a) => (
                  <button
                    key={archKey(a.archetype)}
                    type="button"
                    onClick={() => add(a)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-ink-dim hover:bg-surface-300 hover:text-ink cursor-pointer text-left"
                  >
                    <Art card={faceOf(a)} size={24} className="size-6" />
                    <span className="truncate">{nameOf(a)}</span>
                    <span className="ml-auto text-ink-muted signal-sm">{pct(a.metaShare)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {selected.length === 0 ? (
        <p className={NOTE}>Selecione até {MAX_COMPARE} decks acima para comparar as estatísticas lado a lado.</p>
      ) : (
        <div className="overflow-x-auto">
          {/* Header row with deck names */}
          <div
            className="grid gap-px border border-line bg-line"
            style={{ gridTemplateColumns: `minmax(120px, 1.2fr) ${selected.map(() => 'minmax(120px, 1fr)').join(' ')}` }}
          >
            <div className="bg-surface-200 px-3 py-2 text-ink-muted signal-sm">Métrica</div>
            {selected.map((a, i) => (
              <div key={archKey(a.archetype)} className="bg-surface-200 px-3 py-2 flex items-center gap-1.5">
                <span
                  className="size-2 rounded-round flex-none"
                  style={{ background: `var(--color-${PALETTE[i]})` }}
                />
                <span className="font-semibold text-sm text-ink truncate">{nameOf(a)}</span>
              </div>
            ))}

            {/* Metric rows */}
            {METRICS.map((m) => {
              const bestKey = best(m)
              return (
                <>
                  <div
                    key={`label-${m.label}`}
                    className="bg-surface-100 px-3 py-2.5 text-xs text-ink-muted border-t border-line"
                  >
                    {m.label}
                  </div>
                  {selected.map((a) => {
                    const v = m.value(a)
                    const key = archKey(a.archetype)
                    const isBest = bestKey === key
                    const mx = maxVal(m)
                    return (
                      <div
                        key={`${m.label}-${key}`}
                        className={twMerge(
                          'bg-surface-100 px-3 py-2.5 flex flex-col gap-1 border-t border-line',
                          isBest && 'bg-ground-win',
                        )}
                      >
                        <span
                          className={twMerge(
                            'font-bold tabular-nums text-sm',
                            isBest ? 'text-win' : 'text-ink',
                          )}
                        >
                          {m.format(v)}
                          {isBest && (
                            <Icon icon="mdi:crown" className="ml-1 text-xs text-gold inline align-[-1px]" />
                          )}
                        </span>
                        {v != null && (
                          <div className="h-1 bg-surface-300 rounded-round overflow-hidden">
                            <div
                              className="h-1 rounded-round"
                              style={{
                                width: `${Math.min(100, (v / mx) * 100)}%`,
                                background: `var(--color-${PALETTE[selected.indexOf(a)]})`,
                              }}
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </>
              )
            })}
          </div>
        </div>
      )}

      <p className={twMerge(NOTE, 'mt-4')}>
        ♛ indica o deck com melhor resultado naquela métrica. Wilson lower: limite inferior do IC 95% — métrica mais conservadora que o win rate bruto.
      </p>
    </Panel>
  )
}
