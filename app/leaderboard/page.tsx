import { Footer } from '@ui/footer'
import { Header } from '@ui/header'
import { pageMetadata } from '@utils/metadata'
import { getLeaderboard, getPastSeasons } from '@utils/ranked'
import type { LeaderboardPage, PastSeason, RankedFormat, RankedLadderId } from '@utils/types'
import { LeaderboardBrowser } from './LeaderboardBrowser'

export const metadata = pageMetadata({
  title: 'Leaderboard',
  path: '/leaderboard',
  description:
    'The TCG and Genesys ranked ladders of YGO Omega: Elo, tier, season record and win rate for every duelist, plus the final results of past seasons.',
})

const empty = (ladder: RankedLadderId, format: RankedFormat): LeaderboardPage => ({
  ladder,
  format,
  season: null,
  syncedAt: null,
  entries: [],
  nextCursor: null,
})

/** The page still renders with the API down; a `null` `syncedAt` tells the empty state the read failed. */
const safe = (ladder: RankedLadderId, format: RankedFormat) =>
  getLeaderboard(ladder).catch((error) => {
    console.error(error)
    return empty(ladder, format)
  })

/** No archive is not worth failing the page over: the live ladder still renders. */
const past = (ladder: RankedLadderId): Promise<PastSeason[]> =>
  getPastSeasons(ladder).then(
    ({ seasons }) => seasons,
    (error) => {
      console.error(error)
      return []
    },
  )

const LeaderboardPageRoute = async () => {
  // One ladder per request, so the two boards are two calls — independent, hence parallel.
  const [tcg, genesys, tcgPast, genesysPast] = await Promise.all([
    safe('tcg', 'TCG'),
    safe('genesys', 'Genesys'),
    past('tcg'),
    past('genesys'),
  ])

  return (
    <>
      <Header />
      <main className="flex min-h-dvh flex-col overflow-x-hidden pt-16 pb-[clamp(56px,7vw,96px)]">
        <LeaderboardBrowser tcg={tcg} genesys={genesys} past={{ tcg: tcgPast, genesys: genesysPast }} />
      </main>
      <Footer />
    </>
  )
}

export default LeaderboardPageRoute
