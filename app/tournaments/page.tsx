import { getTranslations } from 'next-intl/server'
import { formatDuration } from '@omega/tournament/labels'
import { Footer } from '@ui/footer'
import { Header } from '@ui/header'
import { log } from '@utils/log'
import { pageMetadata } from '@utils/metadata'
import { getTournament, listTournaments } from '@utils/tournaments'
import type { TournamentPage, TournamentSummary } from '@utils/types'
import { TournamentBrowser, type LiveSnapshot } from './TournamentBrowser'

export async function generateMetadata() {
  const t = await getTranslations('Tournaments.meta')
  return pageMetadata({ title: t('title'), path: '/tournaments', description: t('description') })
}

const EMPTY: TournamentPage = { tournaments: [], nextCursor: null }

/** The page still reads with the API down; the empty state says there is nothing to show. */
const safe = (page: Promise<TournamentPage>) =>
  page.catch((error) => {
    log('error', 'API_ERROR', { call: 'GET /tournaments', page: '/tournaments', err: error })
    return EMPTY
  })

/** The live banner's round progress and leader need the tournament page, not just its summary. */
const snapshot = async (tournament: TournamentSummary | undefined): Promise<LiveSnapshot | null> => {
  if (!tournament) return null
  const detail = await getTournament(String(tournament.id)).catch((error) => {
    log('error', 'API_ERROR', { call: 'GET /tournaments/:id', id: tournament.id, page: '/tournaments', err: error })
    return null
  })
  const round = detail?.rounds.at(-1)
  const leader = detail?.standings[0]
  return {
    tournament,
    round: round?.number ?? 0,
    done: round?.matches.filter((match) => match.outcome !== 'unplayed').length ?? 0,
    total: round?.matches.length ?? 0,
    leader: leader ? { name: leader.player.name, points: leader.points } : null,
    elapsed: formatDuration(tournament.startedAt, new Date().toISOString()),
  }
}

const TournamentsPage = async () => {
  // Independent reads: awaiting them in sequence would cost a round trip for nothing.
  const [live, first] = await Promise.all([safe(listTournaments({ status: 'live' })), safe(listTournaments({ limit: 20 }))])

  return (
    <>
      <Header />
      <main data-clear-gutters className="flex min-h-dvh flex-col overflow-x-hidden pt-16 pb-16">
        <TournamentBrowser live={await snapshot(live.tournaments[0])} first={first} />
      </main>
      <Footer />
    </>
  )
}

export default TournamentsPage
