import { cache } from 'react'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Button } from '@ui/button'
import { Panel } from '@ui/panel'
import { pageMetadata } from '@utils/metadata'
import { getCard, getSeasons, scopeFrom, seasonOf, statisticsHref } from '@utils/statistics'
import { CardPage } from '../../CardPage'
import { StatsShell } from '../../StatsShell'

type Query = { ladder?: string | string[]; season?: string | string[] }
type CardRouteProps = { params: Promise<{ id: string }>; searchParams: Promise<Query> }

const read = cache(async (id: number, q: string) => {
  let scope = scopeFrom(Object.fromEntries(new URLSearchParams(q)))
  let result = await getCard(id, scope)
  // An empty default aggregate band is not a missing card: read every rating instead.
  if (scope.band === 'aggregate' && !result.ok && result.status === 404) {
    scope = { ...scope, band: 'all' }
    result = await getCard(id, scope)
  }
  return { scope, result }
})

const load = async ({ params, searchParams }: CardRouteProps) => {
  const [{ id: raw }, q] = await Promise.all([params, searchParams])
  const id = /^[1-9]\d{0,9}$/.test(raw) ? Number(raw) : null
  if (!id) notFound()
  return { id, ...(await read(id, new URLSearchParams(q as Record<string, string>).toString())) }
}

export async function generateMetadata(props: CardRouteProps) {
  const t = await getTranslations('Statistics.cardPage')
  const { id, result } = await load(props)
  const name = result.ok ? result.data.card.name : null
  return pageMetadata({ title: name ? t('metaTitle', { name }) : t('metaFallback'), path: `/statistics/cards/${id}`, description: t('metaDescription', { name: name ?? 'YGO Omega' }) })
}

const CardRoute = async (props: CardRouteProps) => {
  const t = await getTranslations('Statistics')
  const { scope, result } = await load(props)
  const season = seasonOf(await getSeasons(), scope)
  if (!result.ok || !season) {
    const gone = !result.ok && result.status === 404
    return (
      <StatsShell>
        <Panel title={gone ? t('jobs.cardGoneTitle') : t('error.title')} className="mt-6">
          <p className="text-ink-dim body">{gone ? t('jobs.cardGone') : t('error.body')}</p>
          <Button size="sm" variant="secondary" href={statisticsHref(scope)} className="mt-4">{t('jobs.back')}</Button>
        </Panel>
      </StatsShell>
    )
  }
  return (
    <StatsShell>
      <CardPage answer={result.data} season={season} scope={{ ...scope, ladder: season.ladder }} />
    </StatsShell>
  )
}

export default CardRoute
