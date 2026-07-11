import { pageMetadata } from '@lib/page-metadata'
import { getLeaderboard } from './leaderboards.api'
import { leaderboardJsonLd } from '@lib/json-ld'
import LeaderboardsPageClient from './leaderboards-page.client'
import './leaderboards.styles.css'

export const metadata = pageMetadata({
  title: 'Leaderboard',
  path: '/leaderboards',
  description:
    'Top 50 ranked Yu-Gi-Oh! duelists in TCG and Genesys formats on YGO Omega.',
})

export default async function LeaderboardsPage() {
  const result = await getLeaderboard()
  const leaderboardEntries =
    result.ok ? result.data.TCG.slice(0, 50) : []

  return (
    <>
      {leaderboardEntries.length > 0 ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(leaderboardJsonLd(leaderboardEntries)),
          }}
        />
      ) : null}
      <LeaderboardsPageClient
        data={result.ok ? result.data : null}
        error={result.ok ? null : result.message}
      />
    </>
  )
}
