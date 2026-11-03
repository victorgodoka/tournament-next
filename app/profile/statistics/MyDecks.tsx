'use client'

/** 02 My decks: each deck against an average pilot in the same games, and where the wins above expected come from. */

import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { AdBanner } from '@omega/ads/ad-banner'
import { Art, n, NARROW, NUMERIC, pc, signed, Small, tone, WIDE } from '@app/statistics/kit'
import type { PlayerAnswer } from '@utils/statistics'
import { Verdict } from './Overview'
import { GapLine, WinsBar } from './tracks'
import { deckRecords, gap, readOf } from './view'

const PANEL = 'cut notch [--cut:var(--cut-lg)] [--edge:var(--color-line-mid)] [--fill:var(--color-surface-100)]'
export const TABLE_COLS = 'minmax(240px,1.4fr) 96px 80px 88px minmax(240px,1.6fr) 72px 152px'
const RANGE = 20

/** Column heads of a gap table: the ±20 axis sits over the track column. */
export const GapHeads = ({ first, cols }: { first: string; cols: string }) => {
  const t = useTranslations('PlayerStatistics.my.cols')
  return (
    <div role="row" className="grid min-h-11 items-center bg-surface-200" style={{ gridTemplateColumns: cols }}>
      <span role="columnheader" className="pl-6 text-ink-muted signal">{first}</span>
      <span role="columnheader" className={`text-ink-muted signal ${NUMERIC}`}>{t('games')}</span>
      <span role="columnheader" className={`text-ink-muted signal ${NUMERIC}`}>{t('you')}</span>
      <span role="columnheader" className={`text-gold signal ${NUMERIC}`}>{t('expected')}</span>
      <span role="columnheader" aria-label={t('gapAxis')} className="relative mx-5 block h-11">
        <span className="absolute top-4 left-0 text-ink-muted signal-sm">−20</span>
        <span className="absolute top-4 left-1/2 -translate-x-1/2 text-gold signal-sm">0</span>
        <span className="absolute top-4 right-0 text-ink-muted signal-sm">+20 pts</span>
      </span>
      <span role="columnheader" className={`text-ink-muted signal ${NUMERIC}`}>{t('gap')}</span>
      <span role="columnheader" className={`pr-6 text-ink-muted signal ${NUMERIC}`}>{t('verdict')}</span>
    </div>
  )
}

