import { getTranslations } from 'next-intl/server'
import { pageMetadata } from '@utils/metadata'
import { aggregateEmpty, gatheringSeason, getMeta, getSeasons, scopeFrom } from '@utils/statistics'
import { MetaDashboard } from './MetaDashboard'
import { StatsShell } from './StatsShell'

type StatisticsPageProps = { searchParams: Promise<{ ladder?: string | string[]; season?: string | string[]; window?: string | string[]; band?: string | string[] }> }

export async function generateMetadata() {
  const t = await getTranslations('Statistics.meta')
  return pageMetadata({ title: t('title'), path: '/statistics', description: t('description') })
}

/** The public meta report: `?ladder=`, `?season=`, `?window=` and `?band=` say which. */
const StatisticsPage = async ({ searchParams }: StatisticsPageProps) => {
  let scope = scopeFrom(await searchParams)
  const [seasons, first] = await Promise.all([getSeasons(), getMeta(scope)])
  let result = first
  // A season in its first 48 hours shows a notice instead of its numbers.
  const gathering = gatheringSeason(seasons, scope)
  // No games reach the aggregate band: show every rating, with a note, instead of an empty page.
  const fallback = !gathering && scope.band === 'aggregate' && aggregateEmpty(result)
  if (fallback) {
    scope = { ...scope, band: 'all' }
    result = await getMeta(scope)
  }
  return (
    <StatsShell>
      <MetaDashboard scope={scope} seasons={seasons} result={result} fellBack={fallback && result.ok} gathering={gathering} />
    </StatsShell>
  )
}

export default StatisticsPage
