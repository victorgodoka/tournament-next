import { getTranslations } from 'next-intl/server'
import { Footer } from '@ui/footer'
import { Header } from '@ui/header'
import { pageMetadata } from '@utils/metadata'
import { listTournaments } from '@utils/tournaments'
import type { TournamentPage } from '@utils/types'
import { TournamentBrowser } from './TournamentBrowser'

export async function generateMetadata() {
  const t = await getTranslations('Tournaments.meta')
  return pageMetadata({ title: t('title'), path: '/tournaments', description: t('description') })
}

const EMPTY: TournamentPage = { tournaments: [], nextCursor: null }

/** The page still reads with the API down; the empty state says there is nothing to show. */
const safe = (page: Promise<TournamentPage>) =>
  page.catch((error) => {
    console.error(error)
    return EMPTY
  })

const TournamentsPage = async () => {
  // Independent reads: awaiting them in sequence would cost a round trip for nothing.
  const [live, first] = await Promise.all([safe(listTournaments({ status: 'live' })), safe(listTournaments({ limit: 20 }))])

  return (
    <>
      <Header />
      <main className="flex min-h-dvh flex-col overflow-x-hidden pt-16 pb-[clamp(56px,7vw,96px)]">
        <TournamentBrowser live={live.tournaments[0] ?? null} first={first} />
      </main>
      <Footer />
    </>
  )
}

export default TournamentsPage
