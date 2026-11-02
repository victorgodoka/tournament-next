'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { Panel } from '@ui/panel'
import { deckHref, plainDecks, shareMoves, weekJumps, type Meta, type Scope, type Week } from '@utils/statistics'
import { Bar, nameOf, NOTE, pct, ROW } from '../shared'

const TOP = 12
const COLS = 'minmax(150px, 1.4fr) minmax(130px, 1.4fr) 96px'

/** The deck's weekly share: a line with no axes, on its own scale. */
const Spark = ({ weeks }: { weeks: Week[] }) => {
  if (weeks.length < 2) return <span />
  const W = 96, H = 24
  const first = weeks[0]!.week
  const span = weeks.at(-1)!.week - first || 1
  const max = Math.max(...weeks.map((w) => w.share), 0.001)
  const points = weeks.map((w) => `${((w.week - first) / span) * W},${H - (w.share / max) * H}`).join(' ')
  return <svg aria-hidden width={W} height={H} viewBox={`0 -1 ${W} ${H + 2}`}><polyline points={points} fill="none" className="stroke-series-1" strokeWidth={1.5} /></svg>
}

const Column = ({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) => (
  <div className="flex flex-col gap-2">
    <h3 className="text-ink-muted signal-sm">{title}</h3>
    {children.length ? <ul className="flex flex-col gap-1 text-sm text-ink-dim">{children}</ul> : <p className={NOTE}>{empty}</p>}
  </div>
)

/** Who is on the ladder and which way it is moving. */
export const WhatYouFace = ({ meta, scope }: { meta: Meta; scope: Scope }) => {
  const t = useTranslations('Statistics.face')
  const decks = plainDecks(meta.decks).sort((a, b) => b.share - a.share)
  const top = decks.slice(0, TOP)
  const byKey = new Map(decks.map((d) => [d.key, d]))
  const weeks = meta.weeks.filter((w) => byKey.has(w.key))
  const { risers, fallers } = shareMoves(weeks)
  const jumps = weekJumps(weeks)
  const max = Math.max(...top.map((d) => d.share), 0.01)
  const link = (key: string) => {
    const deck = byKey.get(key)!
    return <Link href={deckHref(key, scope)} className="truncate hover:text-cyan">{nameOf(deck)}</Link>
  }
  const moved = ({ key, delta }: { key: string; delta: number }) => (
    <li key={key} className="flex justify-between gap-3">
      {link(key)}
      <span className={twMerge('shrink-0 font-mono text-xs', delta > 0 ? 'text-win' : 'text-loss')}>{delta > 0 ? '+' : '−'}{(Math.abs(delta) * 100).toFixed(1)}</span>
    </li>
  )

  return (
    <Panel title={t('title')} meta={t('meta')}>
      {top.length ? (
        <div className="flex flex-col gap-6">
          <div className="overflow-x-auto">
            <div role="table" aria-label={t('title')} className="min-w-[480px] border border-line">
              {top.map((d) => (
                <div key={d.key} role="row" className={ROW} style={{ gridTemplateColumns: COLS }}>
                  <span role="cell" className="truncate font-bold text-ink">{link(d.key)}</span>
                  <span role="cell"><Bar value={d.share} max={max} label={pct(d.share)} /></span>
                  <span role="cell" title={t('weekly')}><Spark weeks={weeks.filter((w) => w.key === d.key)} /></span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6 min-[720px]:grid-cols-3">
            <Column title={t('risers')} empty={t('noMoves')}>{risers.map(moved)}</Column>
            <Column title={t('fallers')} empty={t('noMoves')}>{fallers.map(moved)}</Column>
            <Column title={t('jumps')} empty={t('noJumps')}>
              {jumps.map((w) => (
                <li key={w.key} className="flex justify-between gap-3">
                  {link(w.key)}
                  <span className={twMerge('shrink-0 text-xs', w.jump > 0 ? 'text-win' : 'text-loss')}>{t(w.jump > 0 ? 'stronger' : 'weaker')}</span>
                </li>
              ))}
            </Column>
          </div>
          <p className={NOTE}>{t('movesNote')} {t('jumpsNote')}</p>
        </div>
      ) : (
        <p className={NOTE}>{t('empty')}</p>
      )}
    </Panel>
  )
}
