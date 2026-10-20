import Link from 'next/link'
import { useFormatter, useTranslations } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { EmptyBox } from '@omega/profile/empty-box'
import { CalendarMonth } from '@omega/tournament/calendar-month'
import { AdBanner } from '@omega/ads/ad-banner'
import { Footer } from '@ui/footer'
import { Header } from '@ui/header'
import { Icon } from '@ui/icon'
import { PageHeader } from '@ui/page-header'
import { pageMetadata } from '@utils/metadata'
import { getCalendar } from '@utils/tournaments'
import type { CalendarEntry } from '@utils/types'

type CalendarRouteProps = { searchParams: Promise<{ month?: string }> }

export async function generateMetadata() {
  const t = await getTranslations('Calendar.meta')
  return pageMetadata({ title: t('title'), path: '/calendar', description: t('description') })
}

/**
 * `?month=2026-10`, or this month. One month is one call: the API takes at most 31 days.
 *
 * ponytail: months are cut in UTC (the server renders without the visitor's zone), so a
 * tournament at 23:00 on the last day in UTC-3 shows in the next month. Cut in the browser if it matters.
 */
const monthOf = (param: string | undefined) => {
  const match = /^(\d{4})-(\d{2})$/.exec(param ?? '')
  const now = new Date()
  const [year, month] = match ? [Number(match[1]), Number(match[2]) - 1] : [now.getUTCFullYear(), now.getUTCMonth()]
  const key = (offset: number) => new Date(Date.UTC(year, month + offset, 1)).toISOString().slice(0, 7)
  return { from: new Date(Date.UTC(year, month, 1)), to: new Date(Date.UTC(year, month + 1, 1)), prev: key(-1), next: key(1) }
}

const CalendarPage = ({ from, prev, next, entries }: ReturnType<typeof monthOf> & { entries: CalendarEntry[] | null }) => {
  const t = useTranslations('Calendar')
  const format = useFormatter()
  const label = format.dateTime(from, { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const step = 'flex items-center gap-1.5 signal-strong text-ink-muted hover:text-ink'

  return (
    <>
      <Header />
      <main className="flex min-h-dvh flex-col overflow-x-hidden pt-16 pb-16">
        <div className="mx-auto flex w-full max-w-page flex-col gap-8 px-gutter">
          <PageHeader
            eyebrow={t('eyebrow')}
            title={label}
            lead={t('lead')}
            end={
              <nav aria-label={t('months')} className="flex items-center gap-5">
                <Link href={`/calendar?month=${prev}`} className={step} rel="prev">
                  <Icon name="left" /> {t('previous')}
                </Link>
                <Link href={`/calendar?month=${next}`} className={step} rel="next">
                  {t('next')} <Icon name="right" />
                </Link>
              </nav>
            }
          />
          <AdBanner id="ad-top" placement="content" />
          {entries === null ? (
            <EmptyBox title={t('failed')} />
          ) : (
            <>
              <CalendarMonth month={from.toISOString().slice(0, 7)} entries={entries} />
              {entries.length ? null : <EmptyBox title={t('empty')} />}
            </>
          )}
          <AdBanner id="ad-bottom" placement="content" />
        </div>
      </main>
      <Footer />
    </>
  )
}

const CalendarRoute = async ({ searchParams }: CalendarRouteProps) => {
  const month = monthOf((await searchParams).month)
  // The page still reads with the API down; the box says so instead of an empty month.
  const entries = await getCalendar(month.from, month.to)
    .then((calendar) => calendar.entries)
    .catch((error) => {
      console.error(error)
      return null
    })
  return <CalendarPage {...month} entries={entries} />
}

export default CalendarRoute
