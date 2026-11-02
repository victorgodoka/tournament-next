'use client'

/** One deck's page, all from `GET /statistics/decks/{key}`: the numbers, its weeks, its matchups and its list. */

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { AdBanner } from '@omega/ads/ad-banner'
import { Breadcrumbs } from '@ui/breadcrumbs'
import { LineChart } from '@ui/chart'
import { Panel } from '@ui/panel'
import { StatGrid } from '@ui/stat-grid'
import { cardHref, CORE_RATE, coreFlex, statisticsHref, weekBand, type CardStat, type DeckAnswer, type Season, type StatisticsScope, type Week } from '@utils/statistics'
import { AgainstList, MatchupList, SamplePanel, TurnOrder } from './DeckBlocks'
import { EffectBar } from './EffectBar'
import { Interval } from './Interval'
import { Art, Bar, cardName, faceOf, fixed, nameOf, NOTE, NUM, num, pct, range, ROW, TierTag } from './shared'

const HEAD = 'grid min-h-9 items-center gap-x-4 border-b border-line-mid bg-surface-200 px-4 text-ink-muted signal-sm'
const BAND_COLS = 'minmax(110px, 1fr) 72px 72px 84px minmax(130px, 1.4fr) 48px'
const CARD_COLS = 'minmax(200px, 2fr) minmax(120px, 1fr) 64px 64px 64px minmax(150px, 1.2fr)'

/** Week 1 to the last, with `null` for a week the deck has no row in: the chart leaves a gap. */
const weeklySeries = (weeks: Week[]) => {
  const last = Math.max(0, ...weeks.map((w) => w.week))
  const rows = Array.from({ length: last }, (_, i) => weeks.find((w) => w.week === i + 1) ?? null)
  return { rows, band: rows.map((w) => (w ? weekBand(w) : null)) }
}

