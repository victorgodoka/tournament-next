'use client'

/** One card's page: why it wins, where it's played and what answers it. A card outside the list is calculated on request. */

import { useCallback } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { AdBanner } from '@omega/ads/ad-banner'
import { Breadcrumbs } from '@ui/breadcrumbs'
import { Panel } from '@ui/panel'
import { SectionHead } from '@ui/section-head'
import { StatGrid } from '@ui/stat-grid'
import { cardHref, deckHref, getCard, requestCard, statisticsHref, type CardState, type MostUsedCard, type Statistics, type StatisticsScope } from '@utils/statistics'
import { Art, Bar, cardName, fixed, nameOf, NOTE, num, NUM, pct, ROW } from './DeepDive'
import { JobPanel, useStatsJob } from './StatsJob'

type Ready = Extract<CardState, { status: 'ready' }>

/** A titled block of `[label, rate, color]` bar rows; `null` reads "—" on an empty track. */
const Meter = ({ title, meta, rows, max = 1, mark, children }: {
  title: string
  meta?: React.ReactNode
  rows: [label: string, rate: number | null, color?: string][]
  max?: number
  mark?: number
  children?: React.ReactNode
}) => (
  <Panel title={title} meta={meta}>
    <div className="flex flex-col gap-3">
      {rows.map(([label, rate, color]) => (
        <div key={label} className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-3 text-[13px] leading-5">
          <span className={twMerge('truncate', rate ? 'font-semibold text-ink-dim' : 'text-ink-muted')}>{label}</span>
          <Bar value={rate ?? 0} max={max} color={color} label={pct(rate)} w={48} mark={mark} />
        </div>
      ))}
      {children}
    </div>
  </Panel>
)

/** Responder categories as the API names them; the labels are card names, the same in every language. */
const RESPONDERS = [
  ['calledCrossout', 'Called / Crossout'],
  ['impermanence', 'Impermanence'],
  ['yokaiGirls', 'Ghost girls'],
  ['dominus', 'Dominus'],
  ['mulcharmy', 'Mulcharmy'],
  ['psyFrame', 'PSY-Frame'],
  ['solemn', 'Solemn'],
] as const
const COLORS = ['series-1', 'series-3', 'series-2', 'series-4', 'series-5', 'series-6', 'win', 'line-strong'] as const

const DECK_COLS = 'minmax(200px, 2fr) repeat(4, minmax(80px, 0.8fr))'

