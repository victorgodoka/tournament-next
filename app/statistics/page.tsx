import { getTranslations } from 'next-intl/server'
import { AdBanner } from '@omega/ads/ad-banner'
import { AdVideo } from '@omega/ads/ad-video'
import { Maintenance } from '@ui/maintenance'
import { pageMetadata } from '@utils/metadata'
import { StatsShell } from './StatsShell'

export async function generateMetadata() {
  const t = await getTranslations('Statistics.meta')
  return pageMetadata({ title: t('title'), path: '/statistics', description: t('description') })
}

/**
 * Down for maintenance: the meta report and its API calls stay off until the site is stable. The ads stay on, under
 * the report's ids; `VIDEO_PAGES` keeps the floating player off here, so without `AdVideo` this page has no video.
 */
const StatisticsPage = () => (
  <StatsShell>
    <Maintenance />
    <AdVideo id="ad-video" className="mx-auto mt-8" />
    <AdBanner id="ad-bottom" placement="content" className="mt-8" />
  </StatsShell>
)

export default StatisticsPage