const CardRows = ({ cards, title, names, scope }: { cards: CardStat[]; title: string; names: Record<number, string>; scope: StatisticsScope }) => {
  const t = useTranslations('Statistics.deck.cols')
  return cards.length ? (
    <div className="flex flex-col gap-2">
      <h3 className="text-ink-muted signal-sm">{title} · {cards.length}</h3>
      <div className="overflow-x-auto">
        <div role="table" aria-label={title} className="min-w-[760px] border border-line">
          <div role="row" className={HEAD} style={{ gridTemplateColumns: CARD_COLS }}>
            <span>{t('card')}</span><span>{t('inclusion')}</span><span className={NUM}>{t('copies')}</span><span className={NUM}>{t('side')}</span><span className={NUM}>{t('played')}</span><span>{t('effect')}</span>
          </div>
          {cards.map((c) => {
            const name = cardName({ id: c.card, name: names[c.card] ?? null })
            return (
              <div key={c.card} role="row" className={ROW} style={{ gridTemplateColumns: CARD_COLS }}>
                <span role="cell" className="flex min-w-0 items-center gap-3">
                  <Art card={{ id: c.card, name: null }} size={32} className="size-8" />
                  <Link href={cardHref(c.card, scope)} title={name} className="truncate font-bold text-ink hover:text-cyan">{name}</Link>
                </span>
                <span role="cell"><Bar value={c.inclusion} label={pct(c.inclusion)} w={52} /></span>
                <span role="cell" className={NUM}>{fixed(c.copies, 1)}</span>
                <span role="cell" className={NUM}>{pct(c.sideRate)}</span>
                <span role="cell" className={NUM}>{pct(c.playRate)}</span>
                <span role="cell"><EffectBar effect={c.effect} se={c.effectSe} /></span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  ) : null
}

export const DeckPage = ({ answer, season, scope, names }: { answer: DeckAnswer; season: Season; scope: StatisticsScope; names: Record<number, string> }) => {
  const t = useTranslations('Statistics.deck')
  const tRoot = useTranslations('Statistics')
  const { deck, matchups, cards, weeks, byBand, against, sampleDeck } = answer
  const title = nameOf(deck)
  const back = statisticsHref(scope)
  const { rows, band } = weeklySeries(weeks)
  const { core, flex } = coreFlex(cards)
  const percent = (v: number) => `${(v * 100).toFixed(1)}%`

  return (
    <div className="flex flex-col gap-8">
      <Breadcrumbs items={[{ label: tRoot('header.title'), href: back }, { label: title }]} />

      <Panel tone="steel" label={title}>
        <div className="flex flex-wrap items-start gap-6">
          <Art card={faceOf(answer)} size={148} className="size-37 max-[720px]:hidden" />
          <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-3">
            <span className="text-ink-dim signal">{season.ladder === 'genesys' ? 'Genesys' : 'TCG'} · {season.label}{season.endsAt ? ` · ${t('frozen')}` : ''}</span>
            <h1 className="display-2 text-ink">{title}</h1>
            {deck.tier !== null ? <span className="self-start"><TierTag>{tRoot('play.tier', { tier: deck.tier })}</TierTag></span> : <span className="text-ink-muted signal">{t('noTier')}</span>}
            <Interval lo={deck.wrLo} hi={deck.wrHi} value={deck.wrExpected} className="max-w-md" />
          </div>
        </div>
      </Panel>

      <StatGrid
        columns={3}
        items={[
          { label: t('expected'), value: pct(deck.wrExpected), hint: t('expectedHint', { range: range(deck.wrLo, deck.wrHi) }) },
          { label: t('share'), value: pct(deck.share) },
          { label: t('games'), value: num(deck.games), hint: t('gamesHint', { w: num(deck.wins), l: num(deck.losses), d: num(deck.draws) }) },
          { label: t('players'), value: num(deck.players) },
          { label: t('mirrors'), value: pct(deck.mirrorShare) },
          { label: t('post'), value: pct(deck.postWr), hint: `${t('g1Label')} ${pct(deck.g1Wr)}` },
        ]}
      />

      {rows.length > 1 ? (
        <section className="flex flex-col gap-2">
          <LineChart
            title={t('weeks')}
            labels={rows.map((_, i) => t('week', { week: i + 1 }))}
            series={[
              { name: t('wr'), data: rows.map((w) => w?.wrExpected ?? null) },
              { name: t('lo'), data: band.map((b) => b?.lo ?? null), color: 'line-strong' },
              { name: t('hi'), data: band.map((b) => b?.hi ?? null), color: 'line-strong' },
            ]}
            format={percent}
            area={false}
            directLabels={false}
            height={220}
          />
          <p className={NOTE}>{t('weeksNote')}</p>
        </section>
      ) : null}

      <MatchupList deck={deck} matchups={matchups} scope={scope} />

      <div className="grid grid-cols-1 gap-4 min-[980px]:grid-cols-2">
        <TurnOrder deck={deck} />
        <Panel title={t('g1')}>
          <div className="flex flex-col gap-2">
            {([['g1Label', deck.g1Wr, deck.g1Games], ['post', deck.postWr, deck.postGames]] as const).map(([label, rate, games]) => (
              <div key={label} className="grid grid-cols-[120px_minmax(0,1fr)_64px] items-center gap-3 text-sm text-ink-dim">
                <span>{t(label)}</span>
                <Bar value={rate ?? 0} label={pct(rate)} mark={0.5} />
                <span className={twMerge(NUM, 'text-xs')}>{num(games)}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {byBand.length > 1 ? (
        <Panel title={t('byBand')}>
          <div className="overflow-x-auto">
            <div role="table" aria-label={t('byBand')} className="min-w-[560px] border border-line">
              <div role="row" className={HEAD} style={{ gridTemplateColumns: BAND_COLS }}>
                <span>{t('cols.band')}</span><span className={NUM}>{t('cols.games')}</span><span className={NUM}>{t('cols.expected')}</span><span className={NUM}>{t('cols.interval')}</span><span /><span>{t('cols.tier')}</span>
              </div>
              {byBand.map((b) => (
                <div key={b.band} role="row" className={ROW} style={{ gridTemplateColumns: BAND_COLS }}>
                  <span role="cell" className="font-bold text-ink">{b.band === 'all' ? tRoot('pickers.allName') : b.band === 'aggregate' ? tRoot('pickers.aggregateName') : b.band}</span>
                  <span role="cell" className={NUM}>{num(b.games)}</span>
                  <span role="cell" className={NUM}>{pct(b.wrExpected)}</span>
                  <span role="cell" className={NUM}>{range(b.wrLo, b.wrHi)}</span>
                  <span role="cell"><Interval lo={b.wrLo} hi={b.wrHi} value={b.wrExpected} /></span>
                  <span role="cell">{b.tier !== null ? <TierTag>{tRoot('play.tier', { tier: b.tier })}</TierTag> : null}</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      ) : null}

      <AdBanner id="ad-mid" placement="content" />

      <Panel title={t('cards')} meta={num(cards.length)}>
        {cards.length ? (
          <div className="flex flex-col gap-5">
            <CardRows cards={core} title={t('core')} names={names} scope={scope} />
            <CardRows cards={flex} title={t('flex')} names={names} scope={scope} />
            <p className={NOTE}>{t('coreNote', { rate: pct(CORE_RATE) })} {t('cardsNote')}</p>
          </div>
        ) : (
          <p className={NOTE}>{t('noCards')}</p>
        )}
      </Panel>

      <AgainstList cards={against} />
      {sampleDeck ? <SamplePanel deck={sampleDeck} /> : null}

      <AdBanner id="ad-bottom" placement="content" />
    </div>
  )
}
