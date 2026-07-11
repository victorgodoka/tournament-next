import { ComingSoonPage } from '@components'
import { noIndexMetadata } from '@lib/page-metadata'
import '../tournament.styles.css'

export const metadata = noIndexMetadata(
  'Live Tournament',
  '/tournament/live',
  'Join live Yu-Gi-Oh! tournaments with real-time brackets on YGO Omega.',
)

const TournamentLivePage = () => {
  return (
    <ComingSoonPage
      title="Live Tournament"
      description="Live tournament brackets are coming soon."
    />
  )
}

export default TournamentLivePage
