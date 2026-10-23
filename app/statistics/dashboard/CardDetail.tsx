'use client'

import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import type { MostUsedCard } from '@utils/statistics'
import { Art, Bar, NOTE, num, pct } from '../DeepDive'

/** A titled block of `[label, rate, color]` bar rows over a hairline; `null` reads "—" on an empty track. */
const Meter = ({ title, meta, rows, max = 1, mark, children }: {
  title: string
  meta?: React.ReactNode
  rows: [label: string, rate: number | null, color?: string][]
  max?: number
  mark?: number
  children?: React.ReactNode
}) => (
  <div className="flex flex-col gap-3 border-t border-line pt-4">
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-ink-muted signal">{title}</span>
      {meta ? <span className="text-ink-muted signal-sm">{meta}</span> : null}
    </div>
    {children}
    {rows.map(([label, rate, color]) => (
      <div key={label} className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-3 text-[13px] leading-5">
        <span className={twMerge('truncate', rate ? 'font-semibold text-ink-dim' : 'text-ink-muted')}>{label}</span>
        <Bar value={rate ?? 0} max={max} color={color} label={pct(rate)} w={48} mark={mark} />
      </div>
    ))}
  </div>
)

/** Responder categories as the API names them; the labels are card names, the same in every language. */
const RESPONDERS = [
  ['dominus', 'Dominus'],
  ['yokaiGirls', 'Yo-kai Girls'],
  ['psyFrame', 'Psy-Frame'],
  ['calledCrossout', 'Called / Crossout'],
  ['impermanence', 'Impermanence'],
  ['mulcharmy', 'Mulcharmy'],
  ['solemn', 'Solemns'],
] as const

/** One card's season figures, for the drawer: headline rates, decklists, usage, win rate and who answered it. */
export const CardDetail = ({ card }: { card: MostUsedCard }) => {
  const t = useTranslations('Statistics.card')
  const { decklists, usage, winRate, responded } = card.detail
  const sources = [...RESPONDERS.map(([key, label]): [string, number | null, string] => [label, responded[key], 'series-2']), [t('others'), responded.others, 'series-2'] as [string, number | null, string]]
    .sort((a, b) => (b[1] ?? -1) - (a[1] ?? -1))
  return (
    <div className="flex flex-col gap-5">
      <Art card={card} size={480} className="aspect-[2/1] w-full [&_img]:object-[center_30%]" />
      <p className="text-ink-muted signal-sm">{[card.handTrap ? t('handTrap') : null, card.extra ? t('extra') : t('main')].filter(Boolean).join(' · ')}</p>
      <dl className="grid grid-cols-3 gap-px border border-line bg-line">
        {([['popularity', card.popularity], ['usageRate', card.usageRate], ['winRateUsed', card.winRateWhenUsed]] as const).map(([id, rate]) => (
          <div key={id} className="flex min-w-0 flex-col gap-2 bg-surface-100 px-3 pt-3 pb-3.5">
            <dt className="truncate text-ink-muted signal-sm">{t(id)}</dt>
            <dd className="stat text-ink">{pct(rate)}</dd>
          </div>
        ))}
      </dl>
      {card.topArchetypes?.length ? (
        <p className="text-[13px] leading-5 text-ink-dim">
          <span className="text-ink-muted signal-sm">{t('topArchetypes')} </span>
          {card.topArchetypes.join(' · ')}
        </p>
      ) : null}
      <Meter title={t('decklists')} rows={[[t('mainExtra'), decklists.mainExtra], [t('side'), decklists.side, 'series-3']]} />
      <Meter title={t('usage')} meta={t('usageMeta')} rows={[['G1', usage.game1], [t('postSide'), usage.postSide, 'series-3']]} />
      <Meter title={t('winRate')} meta={t('winRateMeta')} mark={0.5} rows={[[t('match'), winRate.match, 'ink-dim'], ['G1', winRate.game1], [t('postSide'), winRate.postSide, 'series-3']]} />
      <Meter title={t('responded')} meta={t('activations', { count: num(responded.activations) })} rows={sources} max={responded.rate || 1}>
        <div className="flex items-baseline gap-3">
          <span className="stat-lg text-ink">{pct(responded.rate)}</span>
          <span className="text-ink-muted signal">{t('respondedHint')}</span>
        </div>
      </Meter>
      <p className={NOTE}>{t('note')}</p>
    </div>
  )
}
