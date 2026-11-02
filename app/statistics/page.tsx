import { getTranslations } from 'next-intl/server'
import { pageMetadata } from '@utils/metadata'
import { bestAgainst, getDeck, getMeta, getSeasons, plainDecks, scopeFrom, type Meta, type Scope } from '@utils/statistics'
import { MetaDashboard } from './MetaDashboard'
import { StatsShell } from './StatsShell'

type StatisticsPageProps = { searchParams: Promise<{ ladder?: string | string[]; season?: string | string[]; window?: string | string[]; band?: string | string[] }> }

/** The contenders for "best against the 5 most played". Each is a request, and the API's limit is per IP, this server's here. */
const CONTENDERS = 8

export async function generateMetadata() {
  const t = await getTranslations('Statistics.meta')
  return pageMetadata({ title: t('title'), path: '/statistics', description: t('description') })
}

/** The matchups aren't in `meta`: they come from the best tiered decks' own answers, cached 5 minutes like it. */
const bestOf = async (meta: Meta, scope: Scope) => {
  const decks = plainDecks(meta.decks)
  const contenders = decks.filter((d) => d.tier !== null).sort((a, b) => b.wrExpected - a.wrExpected).slice(0, CONTENDERS)
  const answers = await Promise.all(contenders.map((d) => getDeck(d.key, scope)))
  return bestAgainst(decks, answers.flatMap((a) => (a.ok ? a.data.matchups : [])))
}

/** The public meta report: `?ladder=`, `?season=`, `?window=` and `?band=` say which. */
const StatisticsPage = async ({ searchParams }: StatisticsPageProps) => {
  const scope = scopeFrom(await searchParams)
  const [seasons, result] = await Promise.all([getSeasons(), getMeta(scope)])
  const best = result.ok ? await bestOf(result.data, scope) : null
  return (
    <StatsShell>
      <MetaDashboard scope={scope} seasons={seasons} result={result} best={best} />
    </StatsShell>
  )
}

export default StatisticsPage
