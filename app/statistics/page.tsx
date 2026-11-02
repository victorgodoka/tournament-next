import { getTranslations } from 'next-intl/server'
import { pageMetadata } from '@utils/metadata'
import { getMeta, getSeasons, scopeFrom } from '@utils/statistics'
import { MetaDashboard } from './MetaDashboard'
import { StatsShell } from './StatsShell'

type StatisticsPageProps = { searchParams: Promise<{ ladder?: string | string[]; season?: string | string[]; window?: string | string[]; band?: string | string[] }> }

export async function generateMetadata() {
  const t = await getTranslations('Statistics.meta')
  return pageMetadata({ title: t('title'), path: '/statistics', description: t('description') })
}

/** The public meta report: `?ladder=`, `?season=`, `?window=` and `?band=` say which. */
const StatisticsPage = async ({ searchParams }: StatisticsPageProps) => {
  const scope = scopeFrom(await searchParams)
  const [seasons, result] = await Promise.all([getSeasons(), getMeta(scope)])
  return (
    <StatsShell>
      <MetaDashboard scope={scope} seasons={seasons} result={result} />
    </StatsShell>
  )
}

export default StatisticsPage
