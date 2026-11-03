'use client'

/** One card's page, from `GET /statistics/cards/{id}`: the window's row, then its row in every deck that plays it. */

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Breadcrumbs } from '@ui/breadcrumbs'
import { Panel } from '@ui/panel'
import { StatGrid } from '@ui/stat-grid'
import { deckHref, statisticsHref, type CardAnswer, type Season, type StatisticsScope } from '@utils/statistics'
import { EffectBar } from './EffectBar'
import { DECK_NAME } from './kit'
import { Art, Bar, cardName, fixed, nameOf, NOTE, NUM, num, pct, ROW } from './shared'

const COLS = 'minmax(180px, 1.6fr) minmax(120px, 1fr) 64px 64px minmax(150px, 1.2fr)'
const HEAD = 'grid min-h-9 items-center gap-x-4 border-b border-line-mid bg-surface-200 px-4 text-ink-muted signal-sm'

export const CardPage = ({ answer, season, scope }: { answer: CardAnswer; season: Season; scope: StatisticsScope }) => {
  const t = useTranslations('Statistics.cardPage')
  const tRoot = useTranslations('Statistics')
  const { card, all, byDeck } = answer
  const title = cardName(card)
  const back = statisticsHref(scope)

  return (
    <div className="flex flex-col gap-8">
      <Breadcrumbs items={[{ label: tRoot('header.title'), href: back }, { label: title }]} />

      <Panel tone="steel" label={title}>
        <div className="flex flex-wrap items-center gap-6">
          <Art card={card} size={148} className="size-37 max-[720px]:hidden" />
          <div className="flex min-w-0 flex-col gap-2">
            <span className="text-ink-dim signal">{season.ladder === 'genesys' ? 'Genesys' : 'TCG'} · {season.label} · {t(card.extra ? 'extra' : 'main')}</span>
            <h1 className="display-2 text-ink">{title}</h1>
          </div>
        </div>
      </Panel>

      <StatGrid
        columns={3}
        items={[
          { label: t('inclusion'), value: pct(all.inclusion), hint: t('inclusionHint', { count: num(all.lists) }) },
          { label: t('copies'), value: fixed(all.copies, 1) },
          { label: t('played'), value: pct(all.playRate) },
          { label: t('side'), value: pct(all.sideRate) },
          { label: t('responded'), value: pct(all.activations ? all.responded / all.activations : null), hint: t('respondedHint', { responded: num(all.responded), activations: num(all.activations) }) },
        ]}
      />

      <Panel title={t('byDeck')} meta={num(byDeck.length)}>
        {byDeck.length ? (
          <div className="flex flex-col gap-3">
            <div className="overflow-x-auto">
              <div role="table" aria-label={t('byDeck')} className="min-w-[680px] border border-line">
                <div role="row" className={HEAD} style={{ gridTemplateColumns: COLS }}>
                  <span>{t('cols.deck')}</span><span>{t('cols.inclusion')}</span><span className={NUM}>{t('cols.copies')}</span><span className={NUM}>{t('cols.played')}</span><span>{t('cols.effect')}</span>
                </div>
                {byDeck.map((d) => (
                  <div key={d.key} role="row" className={ROW} style={{ gridTemplateColumns: COLS }}>
                    <span role="cell" className={`${DECK_NAME} font-bold text-ink`}><Link href={deckHref(d.key, scope)} className="hover:text-cyan">{nameOf({ key: d.key, name: d.name ?? null })}</Link></span>
                    <span role="cell"><Bar value={d.inclusion} label={pct(d.inclusion)} w={52} /></span>
                    <span role="cell" className={NUM}>{fixed(d.copies, 1)}</span>
                    <span role="cell" className={NUM}>{pct(d.playRate)}</span>
                    <span role="cell"><EffectBar effect={d.effect} se={d.effectSe} /></span>
                  </div>
                ))}
              </div>
            </div>
            <p className={NOTE}>{t('byDeckNote')}</p>
          </div>
        ) : (
          <p className={NOTE}>{t('empty')}</p>
        )}
      </Panel>
    </div>
  )
}
