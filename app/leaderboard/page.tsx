import { AdBanner } from '@omega/ads/ad-banner'
import { Footer } from '@ui/footer'
import { Header } from '@ui/header'
import { pageMetadata } from '@utils/metadata'
import { getLeaderboard, getPastSeasons } from '@utils/ranked'
import type { LeaderboardPage, RankedFormat, RankedLadderId } from '@utils/types'
import { LeaderboardBrowser, PageHeader } from './LeaderboardBrowser'

export const metadata = pageMetadata({
  title: 'Leaderboard',
  path: '/leaderboard',
  description:
    'The TCG and Genesys ranked ladders of YGO Omega: Elo, tier, season record and win rate for every duelist.',
})

/** The page still renders with the API down; a `null` `syncedAt` tells the board the read failed. */
const safe = (ladder: RankedLadderId, format: RankedFormat): Promise<LeaderboardPage> =>
  getLeaderboard(ladder).catch((error) => {
    console.error(error)
    return { ladder, format, season: null, syncedAt: null, entries: [], nextCursor: null }
  })

/** Without the archive the page is just the live ladders, so a failed read costs only the season select. */
const pastOf = (ladder: RankedLadderId) => getPastSeasons(ladder).then((p) => p.seasons, () => [])

const LeaderboardPageRoute = async () => {
  // One ladder per request, so the two boards are two calls — independent, hence parallel.
  const [tcg, genesys, pastTcg, pastGenesys] = await Promise.all([safe('tcg', 'TCG'), safe('genesys', 'Genesys'), pastOf('tcg'), pastOf('genesys')])

  return (
    <>
      <Header />
      <div className="oh-space" style={{ width: '100%', minHeight: '100vh', overflowX: 'clip', color: 'var(--ink)', fontFamily: 'var(--font-sans)' }}>
        {/* 64px clears the fixed header; the rest is the design's 40px 0 96px. */}
        <main style={{ width: 'min(var(--container-page), calc(100% - 32px))', margin: '0 auto', padding: '104px 0 96px', display: 'flex', flexDirection: 'column', gap: 32 }}>
          <PageHeader
            eyebrow="Ranked"
            title="Leaderboard"
            lead="The top duelists of each ranked ladder, by Elo. TCG and Genesys rank separately, each from its own number one."
          />
          <AdBanner id="ad-top" placement="content" />
          <LeaderboardBrowser initial={{ tcg, genesys }} past={{ tcg: pastTcg, genesys: pastGenesys }} />
          <AdBanner id="ad-bottom" placement="content" />
        </main>
      </div>
      <Footer />
    </>
  )
}

export default LeaderboardPageRoute