export const MyDecks = ({ data, name, face }: { data: PlayerAnswer; name: (key: string) => string; face: (key: string) => number | null }) => {
  const t = useTranslations('PlayerStatistics.my.decks')
  const records = deckRecords(data.timeline)
  const rows = data.decks.map((d) => ({ d, g: gap(d.performance), r: records[d.key] ?? { wins: 0, losses: 0, draws: 0, matches: 0 } }))
  const contrib = rows.filter(({ d }) => d.performance.winsAbove !== null).map(({ d }) => ({ key: d.key, wins: d.performance.winsAbove! }))
  const sum = contrib.reduce((s, c) => s + c.wins, 0)
  const range = Math.max(4, Math.ceil(Math.max(...contrib.map((c) => Math.abs(c.wins)), 0) * 1.15))
  const record = (r: { wins: number; losses: number; draws: number }) => t('record', { w: r.wins, l: r.losses, d: r.draws })

  return (
    <>
      <div className="flex flex-col gap-1.5 max-[719px]:gap-1">
        <h2 className="m-0 font-display text-[32px] leading-[1.05] text-ink uppercase max-[719px]:text-[26px]">{t('title')}</h2>
        <p className={`m-0 text-ink-dim ${WIDE}`}>{t('lede')}</p>
        <p className={`m-0 text-sm leading-[22px] text-ink-dim ${NARROW}`}>{t('ledeShort')}</p>
      </div>

      <div className={`${PANEL} pt-1 max-[719px]:pt-0.5`}>
        <div className={`overflow-x-auto ${WIDE}`}>
          <div role="table" aria-label={t('table')} className="grid min-w-240 gap-px bg-line">
            <GapHeads first={t('deck')} cols={TABLE_COLS} />
            {rows.map(({ d, g, r }) => (
              <div key={d.key} role="row" className="grid min-h-16 items-center bg-surface-100 transition-colors duration-[120ms] ease-out hover:bg-surface-300" style={{ gridTemplateColumns: TABLE_COLS }}>
                <span role="cell" className="flex min-w-0 items-center gap-3 pl-6">
                  <Art id={face(d.key)} name={name(d.key)} size={36} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-bold text-ink">{name(d.key)}</span>
                    <Small>{record(r)}</Small>
                  </span>
                </span>
                <span role="cell" className="flex flex-col items-end text-right">
                  <span className="text-ink tabular-nums">{n(d.games)}</span>
                  <Small>{t('matches', { n: r.matches })}</Small>
                </span>
                <span role="cell" className={`font-bold text-ink ${NUMERIC}`}>{g ? pc(g.you) : '–'}</span>
                <span role="cell" className={`text-gold ${NUMERIC}`}>{g ? pc(g.exp) : '–'}</span>
                <span role="cell" className="mx-5 block">{g ? <GapLine gap={g.gap} lo={g.lo} hi={g.hi} read={readOf(d.performance)} range={RANGE} size="row" /> : null}</span>
                <span role="cell" className={twMerge('font-bold', NUMERIC, g ? tone(g.gap) : 'text-draw')}>{g ? signed(g.gap) : '–'}</span>
                <span role="cell" className="flex justify-end pr-6"><Verdict slice={d.performance} /></span>
              </div>
            ))}
          </div>
        </div>
        <div className={`flex flex-wrap items-center gap-x-6 gap-y-2.5 border-t border-line px-6 py-3.5 ${WIDE}`}>
          <span className="flex items-center gap-2 text-ink-muted signal-sm"><span aria-hidden className="h-3.5 w-0.5 bg-gold" />{t('legendPilot')}</span>
          <span className="flex items-center gap-2 text-ink-muted signal-sm"><span aria-hidden className="h-2 w-4.5 rounded-xs bg-[#4a5578]" />{t('legendGap')}</span>
          <Small className="flex-[1_1_260px] text-right">{t('mirrors')}</Small>
        </div>

        <div role="list" className={`grid gap-px bg-line ${NARROW}`}>
          {rows.map(({ d, g, r }) => (
            <div key={d.key} role="listitem" className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 bg-surface-100 px-4 py-3.5">
              <Art id={face(d.key)} name={name(d.key)} size={36} />
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-bold text-ink">{name(d.key)}</span>
                <Small>{g ? <>{pc(g.you)} vs <span className="text-gold">{pc(g.exp)}</span> · {t('games', { n: n(d.games) })}</> : t('games', { n: n(d.games) })}</Small>
              </span>
              <span className="flex flex-col items-end gap-1">
                <span className={twMerge('font-bold tabular-nums', g ? tone(g.gap) : 'text-draw')}>{g ? signed(g.gap) : '–'}</span>
                <Verdict slice={d.performance} short />
              </span>
              {g ? <GapLine gap={g.gap} lo={g.lo} hi={g.hi} read={readOf(d.performance)} range={RANGE} size="list" className="col-span-2 col-start-2" /> : null}
              <Small className="col-span-2 col-start-2">{record(r)} · {t('matches', { n: r.matches })}</Small>
            </div>
          ))}
        </div>
        <div className={`border-t border-line px-4 py-3 ${NARROW}`}><Small>{t('legendShort')}</Small></div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] gap-6 max-[719px]:gap-4">
        {contrib.length ? (
          <div className={`${PANEL} gap-3.5 p-6 max-[719px]:gap-3 max-[719px]:px-4 max-[719px]:py-5`}>
            <h3 className="m-0 font-display text-[22px] leading-[1.1] tracking-[0.01em] text-ink uppercase">{t('contribTitle')}</h3>
            <p className={`m-0 text-[13px] leading-5 text-ink-dim ${WIDE}`}>{t('contribLede', { sum: signed(sum) })}</p>
            <Small className={NARROW}>{t('contribLedeShort', { sum: signed(sum) })}</Small>
            {contrib.map((c) => (
              <div key={c.key}>
                <div className={`grid grid-cols-[28px_minmax(0,1fr)_160px_64px] items-center gap-3 ${WIDE}`}>
                  <Art id={face(c.key)} name={name(c.key)} size={28} />
                  <span className="truncate text-sm text-ink">{name(c.key)}</span>
                  <WinsBar wins={c.wins} range={range} />
                  <span className={twMerge('text-right font-bold tabular-nums', tone(c.wins))}>{signed(c.wins)}</span>
                </div>
                <div className={`grid grid-cols-[28px_minmax(0,1fr)_56px] items-center gap-x-2.5 gap-y-1.5 ${NARROW}`}>
                  <Art id={face(c.key)} name={name(c.key)} size={28} />
                  <span className="truncate text-sm text-ink">{name(c.key)}</span>
                  <span className={twMerge('text-right font-bold', tone(c.wins))}>{signed(c.wins)}</span>
                  <WinsBar wins={c.wins} range={range} compact className="col-span-2 col-start-2" />
                </div>
              </div>
            ))}
          </div>
        ) : null}
        <AdBanner id="ad-profile-decks" placement="content" className="w-full max-w-[300px] justify-self-center" />
      </div>
    </>
  )
}
