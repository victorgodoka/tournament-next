import { getTranslations } from 'next-intl/server'
import { Footer } from '@ui/footer'
import { Header } from '@ui/header'
import { pageMetadata } from '@utils/metadata'
import { getPastSeasons } from '@utils/ranked'
import { getOmegaActivity, getStatistics } from '@utils/statistics'
import { MetaDashboard } from './MetaDashboard'

type StatisticsPageProps = { searchParams: Promise<{ ladder?: string | string[]; season?: string | string[] }> }

export async function generateMetadata() {
  const t = await getTranslations('Statistics.meta')
  return pageMetadata({ title: t('title'), path: '/statistics', description: t('description') })
}

/** The public meta report: `?ladder=` picks the open season, `?season=` a past one of that ladder. */
const StatisticsPage = async ({ searchParams }: StatisticsPageProps) => {
  const q = await searchParams
  const ladder = q.ladder === 'genesys' ? 'genesys' : 'tcg'
  const season = typeof q.season === 'string' && q.season ? q.season : undefined
  const [result, past, omega, open] = await Promise.all([
    getStatistics({ ladder, season }),
    getPastSeasons(ladder).then((p) => p.seasons, () => []),
    getOmegaActivity(),
    // The season select names the open season; on a past one that takes the open report too (cached 5 minutes).
    season ? getStatistics({ ladder }) : null,
  ])
  const openReport = season ? open : result
  const openLabel = openReport?.ok ? openReport.data.season.label : null

  return (
    <>
      <Header />
      <div className="oh-space" style={{ width: '100%', minHeight: '100vh', overflowX: 'clip', color: 'var(--ink)', fontFamily: 'var(--font-sans)' }}>
        {/* 64px clears the fixed header. */}
        <main style={{ width: 'min(var(--container-page), calc(100% - 32px))', margin: '0 auto', padding: '88px 0 96px' }}>
          <MetaDashboard ladder={ladder} season={season} past={past} result={result} omega={omega} openLabel={openLabel} />
        </main>
      </div>
      <Footer />
    </>
  )
}

export default StatisticsPage
