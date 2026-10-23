'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Select } from '@ui/field'
import { ModeTabs } from '@ui/mode-tabs'
import type { RankedLadderId } from '@utils/types'
import type { SeasonChoice } from './PlayerStatistics'

const LADDERS = [
  { id: 'tcg', format: 'TCG' },
  { id: 'genesys', format: 'Genesys' },
] as const

/**
 * Format and season of the ranked block, in the URL so a link keeps them. A format switch opens that
 * ladder's open season; "every season" is `?ladder=`; the third tab is `?view=tournaments`.
 */
export const StatisticsFilters = ({ base, choices, season, ladder, view, keep }: {
  base: string
  choices: SeasonChoice[]
  season?: string
  ladder: RankedLadderId
  /** Ranked (one of the ladders) or the tournaments tab. */
  view: 'ranked' | 'tournaments'
  /** Other params to carry over (the tournaments format). */
  keep: Record<string, string>
}) => {
  const t = useTranslations('PlayerStatistics.filters')
  const router = useRouter()
  const [pending, start] = useTransition()
  const format = LADDERS.find((l) => l.id === ladder)!.format
  const seasons = choices.filter((c) => c.format === format)
  const go = (params: Record<string, string>) => start(() => router.push(`${base}?${new URLSearchParams({ ...keep, ...params })}`, { scroll: false }))

  return (
    <div aria-busy={pending} className="flex flex-wrap items-end gap-4">
      <ModeTabs
        label={t('format')}
        items={[
          ...LADDERS.filter((l) => choices.some((c) => c.format === l.format)).map((l) => ({ id: l.id, label: l.format })),
          { id: 'tournaments', label: t('tournaments') },
        ]}
        value={view === 'tournaments' ? 'tournaments' : ladder}
        onChange={(id) => {
          if (id === 'tournaments') return go({ view: 'tournaments' })
          const open = choices.find((c) => c.format === LADDERS.find((l) => l.id === id)!.format && c.open)
          go(open ? { season: open.code } : { ladder: id })
        }}
      />
      {view === 'ranked' ? (
        <div className="min-w-60">
          <Select
            label={t('season')}
            value={season ?? `ladder:${ladder}`}
            onChange={(e) => go(e.target.value.startsWith('ladder:') ? { ladder: e.target.value.slice(7) } : { season: e.target.value })}
            options={[
              ...seasons.map((c) => ({ value: c.code, label: c.open ? t('open', { label: c.label }) : c.label })),
              { value: `ladder:${ladder}`, label: t('allSeasons') },
            ]}
          />
        </div>
      ) : null}
    </div>
  )
}
