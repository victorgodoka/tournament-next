'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Segmented } from '@ui/choice'
import { Select } from '@ui/field'
import { ModeTabs } from '@ui/mode-tabs'
import { statisticsHref, type Meta, type Scope, type Season, type Window } from '@utils/statistics'
import { num } from './shared'

/** Season, period and rating band, kept in the URL. A band may not exist in another season, so a new season starts from the aggregate. */
export const Pickers = ({ scope, seasons, current, bands, aggregateFloor }: { scope: Scope; seasons: Season[]; current?: string; bands: Meta['bands']; aggregateFloor: string }) => {
  const t = useTranslations('Statistics.pickers')
  const router = useRouter()
  const [pending, start] = useTransition()
  const go = (next: Scope) => start(() => router.replace(statisticsHref(next), { scroll: false }))
  const swept = seasons.filter((s) => s.ladder === scope.ladder && s.sweptThrough)

  return (
    <div aria-busy={pending} className="flex flex-wrap items-end gap-4 aria-busy:opacity-60">
      <ModeTabs
        label={t('ladder')}
        items={[{ id: 'tcg', label: 'TCG' }, { id: 'genesys', label: 'Genesys' }] as const}
        value={scope.ladder}
        onChange={(ladder) => go({ ladder, window: scope.window, band: 'aggregate' })}
      />
      {swept.length ? (
        <div className="min-w-48">
          <Select label={t('season')} value={current ?? ''} onChange={(e) => go({ ...scope, season: e.target.value, band: 'aggregate' })} options={swept.map((s) => ({ value: s.code, label: s.label }))} />
        </div>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <span className="text-ink-muted signal-sm">{t('window')}</span>
        <Segmented<Window>
          size="sm"
          label={t('window')}
          options={[{ value: 'season', label: t('windows.season') }, { value: 'last7', label: t('windows.last7') }]}
          value={scope.window}
          onChange={(window) => go({ ...scope, window })}
        />
      </div>
      <div className="min-w-48">
        <Select
          label={t('band')}
          value={scope.band}
          onChange={(e) => go({ ...scope, band: e.target.value })}
          options={bands.map(({ band, games }) => ({
            value: band,
            label: band === 'aggregate' ? t('aggregateOption', { floor: aggregateFloor, games: num(games) }) : band === 'all' ? t('allOption', { games: num(games) }) : t('bandOption', { band, games: num(games) }),
          }))}
        />
      </div>
    </div>
  )
}
