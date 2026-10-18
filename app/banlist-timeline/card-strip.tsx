import Link from 'next/link'
import { useFormatter, useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { BANLISTS, banlistPath, cardChanges, cardSlug, direction, listDate, RESTRICTED, STATUS_TONE, statusOn, YEAR_TICKS, type BanStatus } from '@utils/banlist'
import { StatusShift } from './status-shift'

/**
 * One card through every list: a cell per list on a year axis, then its changes newest first, each a
 * colored step on a rail. Renders on the server (card and wiki pages) or in the history panel.
 */
export const CardStrip = ({ card, selected }: { card: number; selected?: number }) => {
  const t = useTranslations('Banlist')
  const format = useFormatter()
  const month = (date: string) => format.dateTime(listDate(date), { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const status = (code: BanStatus) => t(`status.${code}`)
  const slug = cardSlug(card)

  return (
    <>
      <ul className="flex flex-wrap gap-4 text-ink-dim signal-sm">
        {[...RESTRICTED, 'U' as const].map((code) => (
          <li key={code} className="flex items-center gap-2">
            <span aria-hidden className={twMerge('size-3 rounded-xs', code === 'U' ? 'bg-surface-300' : STATUS_TONE[code].fill)} />
            {code === 'U' ? t('history.offList') : status(code)}
          </li>
        ))}
      </ul>

      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-160 flex-col gap-2">
          <ol className="flex h-10 gap-0.5">
            {BANLISTS.map((list) => {
              const s = statusOn(card, list.index)
              return (
                <li key={list.date} className="flex min-w-0 flex-1">
                  <Link
                    href={`${banlistPath(list)}#card=${slug}`}
                    aria-label={t('history.cell', { label: month(list.date), status: status(s) })}
                    title={t('history.cell', { label: month(list.date), status: status(s) })}
                    className={twMerge(
                      'flex-1 rounded-xs hover:-translate-y-0.5 motion-safe:transition-transform',
                      s === 'U' ? 'bg-surface-300' : STATUS_TONE[s].fill,
                      list.index === selected && 'shadow-focus-ring',
                    )}
                  />
                </li>
              )
            })}
          </ol>
          <div aria-hidden className="flex h-3 gap-0.5">
            {BANLISTS.map((list, i) => (
              <span key={list.date} className="relative min-w-0 flex-1">
                <span className="absolute left-0 whitespace-nowrap text-ink-muted signal-sm">{YEAR_TICKS[i]}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <h4 className="sr-only">{t('history.changes')}</h4>
      <ol className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-x-6">
        {cardChanges(card).reverse().map(({ list, from, to }) => (
          <li
            key={list.date}
            className={twMerge(
              'flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-l-4 border-b-line py-2.5 pl-3',
              direction({ from, to }) === 'down' ? 'border-l-crimson' : 'border-l-win',
            )}
          >
            <Link href={`${banlistPath(list)}#card=${slug}`} className="min-w-0 flex-1 text-ink signal hover:text-cyan">
              <time dateTime={list.date}>{month(list.date)}</time>
            </Link>
            <StatusShift from={from} to={to} />
          </li>
        ))}
      </ol>
    </>
  )
}
