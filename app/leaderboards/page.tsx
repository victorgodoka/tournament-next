import { pageMetadata } from '@lib/page-metadata'
import { getLeaderboard } from './leaderboards.api'
import LeaderboardsPageClient from './leaderboards-page.client'
import './leaderboards.styles.css'

export const metadata = pageMetadata(
  'Leaderboard',
  'Top 50 ranked duelists in TCG and Genesys formats.',
)

export default async function LeaderboardsPage() {
  const result = await getLeaderboard()

  return (
    <LeaderboardsPageClient
      data={result.ok ? result.data : null}
      error={result.ok ? null : result.message}
    />
  )
}
