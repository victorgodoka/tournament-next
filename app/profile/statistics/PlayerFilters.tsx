'use client'

/** Ladder, season and period of My statistics, in the URL so a link keeps them; on a phone they fold behind one button. */

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { FilterFold, Label, LocalTime, NARROW, SelectBox, Seg, WIDE } from '@app/statistics/kit'
import type { PlayerPeriod } from '@utils/statistics'
import type { RankedLadderId } from '@utils/types'
import type { SeasonChoice } from './PlayerStatistics'

const LADDERS = [
  { id: 'tcg', format: 'TCG' },
  { id: 'genesys', format: 'Genesys' },
] as const

type Props = {
  base: string
  choices: SeasonChoice[]
  season?: string
  ladder: RankedLadderId
  period: PlayerPeriod
  /** The picked season's first day (ISO) and the build the numbers come from. */
  startsAt?: string | null
  builtAt?: string | null
}

export const PlayerFilters = ({ base, choices, season, ladder, period, startsAt, builtAt }: Props) => {
  const t = useTranslations('PlayerStatistics.my.filters')
  const locale = useLocale()
  const router = useRouter()
  const [pending, start] = useTransition()
  const format = LADDERS.find((l) => l.id === ladder)!.format
  const seasons = choices.filter((c) => c.format === format)
  const current = seasons.find((c) => c.code === season) ?? seasons.find((c) => c.open) ?? seasons[0]
  const go = (params: Record<string, string>) => start(() => router.push(`${base}?${new URLSearchParams(params)}`, { scroll: false }))
  // The last 7 days only mean something in the open season; a closed one reads whole.
  const live = current?.open ?? true
  const shown: PlayerPeriod = live ? period : 'season'
  const keepPeriod = (open = true): Record<string, string> => (shown === 'last7' && open ? { period: shown } : {})
  const pickLadder = (id: RankedLadderId) => {
    const f = LADDERS.find((l) => l.id === id)!.format
    const open = choices.find((c) => c.format === f && c.open) ?? choices.find((c) => c.format === f)
    go(open ? { season: open.code, ...keepPeriod(open.open) } : { ladder: id, ...keepPeriod() })
  }
  const pickSeason = (code: string) => go({ season: code, ...keepPeriod(seasons.find((c) => c.code === code)?.open) })
  const pickPeriod = (p: PlayerPeriod) => go({ ...(current ? { season: current.code } : { ladder }), ...(p === 'last7' ? { period: p } : {}) })
  const periodLabel = shown === 'last7' ? t('last7') : t('whole')
  const started = startsAt ? new Date(startsAt).toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' }) : null

  const ladderGroup = (
    <div className="flex flex-col gap-2">
      <Label>{t('ladder')}</Label>
      <div role="group" aria-label={t('ladder')} className="flex gap-1">
        {LADDERS.map((l) => (
          <Seg key={l.id} pressed={l.id === ladder} ladder={l.id} onClick={() => l.id !== ladder && pickLadder(l.id)}>{l.format}</Seg>
        ))}
      </div>
    </div>
  )
  const seasonSelect = (id: string) => (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{t('season')}</Label>
      <SelectBox id={id} value={current?.code ?? ''} onChange={pickSeason} options={seasons.map((c) => ({ value: c.code, label: c.label }))} />
    </div>
  )
  const periodGroup = (
    <div className="flex flex-col gap-2">
      <Label>{t('period')}</Label>
      <div role="group" aria-label={t('period')} className="flex gap-1">
        <Seg pressed={shown === 'season'} onClick={() => shown !== 'season' && pickPeriod('season')}>{t('whole')}</Seg>
        <Seg pressed={shown === 'last7'} disabled={!live} onClick={() => shown !== 'last7' && pickPeriod('last7')} className="disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-ink-muted">{t('last7')}</Seg>
      </div>
    </div>
  )

  return (
    <div aria-busy={pending}>
      <div className={`cut notch flex flex-wrap items-end gap-x-6 gap-y-4 px-6 py-4 [--cut:var(--cut-md)] [--edge:var(--color-line)] [--fill:var(--color-surface-100)] ${WIDE}`}>
        {ladderGroup}
        <div className="max-w-70 flex-[1_1_220px]">{seasonSelect('p-season')}</div>
        {periodGroup}
        <p className="m-0 flex-[1_1_240px] text-[13px] leading-5 text-ink-muted">
          {current && started ? t('note', { label: current.label, date: started }) : null}
          {builtAt ? <> {t.rich('updated', { time: () => <LocalTime iso={builtAt} locale={locale} /> })}</> : null}
        </p>
      </div>
      <div className={NARROW}>
        <FilterFold summary={t('summary', { ladder: format, season: current?.label ?? '', period: periodLabel })} edit={t('edit')} done={t('done')}>
          <div className="cut notch flex flex-col gap-4 p-4 [--cut:var(--cut-md)] [--edge:var(--color-line-mid)] [--fill:var(--color-surface-100)]">
            {ladderGroup}
            {seasonSelect('pm-season')}
            {periodGroup}
          </div>
        </FilterFold>
      </div>
    </div>
  )
}
