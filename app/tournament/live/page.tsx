import { noIndexMetadata } from '@lib/page-metadata'
import { getLiveTournament } from '../tournament.api'
import TournamentPageClient from '../tournament-page.client'
import '../tournament.styles.css'

export const metadata = noIndexMetadata(
  'Live Tournament',
  '/tournament/live',
  'Follow the live Yu-Gi-Oh! tournament on YGO Omega — brackets, standings, and results in real time.',
)

// ISR: cache the live tournament for 5 minutes; the in-page refresh button
// revalidates this path on demand for fresh standings.
export const revalidate = 300

export default async function TournamentLivePage() {
  const result = await getLiveTournament()
  const detail = result.ok && result.data.success ? result.data.data ?? null : null
  const error = detail
    ? null
    : result.ok
      ? 'No live tournament is running right now.'
      : result.message

  return <TournamentPageClient detail={detail} error={error} />
}
