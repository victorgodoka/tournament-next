'use client'

/** Side-by-side figures of up to 3 archetypes; the best of each row gets a star. */

import { Fragment, useState } from 'react'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { Icon } from '@ui/icon'
import { Panel } from '@ui/panel'
import { archKey, type StatArchetype } from '@utils/statistics'
import { Art, faceOf, nameOf, NOTE, num, pct } from '../DeepDive'
import { DeckPicker } from './controls'

const PALETTE = ['series-1', 'series-2', 'series-3'] as const
const MAX_COMPARE = 3

type Metric = { id: string; value: (a: StatArchetype) => number | null; format: (v: number | null) => string; better?: boolean }
const count = (v: number | null) => (v == null ? '—' : num(v))

const METRICS: Metric[] = [
  { id: 'winRate', value: (a) => a.winRate, format: pct, better: true },
  { id: 'wilsonLower', value: (a) => a.wilsonLower, format: pct, better: true },
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

export const DeckComparator = ({ archetypes, preselected = [] }: { archetypes: StatArchetype[]; preselected?: StatArchetype[] }) => {
  const t = useTranslations('Statistics.comparator')
  const [keys, setKeys] = useState(() => preselected.slice(0, MAX_COMPARE).map((a) => archKey(a.archetype)))
  const byKey = new Map(archetypes.map((a) => [archKey(a.archetype), a]))
  const selected = keys.flatMap((k) => byKey.get(k) ?? [])

  const bestOf = (m: Metric) => {
    if (!m.better || selected.length < 2) return null
    let best: StatArchetype | null = null
    for (const a of selected) {
      const v = m.value(a)
      if (v != null && (best === null || v > m.value(best)!)) best = a
    }
    return best
  }

  return (
    <Panel title={t('title')} meta={t('meta', { count: MAX_COMPARE })}>
      <div className="mb-4">
        <DeckPicker pool={archetypes} selected={keys} onChange={setKeys} max={MAX_COMPARE} label={t('add')} removeLabel={(name) => t('remove', { name })} />
      </div>
      {selected.length === 0 ? (
        <p className={NOTE}>{t('empty', { count: MAX_COMPARE })}</p>
      ) : (
        <div className="overflow-x-auto">
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
      )}
    </Panel>
  )
}
