import Link from 'next/link'
import { useFormatter, useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { Icon } from '@ui/icon'
import { BANLISTS, banlistPath, cardChanges, cardSlug, LATEST_BANLIST, listDate, STATUS_TONE, statusOn, type BanStatus } from '@utils/banlist'

/** One card through every list: a cell per list, then its changes newest first. Renders on the server or in the history panel. */
export const CardStrip = ({ card, selected }: { card: number; selected: number }) => {
  const t = useTranslations('Banlist')
  const format = useFormatter()
  const month = (date: string) => format.dateTime(listDate(date), { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const status = (code: BanStatus) => t(`status.${code}`)
  const slug = cardSlug(card)

  return (
    <>
      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-160 flex-col gap-2">
          <ol className="flex h-8 gap-0.5">
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
          <div className="flex justify-between text-ink-muted signal-sm">
            <span>{t('history.start')}</span>
            <span>{t('history.offList')}</span>
            <span>{month(LATEST_BANLIST.date)}</span>
          </div>
        </div>
      </div>

      <h4 className="sr-only">{t('history.changes')}</h4>
      <ol className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-x-6">
        {cardChanges(card).reverse().map(({ list, from, to }) => (
          <li key={list.date} className="flex items-center gap-3 border-b border-line py-2">
            <Link href={`${banlistPath(list)}#card=${slug}`} className="flex-1 text-ink signal hover:text-cyan">
              <time dateTime={list.date}>{month(list.date)}</time>
            </Link>
            <span className="flex items-center gap-1.5 signal-sm">
              <span className={STATUS_TONE[from].text}>{status(from)}</span>
              <Icon name="right" size={12} className="text-ink-muted" />
              <span className="sr-only">{t('timeline.to')}</span>
              <b className={STATUS_TONE[to].text}>{status(to)}</b>
            </span>
          </li>
        ))}
      </ol>
    </>
  )
}
