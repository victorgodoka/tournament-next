import { getTranslations } from 'next-intl/server'
import { pageMetadata } from '@utils/metadata'
import { getPastSeasons } from '@utils/ranked'
import { archKey, getOmegaActivity, getStatistics } from '@utils/statistics'
import { SECTIONS, type Section } from './dashboard/sections'
import { MetaDashboard } from './MetaDashboard'
import { StatsShell } from './StatsShell'

type StatisticsPageProps = { searchParams: Promise<{ ladder?: string | string[]; season?: string | string[]; section?: string | string[]; decks?: string | string[] }> }

export async function generateMetadata() {
  const t = await getTranslations('Statistics.meta')
  return pageMetadata({ title: t('title'), path: '/statistics', description: t('description') })
}

/** The public meta report: `?ladder=` picks the open season, `?season=` a past one of that ladder. */
const StatisticsPage = async ({ searchParams }: StatisticsPageProps) => {
  const q = await searchParams
  const ladder = q.ladder === 'genesys' ? 'genesys' : 'tcg'
  const season = typeof q.season === 'string' && q.season ? q.season : undefined
  // `?section=` opens the page on that tab; unknown or missing falls back to the first.
  const section = (SECTIONS as readonly string[]).includes(q.section as string) ? (q.section as Section) : undefined
  // `?decks=1-2,3`: archetype keys the comparator opens with (the ranking's Compare buttons).
  const decks = typeof q.decks === 'string' && q.decks ? q.decks.split(',').filter(Boolean) : undefined
  const [result, past, omega, open] = await Promise.all([
    getStatistics({ ladder, season }),
    getPastSeasons(ladder).then((p) => p.seasons, () => []),
    getOmegaActivity(),
    // The season select names the open season; on a past one that takes the open report too (cached 5 minutes).
    season ? getStatistics({ ladder }) : null,
  ])
  // The season before the one on screen: past seasons come newest first, and the open one sits above them.
  const before = past[season ? past.findIndex((s) => s.code === season) + 1 : 0]
  const earlier = before ? await getStatistics({ ladder, season: before.code }) : null
  const previous = earlier?.ok
    ? { label: before!.label, decks: Object.fromEntries(earlier.data.archetypes.map((a) => [archKey(a.archetype), { share: a.metaShare, winRate: a.winRate }])) }
    : null
  const openReport = season ? open : result
  const openLabel = openReport?.ok ? openReport.data.season.label : null

  return (
    <StatsShell>
      <MetaDashboard ladder={ladder} season={season} section={section} decks={decks} past={past} result={result} omega={omega} openLabel={openLabel} previous={previous} />
    </StatsShell>
  )
}

export default StatisticsPage
