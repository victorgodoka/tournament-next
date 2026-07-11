import { ComingSoonPage } from '@components'
import { noIndexMetadata } from '@lib/page-metadata'
import './tournament.styles.css'

export const metadata = noIndexMetadata(
  'Tournament',
  '/tournament',
  'Organized Yu-Gi-Oh! tournaments on YGO Omega.',
)

const TournamentPage = () => {
  return (
    <ComingSoonPage
      title="Tournament"
      description="Tournament listings are coming soon."
    />
  )
}

export default TournamentPage
