'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button } from '@ui/button'
import { Panel } from '@ui/panel'
import { deckHref, effectPoints, plainDecks, windowDays, type Meta, type Scope } from '@utils/statistics'
import { Interval } from '../Interval'
import { nameOf, NOTE, NUM, num, pct, range, ROW, TierTag } from '../shared'

const SHOWN = 30
const COLS = '32px minmax(170px, 1.6fr) 48px 64px 84px minmax(130px, 1.2fr) 64px 72px 72px'
const HEAD = 'grid min-h-9 items-center gap-x-4 border-b border-line-mid bg-surface-200 px-4 text-ink-muted signal-sm'

/** Every deck by the win rate the model expects against the field. A deck under the floors just has no badge. */
export const WhatToPlay = ({ meta, scope, best }: { meta: Meta; scope: Scope; best: { key: string; wr: number } | null }) => {
  const t = useTranslations('Statistics.play')
  const [all, setAll] = useState(false)
  const decks = plainDecks(meta.decks).sort((a, b) => b.wrExpected - a.wrExpected)
  const bestDeck = best && decks.find((d) => d.key === best.key)
  const first = effectPoints(meta.fit.firstEffect)

  return (
    <Panel title={t('title')} meta={t('meta', { count: num(decks.length) })}>
      {decks.length ? (
        <div className="flex flex-col gap-3">
          {bestDeck ? (
            <p className="border border-line bg-surface-200 px-4 py-3 text-sm text-ink">
              <Link href={deckHref(bestDeck.key, scope)} className="hover:text-cyan">{t('best', { name: nameOf(bestDeck), rate: pct(best.wr) })}</Link>
            </p>
          ) : null}
          <div className="overflow-x-auto">
            <div role="table" aria-label={t('title')} className="min-w-[860px] border border-line">
              <div role="row" className={HEAD} style={{ gridTemplateColumns: COLS }}>
                <span>#</span><span>{t('cols.deck')}</span><span>{t('cols.tier')}</span><span className={NUM}>{t('cols.expected')}</span><span className={NUM}>{t('cols.interval')}</span><span />
                <span className={NUM}>{t('cols.share')}</span><span className={NUM}>{t('cols.games')}</span><span className={NUM}>{t('cols.players')}</span>
              </div>
              {(all ? decks : decks.slice(0, SHOWN)).map((d, i) => (
                <div key={d.key} role="row" className={ROW} style={{ gridTemplateColumns: COLS }}>
                  <span role="cell" className="font-mono text-xs text-ink-muted">{i + 1}</span>
                  <span role="cell" className="truncate font-bold text-ink"><Link href={deckHref(d.key, scope)} className="hover:text-cyan">{nameOf(d)}</Link></span>
                  <span role="cell">{d.tier !== null ? <TierTag>{t('tier', { tier: d.tier })}</TierTag> : null}</span>
                  <span role="cell" className={NUM}><b className="text-ink">{pct(d.wrExpected)}</b></span>
                  <span role="cell" className={NUM}>{range(d.wrLo, d.wrHi)}</span>
                  <span role="cell"><Interval lo={d.wrLo} hi={d.wrHi} value={d.wrExpected} /></span>
                  <span role="cell" className={NUM}>{pct(d.share)}</span>
                  <span role="cell" className={NUM}>{num(d.games)}</span>
                  <span role="cell" className={NUM}>{num(d.players)}</span>
                </div>
              ))}
            </div>
          </div>
          {decks.length > SHOWN ? (
            <Button size="sm" variant="secondary" onClick={() => setAll(!all)} className="self-start">
              {all ? t('showTop', { count: SHOWN }) : t('showAll', { count: num(decks.length) })}
            </Button>
          ) : null}
          <p className={NOTE}>{t('note', { games: num(meta.fit.games), days: windowDays(meta), first: `${first >= 0 ? '+' : '−'}${Math.abs(first).toFixed(1)}` })}</p>
        </div>
      ) : (
        <p className={NOTE}>{t('empty')}</p>
      )}
    </Panel>
  )
}
