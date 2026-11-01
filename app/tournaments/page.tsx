import { getTranslations } from 'next-intl/server'
import { Footer } from '@ui/footer'
import { Header } from '@ui/header'
import { log } from '@utils/log'
import { pageMetadata } from '@utils/metadata'
import { getCalendar, getTournament, listTournaments } from '@utils/tournaments'
import type { CalendarEntry, TournamentDetail, TournamentPage } from '@utils/types'
import { TournamentBrowser } from './TournamentBrowser'

export async function generateMetadata() {
  const t = await getTranslations('Tournaments.meta')
  return pageMetadata({ title: t('title'), path: '/tournaments', description: t('description') })
}

const EMPTY: TournamentPage = { tournaments: [], nextCursor: null }
const PAGE_SIZE = 20
const HOUR_MS = 3_600_000
const WEEK_MS = 7 * 24 * HOUR_MS
/** Cards under "Next up". */
const NEXT_UP = 4

/** The page still reads with the API down: a failed call logs and contributes nothing. */
const failed =
  <T,>(call: string, fallback: T) =>
  (error: unknown) => {
    log('error', 'API_ERROR', { call, page: '/tournaments', err: error })
    return fallback
  }

/** The live tournament's whole page: the banner shows its round, the match on the table and the standings. */
const liveDetail = async (page: TournamentPage): Promise<TournamentDetail | null> => {
  const live = page.tournaments[0]
  return live ? getTournament(String(live.id)).catch(failed('GET /tournaments/:id', null)) : null
}

/** The next tournaments on the calendar: up to NEXT_UP within a week. `from` is cut to the hour so the fetch cache holds. */
const upcoming = async (now: Date): Promise<CalendarEntry[]> => {
  const from = new Date(Math.floor(now.getTime() / HOUR_MS) * HOUR_MS)
  const calendar = await getCalendar(from, new Date(from.getTime() + WEEK_MS)).catch(failed('GET /calendar', null))
  return (calendar?.entries ?? [])
    .filter((entry) => entry.status === 'scheduled' && Date.parse(entry.startsAt) >= now.getTime())
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
    .slice(0, NEXT_UP)
}

const load = async () => {
  const now = new Date()
  // Independent reads: awaiting them in sequence would cost a round trip for nothing.
  const [live, first, next] = await Promise.all([
    listTournaments({ status: 'live' }).catch(failed('GET /tournaments?status=live', EMPTY)),
    listTournaments({ limit: PAGE_SIZE }).catch(failed('GET /tournaments', EMPTY)),
    upcoming(now),
  ])
  return { live: await liveDetail(live), first, upcoming: next, now: now.toISOString() }
}

const TournamentsPage = async () => {
  const props = await load()
  return (
    <>
      <Header />
      <main data-clear-gutters className="flex min-h-dvh flex-col overflow-x-hidden pt-16 pb-16">
        <TournamentBrowser {...props} />
      </main>
      <Footer />
    </>
  )
}

export default TournamentsPage
