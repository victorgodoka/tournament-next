'use client'

/** 04 Progress: the running wins above expected, the season's weeks and the rating. */

import { useLocale, useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { n, NARROW, NUMERIC, pc, signed, Small, tone, WIDE } from '@app/statistics/kit'
import type { PlayerAnswer } from '@utils/statistics'
import type { EloPoint } from '@utils/types'
import { GapLine } from './tracks'
import { eloChart, gap, readOf, runningChart, weekDates } from './view'

const PANEL = 'cut notch [--cut:var(--cut-lg)] [--edge:var(--color-line-mid)] [--fill:var(--color-surface-100)]'
const TITLE = 'm-0 text-ink display-3'
const WEEK_COLS = '1.2fr 72px 72px 80px 1.4fr 72px'
/** The rating with a space for thousands: 1 842. */
const elo = (v: number) => String(v).replace(/(\d)(\d{3})$/, '$1 $2')

export const Progress = ({ data, ladder, history }: { data: PlayerAnswer; ladder: 'TCG' | 'Genesys'; history: EloPoint[] }) => {
  const t = useTranslations('PlayerStatistics.my.progress')
  const locale = useLocale()
  const weeks = data.progress?.weeks ?? []
  const running = data.running ?? []
  const chart = runningChart(running, weeks.map((w) => ({ week: w.week, n: w.n })))
  const wins = signed(chart.end)
  const winsTone = tone(chart.end)
  const rating = eloChart(history.map((p) => p.elo))
  const last = history[history.length - 1]?.elo
  const dates = (firstDay: string) => weekDates(firstDay, data.season?.sweptThrough ?? null, locale, (day) => t('since', { day }))

  return (
    <>
      <div className="flex flex-col gap-1.5 max-[719px]:gap-1">
        <h2 className="m-0 text-ink display-2 max-[719px]:text-[22px]">{t('title')}</h2>
        <p className={`m-0 text-ink-dim ${WIDE}`}>{t('lede')}</p>
        <p className={`m-0 text-sm leading-[22px] text-ink-dim ${NARROW}`}>{t('ledeShort')}</p>
      </div>

      <div className={`${PANEL} gap-4 p-6 max-[719px]:gap-3 max-[719px]:px-4 max-[719px]:py-5`}>
        <div className="flex flex-wrap items-baseline justify-between gap-3 max-[719px]:flex-col max-[719px]:gap-3">
          <h3 className={TITLE}><span className={WIDE}>{t('runTitle')}</span><span className={NARROW}>{t('runTitleShort')}</span></h3>
          <span className="text-sm text-ink-dim">{t.rich('now', { wins, n: n(running.length), g: (c) => <strong className={winsTone}>{c}</strong> })}</span>
        </div>
        {running.length ? (
          <div role="img" aria-label={t('runAria', { wins, n: n(running.length) })} className="flex flex-col gap-2 pl-10 max-[719px]:gap-1.5 max-[719px]:pl-7">
            <div className="relative h-55 max-[719px]:h-42.5">
              {chart.grid.map((g) => (
                <span key={g.value}>
                  <span aria-hidden className={twMerge('absolute inset-x-0 h-0 border-t', g.value === 0 ? 'border-gold' : 'border-line')} style={{ top: g.top }} />
                  <span aria-hidden className={twMerge('absolute -left-10 -mt-1.5 w-8 text-right tracking-[0.04em] signal-sm max-[719px]:-left-7 max-[719px]:w-5.5', g.value === 0 ? 'text-gold' : 'text-ink-muted')} style={{ top: g.top }}>
                    {g.value > 0 ? `+${g.value}` : g.value < 0 ? `−${-g.value}` : '0'}
                  </span>
                </span>
              ))}
              {chart.weekLines.map((left) => <span key={left} aria-hidden className="absolute inset-y-0 w-0 border-l border-dashed border-line-mid" style={{ left }} />)}
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden className="absolute inset-0 size-full overflow-visible">
                <polygon points={chart.area} fill="rgba(0,166,181,0.12)" />
                <polyline points={chart.line} fill="none" stroke="var(--color-series-1)" strokeWidth={2.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              </svg>
              <span aria-hidden className={`absolute right-0 -mr-1.5 size-3 -translate-y-1/2 rounded-full bg-series-1 ${WIDE}`} style={{ top: chart.endTop }} />
            </div>
            <div className="relative h-4 max-[719px]:h-3.5">
              {chart.weekLabels.map((w) => <span key={w.label} aria-hidden className="absolute -translate-x-1/2 whitespace-nowrap text-ink-dim signal-sm" style={{ left: w.left }}>{w.label}</span>)}
            </div>
          </div>
        ) : null}
        <Small className={WIDE}>{t('runNote')}</Small>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,480px),1fr))] gap-6 max-[719px]:gap-4">
        <div className={`${PANEL} pt-6 max-[719px]:pt-4`}>
          <div className="px-6 pb-4 max-[719px]:px-4 max-[719px]:pb-3"><h3 className={TITLE}>{t('weeks')}</h3></div>
          <div role="table" aria-label={t('weeksAria')} className={`grid gap-px border-t border-line bg-line ${WIDE}`}>
            <div role="row" className="grid min-h-10 items-center bg-surface-200" style={{ gridTemplateColumns: WEEK_COLS }}>
              <span role="columnheader" className="pl-6 text-ink-muted signal">{t('cols.week')}</span>
              <span role="columnheader" className={`text-ink-muted signal ${NUMERIC}`}>{t('cols.games')}</span>
              <span role="columnheader" className={`text-ink-muted signal ${NUMERIC}`}>{t('cols.you')}</span>
              <span role="columnheader" className={`text-gold signal ${NUMERIC}`}>{t('cols.expected')}</span>
              <span role="columnheader" className="pl-5 text-ink-muted signal">{t('cols.gap')}</span>
              <span role="columnheader" className="pr-6" />
            </div>
            {weeks.map((w) => {
              const g = gap(w)
              return (
                <div key={w.week} role="row" className="grid min-h-16 items-center bg-surface-100 py-2 transition-colors duration-[120ms] ease-out hover:bg-surface-300" style={{ gridTemplateColumns: WEEK_COLS }}>
                  <span role="cell" className="flex flex-col gap-1 pl-6">
                    <span className="font-bold text-ink">{t('week', { n: w.week })}</span>
                    <Small>{dates(w.firstDay)}</Small>
                  </span>
                  <span role="cell" className={`text-ink-dim ${NUMERIC}`}>{n(w.n)}</span>
                  <span role="cell" className={`font-bold text-ink ${NUMERIC}`}>{g ? pc(g.you) : '–'}</span>
                  <span role="cell" className={`text-gold ${NUMERIC}`}>{g ? pc(g.exp) : '–'}</span>
                  <span role="cell" className="mr-2 ml-5 block">{g ? <GapLine gap={g.gap} lo={g.lo} hi={g.hi} read={readOf(w)} range={20} size="week" /> : null}</span>
                  <span role="cell" className={twMerge('pr-6 font-bold', NUMERIC, g ? tone(g.gap) : 'text-draw')}>{g ? signed(g.gap) : '–'}</span>
                </div>
              )
            })}
          </div>
          <div role="list" className={`grid gap-px border-t border-line bg-line ${NARROW}`}>
            {weeks.map((w) => {
              const g = gap(w)
              return (
                <div key={w.week} role="listitem" className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2.5 bg-surface-100 px-4 py-4">
                  <span className="flex flex-col">
                    <span className="font-bold text-ink">{t('week', { n: w.week })}</span>
                    <Small>{dates(w.firstDay)} · {t('games', { n: n(w.n) })}</Small>
                  </span>
                  <span className="flex flex-col items-end">
                    <span className={twMerge('font-bold', g ? tone(g.gap) : 'text-draw')}>{g ? signed(g.gap) : '–'}</span>
                    {g ? <Small>{pc(g.you)} vs <span className="text-gold">{pc(g.exp)}</span></Small> : null}
                  </span>
                  {g ? <GapLine gap={g.gap} lo={g.lo} hi={g.hi} read={readOf(w)} range={20} size="list" className="col-span-2 h-3.5" /> : null}
                </div>
              )
            })}
          </div>
          <div className={`border-t border-line px-6 py-3.5 ${WIDE}`}><Small>{t('weeksNote')}</Small></div>
        </div>

        <div className={`${PANEL} gap-3.5 p-6 max-[719px]:gap-3 max-[719px]:px-4 max-[719px]:py-5`}>
          <div className="flex items-baseline justify-between gap-3">
            <h3 className={TITLE}>{t('rating', { ladder })}</h3>
            {last !== undefined ? (
              <span className="text-sm text-ink-dim">
                {t.rich(history.length > 1 ? 'ratingDelta' : 'ratingNow', { elo: elo(last), delta: signed(rating.delta, 0), b: (c) => <strong className="text-ink">{c}</strong>, g: (c) => <strong className={tone(rating.delta)}>{c}</strong> })}
              </span>
            ) : null}
          </div>
          {rating.line ? (
            <div role="img" aria-label={t('ratingAria', { ladder, from: elo(history[0]!.elo), to: elo(last!) })} className="pl-11 max-[719px]:pl-10">
              <div className="relative h-37.5 max-[719px]:h-30">
                {rating.grid.map((g) => (
                  <span key={g.value}>
                    <span aria-hidden className="absolute inset-x-0 h-0 border-t border-line" style={{ top: g.top }} />
                    <span aria-hidden className="absolute -left-11 -mt-1.5 w-9 text-right tracking-[0.04em] text-ink-muted signal-sm max-[719px]:-left-10 max-[719px]:w-8.5" style={{ top: g.top }}>{elo(g.value)}</span>
                  </span>
                ))}
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden className="absolute inset-0 size-full overflow-visible">
                  <polyline points={rating.line} fill="none" stroke={ladder === 'TCG' ? 'var(--color-ladder-tcg)' : 'var(--color-ladder-genesys)'} strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                </svg>
              </div>
            </div>
          ) : (
            <Small>{t('noRating')}</Small>
          )}
          <Small className={WIDE}>{t('ratingNote')}</Small>
        </div>
      </div>
    </>
  )
}
