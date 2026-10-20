import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { LocalTime } from '@omega/profile/local-time'
import { DAY_YEAR, TIME_ONLY, banlistLabel, formatTone } from '@omega/tournament/labels'
import { Chip } from '@ui/chip/chip.component'
import { Eyebrow } from '@ui/eyebrow/eyebrow'
import { AdBanner } from '@omega/ads/ad-banner'
import { Footer } from '@ui/footer'
import { Header } from '@ui/header'
import { pageMetadata } from '@utils/metadata'
import { getScheduled } from '@utils/tournaments'
import type { ScheduledTournament } from '@utils/types'
import { Registration } from './Registration'

type ScheduledRouteProps = { params: Promise<{ id: string }> }

/** The visitor's cookie goes along, so the page knows whether they are registered. */
const load = async (id: string) => getScheduled(id, (await headers()).get('cookie'))

const title = ({ tournament }: ScheduledTournament, fallback: string) => {
  const { format, banlist } = tournament
  return format && banlist ? banlistLabel({ format, banlist }) : (format ?? banlist ?? fallback)
}

export async function generateMetadata({ params }: ScheduledRouteProps) {
  const { id } = await params
  const [page, t] = await Promise.all([load(id), getTranslations('Calendar.scheduled')])
  if (!page) return pageMetadata({ title: t('notFound'), path: `/tournaments/scheduled/${id}`, noIndex: true })
  return pageMetadata({
    title: t('metaTitle', { name: title(page, t('fallbackFormat')) }),
    path: `/tournaments/scheduled/${id}`,
    description: t('metaDescription'),
    // Who signed up changes by the minute and depends on the session: nothing to index.
    noIndex: true,
  })
}

const ScheduledPage = ({ page }: { page: ScheduledTournament }) => {
  const t = useTranslations('Calendar')
  const tt = useTranslations('Tournaments')
  const { tournament } = page

  return (
    <>
      <Header />
      <main className="flex min-h-dvh flex-col overflow-x-hidden pt-16 pb-16">
        <div className="mx-auto flex w-full max-w-page flex-col gap-8 px-gutter pt-8">
          <nav aria-label={tt('detail.breadcrumb')} className="flex items-center gap-2.5 text-ink-muted signal-sm">
            <Link href="/tournaments" className="underline decoration-1 underline-offset-3 hover:decoration-2">
              {tt('detail.breadcrumbRoot')}
            </Link>
            <span aria-hidden>/</span>
            <Link href="/calendar" className="underline decoration-1 underline-offset-3 hover:decoration-2">
              {t('heading')}
            </Link>
            <span aria-hidden>/</span>
            <span aria-current="page">#{tournament.id}</span>
          </nav>

          <header className="flex flex-col gap-3.5">
            <Eyebrow
              tone="gold"
              meta={
                <>
                  <LocalTime iso={tournament.startsAt} options={DAY_YEAR} /> · <LocalTime iso={tournament.startsAt} options={TIME_ONLY} />
                </>
              }
            >
              {t('scheduled.eyebrow')}
            </Eyebrow>
            <h1 className="text-[clamp(36px,5vw,56px)] leading-none text-ink uppercase">
              {title(page, t('fallbackFormat'))} <span className="text-ink-muted">#{tournament.id}</span>
            </h1>
            <div className="flex flex-wrap gap-2">
              {tournament.format ? <Chip tone={formatTone(tournament.format)}>{tournament.format}</Chip> : null}
              <Chip>{tt(`mode.long.${tournament.mode}`)}</Chip>
              {tournament.structure ? <Chip>{t(`structure.${tournament.structure}`)}</Chip> : null}
              {tournament.requiresPass ? <Chip tone="pass">{t('pass')}</Chip> : null}
              {tournament.rewardTp ? <Chip tone="gold">{t('tp')}</Chip> : null}
            </div>
          </header>

          <AdBanner id="ad-top" placement="content" />

          <Registration initial={page} />
        </div>
      </main>
      <Footer />
    </>
  )
}

const ScheduledRoute = async ({ params }: ScheduledRouteProps) => {
  const { id } = await params
  const page = await load(id)
  if (!page) notFound()
  // Linked by staff: the game tournament's own page is the one with standings and rounds.
  if (page.omegaTournamentId !== null) redirect(`/tournament/${page.omegaTournamentId}`)
  return <ScheduledPage page={page} />
}

export default ScheduledRoute
