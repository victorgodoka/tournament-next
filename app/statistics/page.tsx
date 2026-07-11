import { ComingSoonPage } from '@components'
import { noIndexMetadata } from '@lib/page-metadata'
import './statistics.styles.css'

export const metadata = noIndexMetadata(
  'Statistics',
  '/statistics',
  'Yu-Gi-Oh! meta statistics and deck analytics on YGO Omega.',
)

const StatisticsPage = () => {
  return (
    <ComingSoonPage
      title="Statistics"
      description="Meta statistics and deck analytics are coming soon."
    />
  )
}

export default StatisticsPage
