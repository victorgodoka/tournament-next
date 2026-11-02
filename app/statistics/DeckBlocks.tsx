'use client'

/** The pieces "How to beat a deck" and the deck page both show. */

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { Switch } from '@ui/choice'
import { Panel } from '@ui/panel'
import { deckHref, matchupCall, MIN_MATCHUP_GAMES, type AgainstCard, type DeckStat, type Matchup, type SampleCard, type SampleDeck, type StatisticsScope } from '@utils/statistics'
import { Interval } from './Interval'
import { Art, Bar, cardName, nameOf, NOTE, NUM, num, pct, range, ROW } from './shared'

const MATCH_COLS = 'minmax(170px, 1.6fr) 64px 84px minmax(130px, 1.2fr) 64px 64px 64px 64px'
const HEAD = 'grid min-h-9 items-center gap-x-4 border-b border-line-mid bg-surface-200 px-4 text-ink-muted signal-sm'

/** Worst for the deck first: what beats it. Under `MIN_MATCHUP_GAMES` a row is hidden until asked for. */
export const MatchupList = ({ deck, matchups, scope }: { deck: DeckStat; matchups: Matchup[]; scope: StatisticsScope }) => {
  const t = useTranslations('Statistics.matchups')
  const [small, setSmall] = useState(false)
  const rows = matchups.filter((m) => small || m.games >= MIN_MATCHUP_GAMES).sort((a, b) => a.wrAdjusted - a.wrExpected - (b.wrAdjusted - b.wrExpected))
  const anySmall = matchups.some((m) => m.games < MIN_MATCHUP_GAMES)
  return (
    <Panel title={t('title')} meta={num(matchups.length)}>
      <div className="flex flex-col gap-3">
        {rows.length ? (
          <div className="overflow-x-auto">
            <div role="table" aria-label={t('title')} className="min-w-[820px] border border-line">
              <div role="row" className={HEAD} style={{ gridTemplateColumns: MATCH_COLS }}>
                <span>{t('cols.opponent')}</span><span className={NUM}>{t('cols.rate')}</span><span className={NUM}>{t('cols.interval')}</span><span />
                <span className={NUM}>{t('cols.expected')}</span><span className={NUM}>{t('cols.games')}</span><span className={NUM}>{t('cols.first')}</span><span className={NUM}>{t('cols.second')}</span>
              </div>
              {rows.map((m) => {
                const name = nameOf({ key: m.opponent, name: m.opponentName })
                const call = matchupCall(m)
                return (
                  <div key={m.opponent} role="row" className={ROW} style={{ gridTemplateColumns: MATCH_COLS }}>
                    <span role="cell" className="truncate font-bold text-ink">{m.opponent ? <Link href={deckHref(m.opponent, scope)} className="hover:text-cyan">{name}</Link> : name}</span>
                    <span role="cell" className={twMerge(NUM, 'font-bold', call === 'favorable' ? 'text-win' : call === 'unfavorable' ? 'text-loss' : 'text-ink')}>{pct(m.wrAdjusted)}</span>
                    <span role="cell" className={twMerge(NUM, 'text-xs')}>{range(m.wrLo, m.wrHi)}</span>
                    <span role="cell"><Interval lo={m.wrLo} hi={m.wrHi} value={m.wrAdjusted} expected={m.wrExpected} /></span>
                    <span role="cell" className={twMerge(NUM, 'text-xs')}>{pct(m.wrExpected)}</span>
                    <span role="cell" className={twMerge(NUM, 'text-xs')}>{num(m.games)}</span>
                    <span role="cell" className={twMerge(NUM, 'text-xs')}>{pct(m.firstWr)}</span>
                    <span role="cell" className={twMerge(NUM, 'text-xs')}>{pct(m.secondWr)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <p className={NOTE}>{t('empty')}</p>
        )}
        {anySmall ? <Switch quiet checked={small} onChange={setSmall} label={t('showSmall', { min: MIN_MATCHUP_GAMES })} /> : null}
        <p className={NOTE}>{t('noteOf', { name: nameOf(deck) })}</p>
      </div>
    </Panel>
  )
}

/** First and second in game 1 only: games 2–3 are confounded by the loser's choice. */
export const TurnOrder = ({ deck }: { deck: DeckStat }) => {
  const t = useTranslations('Statistics.turn')
  return (
    <Panel title={t('title')}>
      <div className="flex flex-col gap-2">
        {([['first', deck.firstG1Wr], ['second', deck.secondG1Wr]] as const).map(([side, rate]) => (
          <div key={side} className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-3 text-sm text-ink-dim">
            <span>{t(side)}</span>
            <Bar value={rate ?? 0} label={pct(rate)} mark={0.5} />
          </div>
        ))}
        <p className={NOTE}>{t('note')}</p>
      </div>
    </Panel>
  )
}

const AGAINST_COLS = 'minmax(200px, 2fr) minmax(130px, 1.2fr) 72px 96px'

export const AgainstList = ({ cards }: { cards: AgainstCard[] }) => {
  const t = useTranslations('Statistics.against')
  const max = Math.max(...cards.map((c) => c.rate), 0.01)
  return (
    <Panel title={t('title')}>
      {cards.length ? (
        <div className="flex flex-col gap-3">
          <div className="overflow-x-auto">
            <div role="table" aria-label={t('title')} className="min-w-[560px] border border-line">
              <div role="row" className={HEAD} style={{ gridTemplateColumns: AGAINST_COLS }}>
                <span>{t('cols.card')}</span><span>{t('cols.faced')}</span><span className={NUM}>{t('cols.games')}</span><span className={NUM}>{t('cols.winRate')}</span>
              </div>
              {cards.map((c) => (
                <div key={c.id} role="row" className={ROW} style={{ gridTemplateColumns: AGAINST_COLS }}>
                  <span role="cell" className="flex min-w-0 items-center gap-3">
                    <Art card={c} size={32} className="size-8" />
                    <span title={cardName(c)} className="truncate font-bold text-ink">{cardName(c)}</span>
                  </span>
                  <span role="cell"><Bar value={c.rate} max={max} color="loss" label={pct(c.rate)} w={52} /></span>
                  <span role="cell" className={NUM}>{num(c.games)}</span>
                  <span role="cell" className={twMerge(NUM, 'font-bold text-ink')}>{pct(c.winRate)}</span>
                </div>
              ))}
            </div>
          </div>
          <p className={NOTE}>{t('note')}</p>
        </div>
      ) : (
        <p className={NOTE}>{t('empty')}</p>
      )}
    </Panel>
  )
}

const total = (cards: SampleCard[]) => cards.reduce((n, c) => n + c.count, 0)

const Zone = ({ title, cards }: { title: string; cards: SampleCard[] }) =>
  cards.length ? (
    <div className="flex flex-col gap-2">
      <span className="text-ink-muted signal-sm">{title} · {total(cards)}</span>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2">
        {cards.map((c) => (
          <li key={c.id} title={c.name ?? undefined} className="relative">
            <Art card={c} size={64} className="aspect-square w-full" />
            <span className="absolute right-0.5 bottom-0.5 bg-space-000/85 px-1 font-mono text-[11px] font-bold text-ink">×{c.count}</span>
          </li>
        ))}
      </ul>
    </div>
  ) : null

export const SamplePanel = ({ deck }: { deck: SampleDeck }) => {
  const t = useTranslations('Statistics.sample')
  return (
    <Panel title={t('title')} meta={t('lists', { count: num(deck.lists) })}>
      <div className="flex flex-col gap-5">
        <Zone title={t('main')} cards={deck.main} />
        <Zone title={t('extra')} cards={deck.extra} />
        <Zone title={t('side')} cards={deck.side} />
        {deck.deckId ? <Link href={`/deck-builder/${deck.deckId}`} className="self-start text-[13px] font-semibold text-cyan hover:underline">{t('open')}</Link> : null}
        <p className={NOTE}>{t('note')}</p>
      </div>
    </Panel>
  )
}
