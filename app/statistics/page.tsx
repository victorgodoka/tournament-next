import { Footer } from '@ui/footer'
import { Header } from '@ui/header'
import { pageMetadata } from '@utils/metadata'
import { getPastSeasons } from '@utils/ranked'
import { getOmegaActivity, getStatistics } from '@utils/statistics'
import { MetaStatistics } from './MetaStatistics'

type StatisticsPageProps = { searchParams: Promise<{ ladder?: string | string[]; season?: string | string[] }> }

export const metadata = pageMetadata({
  title: 'Meta statistics',
  path: '/statistics',
  description: 'Archetype shares, win rates, turn order and card choices from every ranked duel of the YGO Omega season.',
})

/** The public meta report: `?ladder=` picks the open season, `?season=` a past one of that ladder. */
const StatisticsPage = async ({ searchParams }: StatisticsPageProps) => {
  const q = await searchParams
  const ladder = q.ladder === 'genesys' ? 'genesys' : 'tcg'
  const season = typeof q.season === 'string' && q.season ? q.season : undefined
  const [result, past, omega] = await Promise.all([
    getStatistics({ ladder, season }),
    getPastSeasons(ladder).then((p) => p.seasons, () => []),
    getOmegaActivity(),
  ])

  return (
    <>
      <Header />
      <div className="oh-space" style={{ width: '100%', minHeight: '100vh', overflowX: 'clip', color: 'var(--ink)', fontFamily: 'var(--font-sans)' }}>
        {/* 64px clears the fixed header. */}
        <main style={{ width: 'min(1280px, calc(100% - 32px))', margin: '0 auto', padding: '104px 0 96px' }}>
          <MetaStatistics ladder={ladder} season={season} past={past} result={result} omega={omega} />
        </main>
      </div>
      <Footer />
    </>
  )
}

export default StatisticsPage
