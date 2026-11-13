'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { deckHref, statisticsHref, type Meta, type Scope, type Season, type Window } from '@utils/statistics'
import { FilterFold, Label, Seg, SelectBox } from './kit'
import { num } from './shared'

type PickersProps = {
  scope: Scope
  seasons: Season[]
  current?: string
  /** The code of a season still gathering: listed although nothing is swept yet. */
  opening?: string
  bands: Meta['bands']
  aggregateFloor: string
  /** On a deck's page: the filters keep to that deck and there is no season picker. */
  deckKey?: string
}

/** Ladder, season, period and rating band, kept in the URL. A band may not exist in another season, so a new season starts from the aggregate. */
export const Pickers = ({ scope, seasons, current, opening, bands, aggregateFloor, deckKey }: PickersProps) => {
  const t = useTranslations('Statistics.pickers')
  const router = useRouter()
  const [pending, start] = useTransition()
  const go = (next: Scope) => start(() => router.replace(deckKey === undefined ? statisticsHref(next) : deckHref(deckKey, next), { scroll: false }))
  const swept = seasons.filter((s) => s.ladder === scope.ladder && (s.sweptThrough || s.code === opening))
  const prefix = deckKey === undefined ? 'f' : 'd'
  const bandName = (band: string) => (band === 'aggregate' ? t('aggregateName2', { floor: aggregateFloor }) : band === 'all' ? t('allName') : band)
  const ladderName = scope.ladder === 'genesys' ? 'Genesys' : 'TCG'

  const ladder = (
    <div className="flex flex-col gap-2">
      <Label>{t('ladder')}</Label>
      <div role="group" aria-label={t('ladder')} className="flex gap-1">
        <Seg pressed={scope.ladder === 'tcg'} ladder="tcg" onClick={() => go({ ladder: 'tcg', window: scope.window, band: 'aggregate' })}>TCG</Seg>
        <Seg pressed={scope.ladder === 'genesys'} ladder="genesys" onClick={() => go({ ladder: 'genesys', window: scope.window, band: 'aggregate' })}>Genesys</Seg>
      </div>
    </div>
  )
  const season = (id: string) =>
    deckKey === undefined && swept.length ? (
      <div className="flex flex-col gap-2 min-[720px]:max-w-75 min-[720px]:flex-[1_1_240px]">
        <Label htmlFor={id}>{t('season')}</Label>
        <SelectBox id={id} value={current ?? ''} onChange={(code) => go({ ...scope, season: code, band: 'aggregate' })} options={swept.map((s) => ({ value: s.code, label: s.label }))} />
      </div>
    ) : null
  const period = (
    <div className="flex flex-col gap-2">
      <Label>{t('window')}</Label>
      <div role="group" aria-label={t('window')} className="flex gap-1">
        {(['season', 'last7'] as Window[]).map((w) => (
          <Seg key={w} pressed={scope.window === w} onClick={() => go({ ...scope, window: w })}>{t(`windows.${w}`)}</Seg>
        ))}
      </div>
    </div>
  )
  const band = (id: string) => (
    <div className="flex flex-col gap-2 min-[720px]:max-w-60 min-[720px]:flex-[1_1_200px]">
      <Label htmlFor={id}>{t('band')}</Label>
      <SelectBox
        id={id}
        value={scope.band}
        onChange={(value) => go({ ...scope, band: value })}
        options={bands.map(({ band: b, games }) => ({
          value: b,
          label: b === 'aggregate' ? t('aggregateOption', { floor: aggregateFloor, games: num(games) }) : b === 'all' ? t('allOption', { games: num(games) }) : t('bandOption', { band: b, games: num(games) }),
        }))}
      />
    </div>
  )

  return (
    <div aria-busy={pending} className="aria-busy:opacity-60">
      <div className="cut notch hidden flex-wrap items-end gap-x-6 gap-y-5 px-6 py-5 [--cut:var(--cut-md)] [--edge:var(--color-line)] [--fill:var(--color-surface-100)] min-[720px]:flex data-[deck]:gap-y-4 data-[deck]:py-4" data-deck={deckKey === undefined ? undefined : ''}>
        {ladder}
        {season(`${prefix}-season`)}
        {period}
        {band(`${prefix}-band`)}
        <p className="m-0 flex-[1_1_260px] text-[13px] leading-5 text-ink-muted">{deckKey === undefined ? t('bandNote') : t('deckNote')}</p>
      </div>
      <div className="min-[720px]:hidden">
        <FilterFold summary={t('summary', { ladder: ladderName, window: t(`windows.${scope.window}`), band: bandName(scope.band) })} edit={t('edit')} done={t('done')}>
          <div className="cut notch flex flex-col gap-4 p-4 [--cut:var(--cut-md)] [--edge:var(--color-line-mid)] [--fill:var(--color-surface-100)]">
            {ladder}
            {season(`m${prefix}-season`)}
            {period}
            <div className="flex flex-col gap-2">
              {band(`m${prefix}-band`)}
              {deckKey === undefined ? <span className="text-xs leading-4 font-medium text-ink-muted">{t('bandNoteShort')}</span> : null}
            </div>
          </div>
        </FilterFold>
      </div>
    </div>
  )
}