const CardReport = ({ card, totalGames, scope }: { card: MostUsedCard; totalGames: number; scope: StatisticsScope }) => {
  const t = useTranslations('Statistics.cardPage')
  const { decklists, usage, winRate, responded } = card.detail
  const delta = card.winRateWith != null && card.winRateWithout != null ? (card.winRateWith - card.winRateWithout) * 100 : null
  const answers = [...RESPONDERS.map(([key, label]): [string, number | null] => [label, responded[key]]), [t('others'), responded.others] as [string, number | null]].sort((a, b) => (b[1] ?? -1) - (a[1] ?? -1))
  const answered = answers.reduce((n, [, rate]) => n + (rate ?? 0), 0)

  return (
    <div className="flex flex-col gap-12">
      <div className="grid grid-cols-1 gap-4 min-[980px]:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Panel title={t('inDeckTitle')}>
          <div className="flex flex-wrap items-end gap-6">
            <div className="flex flex-col gap-1"><span className="text-ink-muted signal-sm">{t('inDeck')}</span><span className="text-ink stat-lg">{pct(card.winRateWith)}</span></div>
            <div className="flex flex-col gap-1"><span className="text-ink-muted signal-sm">{t('notInDeck')}</span><span className="text-ink-dim stat-lg">{pct(card.winRateWithout)}</span></div>
            {delta != null ? <span className={twMerge('signal-strong', delta > 0 ? 'text-win' : delta < 0 ? 'text-loss' : 'text-ink-muted')}>{t('delta', { points: `${delta >= 0 ? '+' : '−'}${Math.abs(delta).toFixed(1)}` })}</span> : null}
          </div>
          <p className={twMerge(NOTE, 'mt-3')}>{t('inDeckNote')}</p>
        </Panel>
        <StatGrid
          columns={2}
          items={[
            { label: t('popularity'), value: pct(card.popularity), hint: t('popularityHint') },
            { label: t('deckGames'), value: `≈ ${num(Math.round(card.popularity * totalGames))}`, hint: t('deckGamesHint') },
            { label: t('usage'), value: pct(card.usageRate), hint: t('usageHint') },
            { label: t('wrUsed'), value: pct(card.winRateWhenUsed), hint: t('wrUsedHint') },
          ]}
        />
      </div>

      <section className="flex flex-col gap-4">
        <SectionHead ruled num="01" end={t('whereEnd')}>{t('where')}</SectionHead>
        <div className="grid grid-cols-1 gap-4 min-[980px]:grid-cols-3">
          <Meter title={t('mainOrSide')} rows={[[t('mainExtra'), decklists.mainExtra], [t('side'), decklists.side, 'series-3']]} />
          <Meter title={t('usedIn')} meta={t('usedInMeta')} rows={[[t('game1'), usage.game1], [t('postSide'), usage.postSide, 'series-3']]} />
          <Meter title={t('wrWhenUsed')} meta={t('tick')} mark={0.5} rows={[[t('match'), winRate.match, 'ink-dim'], [t('game1'), winRate.game1], [t('postSide'), winRate.postSide, 'series-3']]} />
        </div>
        <p className={NOTE}>{t('whereNote')}</p>
      </section>

      <AdBanner id="ad-mid" placement="content" />

      <section className="flex flex-col gap-4">
        <SectionHead ruled num="02" end={t('activations', { count: num(responded.activations) })}>{t('answered')}</SectionHead>
        {responded.rate == null ? (
          <p className={NOTE}>{t('notEnough')}</p>
        ) : (
          <Panel>
            <div className="flex flex-col gap-4">
              <div className="flex items-baseline gap-3">
                <span className="text-ink stat-lg">{pct(responded.rate)}</span>
                <span className="text-ink-muted signal">{t('answeredHint')}</span>
              </div>
              <div role="img" aria-label={answers.map(([label, rate]) => `${label} ${pct(rate)}`).join(', ')} className="flex h-6 gap-0.5">
                {answers.map(([label, rate], i) => (rate ? <span key={label} style={{ width: `${(rate / (answered || 1)) * 100}%`, background: `var(--color-${COLORS[i]})` }} /> : null))}
              </div>
              <ul className="grid grid-cols-1 gap-x-6 gap-y-2 min-[720px]:grid-cols-2">
                {answers.map(([label, rate], i) => (
                  <li key={label} className="flex items-center gap-2 text-[13px] leading-5 text-ink-dim">
                    <span aria-hidden className="size-2 flex-none" style={{ background: `var(--color-${COLORS[i]})` }} />
                    {label}
                    <span className="ml-auto font-mono text-ink tabular-nums">{pct(rate)}</span>
                  </li>
                ))}
              </ul>
              {responded.exact?.length ? (
                <div className="flex flex-col gap-2 border-t border-line pt-4">
                  <span className="text-ink-muted signal">{t('exact')}</span>
                  <ol className="grid grid-cols-1 gap-x-6 gap-y-1.5 min-[720px]:grid-cols-2">
                    {responded.exact.map((c) => (
                      <li key={c.id} className="flex items-center gap-2 text-[13px] leading-5">
                        <Link href={cardHref(c.id, scope)} className="truncate text-ink hover:text-cyan">{cardName(c)}</Link>
                        <span className="ml-auto font-mono text-ink-dim tabular-nums">{pct(c.share)}</span>
                      </li>
                    ))}
                  </ol>
                  <p className={NOTE}>{t('exactNote')}</p>
                </div>
              ) : null}
            </div>
          </Panel>
        )}
      </section>

      {card.topArchetypes?.length ? (
        <section className="flex flex-col gap-4">
          <SectionHead ruled num="03">{t('whoPlays')}</SectionHead>
          <p className="text-ink-dim body">{card.topArchetypes.join(' · ')}</p>
          {card.byArchetype?.length ? (
            <div className="overflow-x-auto">
              <div role="table" aria-label={t('inEachDeck')} className="min-w-[620px] border border-line">
                <div role="row" className="grid min-h-9 items-center gap-x-4 border-b border-line-mid bg-surface-200 px-4 text-ink-muted signal-sm" style={{ gridTemplateColumns: DECK_COLS }}>
                  <span>{t('cols.deck')}</span><span className={NUM}>{t('cols.inLists')}</span><span className={NUM}>{t('cols.copies')}</span><span className={NUM}>{t('cols.usage')}</span><span className={NUM}>{t('cols.wrInDeck')}</span>
                </div>
                {card.byArchetype.map((d) => (
                  <div key={d.archetype.join('-')} role="row" className={ROW} style={{ gridTemplateColumns: DECK_COLS }}>
                    <span role="cell" className="truncate font-bold text-ink"><Link href={deckHref(d.archetype, scope)} className="hover:text-cyan">{nameOf(d)}</Link></span>
                    <span role="cell" className={NUM}>{pct(d.inclusion)}</span>
                    <span role="cell" className={NUM}>{fixed(d.copies, 2)}</span>
                    <span role="cell" className={NUM}>{pct(d.usage)}</span>
                    <span role="cell" className={NUM}>{pct(d.winRateInDeck)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <AdBanner id="ad-bottom" placement="content" />
    </div>
  )
}

const CardJob = ({ code, id, name, back, totalGames, scope }: { code: string; id: number; name: string; back: string; totalGames: number; scope: StatisticsScope }) => {
  const read = useCallback((signal: AbortSignal) => getCard(code, id, signal), [code, id])
  const request = useCallback(() => requestCard(code, id), [code, id])
  const { state, failed, retry, calculate } = useStatsJob<Ready>(read, request)
  if (state?.status === 'ready' && failed === null) return <CardReport card={state.card} totalGames={totalGames} scope={scope} />
  return <JobPanel kind="card" name={name} state={state?.status === 'ready' ? null : state} failed={failed} onRetry={retry} onCalculate={calculate} back={back} />
}

export const CardPage = ({ id, scope, listed, season, totalGames }: { id: number; scope: StatisticsScope; listed: MostUsedCard | null; season: Statistics['season']; totalGames: number }) => {
  const t = useTranslations('Statistics.cardPage')
  const tRoot = useTranslations('Statistics')
  const back = statisticsHref(scope)
  const title = listed ? cardName(listed) : `#${id}`
  return (
    <div className="flex flex-col gap-10">
      <Breadcrumbs items={[{ label: tRoot('header.title'), href: back }, { label: t('crumb'), href: `${back}&section=cards` }, { label: title }]} />
      <Panel tone="steel" label={title}>
        <div className="flex flex-wrap items-center gap-6">
          <Art card={{ id, name: listed?.name ?? null }} size={148} className="size-37" />
          <div className="flex min-w-0 flex-col gap-2">
            <span className="text-ink-dim signal">{season.ladder === 'genesys' ? 'Genesys' : 'TCG'} · {season.label}</span>
            <h1 className="display-2 text-ink">{title}</h1>
            {listed ? <span className="text-ink-muted signal-sm">{[listed.handTrap ? t('handTrap') : null, listed.extra ? t('extra') : t('main'), String(id)].filter(Boolean).join(' · ')}</span> : null}
          </div>
        </div>
      </Panel>
      {listed ? <CardReport card={listed} totalGames={totalGames} scope={scope} /> : <CardJob key={`${season.code}:${id}`} code={season.code} id={id} name={title} back={back} totalGames={totalGames} scope={scope} />}
    </div>
  )
}
