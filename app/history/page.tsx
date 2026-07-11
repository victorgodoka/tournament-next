import { ComingSoonPage } from '@components'
import { noIndexMetadata } from '@lib/page-metadata'
import './history.styles.css'

export const metadata = noIndexMetadata(
  'Past Tournaments',
  '/history',
  'Browse past Yu-Gi-Oh! tournament results on YGO Omega.',
)

const HistoryPage = () => {
  return (
    <ComingSoonPage
      title="Past Tournaments"
      description="Past tournament results are coming soon."
    />
  )
}

export default HistoryPage
