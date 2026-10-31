import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Panel } from '@ui/panel'
import { pageMetadata } from '@utils/metadata'
import { getStatistics } from '@utils/statistics'
import { CardPage } from '../../CardPage'
import { StatsShell } from '../../StatsShell'

type CardRouteProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ ladder?: string | string[]; season?: string | string[] }>
}

const read = async ({ params, searchParams }: CardRouteProps) => {
  const [{ id: raw }, q] = await Promise.all([params, searchParams])
  const id = /^[1-9]\d{0,11}$/.test(raw) ? Number(raw) : null
  const ladder = q.ladder === 'genesys' ? ('genesys' as const) : ('tcg' as const)
  const season = typeof q.season === 'string' && q.season ? q.season : undefined
  if (!id) notFound()
  const result = await getStatistics({ ladder, season })
  const listed = result.ok ? ([...result.data.mostUsed.main, ...result.data.mostUsed.extra].find((c) => c.id === id) ?? null) : null
  return { id, ladder, season, result, listed }
}

export async function generateMetadata(props: CardRouteProps) {
  const t = await getTranslations('Statistics.cardPage')
  const { id, listed } = await read(props)
  const name = listed?.name
  return pageMetadata({ title: name ? t('metaTitle', { name }) : t('metaFallback'), path: `/statistics/cards/${id}`, description: t('metaDescription', { name: name ?? 'YGO Omega' }) })
}

/** A card of the season's list renders from the cached report; any other is read from the viewer's browser. */
const CardRoute = async (props: CardRouteProps) => {
  const t = await getTranslations('Statistics.error')
  const { id, ladder, season, result, listed } = await read(props)
  return (
    <StatsShell>
      {result.ok ? (
        <CardPage id={id} scope={{ ladder, season }} listed={listed} season={result.data.season} totalGames={result.data.totals.games} />
      ) : (
        <Panel title={t('title')} className="mt-6"><p className="text-ink-dim body">{t('body')}</p></Panel>
      )}
    </StatsShell>
  )
}

export default CardRoute
