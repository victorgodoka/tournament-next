import { cache } from 'react'
import { getTranslations } from 'next-intl/server'
import { Button } from '@ui/button'
import { Panel } from '@ui/panel'
import { cardsByIds } from '@utils/cards'
import { pageMetadata } from '@utils/metadata'
import type { WikiCard } from '@utils/wiki'
import { getDeck, getSeasons, scopeFrom, seasonOf, statisticsHref } from '@utils/statistics'
import { DeckPage } from '../../DeckPage'
import { StatsShell } from '../../StatsShell'

type Query = { ladder?: string | string[]; season?: string | string[]; window?: string | string[]; band?: string | string[] }
type DeckRouteProps = { params: Promise<{ key: string }>; searchParams: Promise<Query> }

const read = cache(async (key: string, q: string) => {
  const scope = scopeFrom(Object.fromEntries(new URLSearchParams(q)))
  return { scope, result: await getDeck(key, scope) }
})

const load = async ({ params, searchParams }: DeckRouteProps) => {
  const [{ key }, q] = await Promise.all([params, searchParams])
  // The key comes URL-encoded in the path (`482%3E65537`).
  const deck = decodeURIComponent(key)
  return { key: deck, ...(await read(deck, new URLSearchParams(q as Record<string, string>).toString())) }
}

export async function generateMetadata(props: DeckRouteProps) {
  const t = await getTranslations('Statistics.deck')
  const { key, result } = await load(props)
  const name = result.ok ? result.data.deck.name : null
  return pageMetadata({ title: name ? t('metaTitle', { name }) : t('metaFallback'), path: `/statistics/archetypes/${encodeURIComponent(key)}`, description: t('metaDescription', { name: name ?? 'YGO Omega' }) })
}

const DeckRoute = async (props: DeckRouteProps) => {
  const t = await getTranslations('Statistics')
  const { scope, result } = await load(props)
  // The deck's cards come without names, and the season is the one the API read.
  const [seasons, cards] = await Promise.all([getSeasons(), cardsByIds(result.ok ? result.data.cards.map((c) => c.card) : []).catch(() => new Map<number, WikiCard>())])
  const season = seasonOf(seasons, scope)
  if (!result.ok || !season) {
    const gone = !result.ok && result.status === 404
    return (
      <StatsShell>
        <Panel title={gone ? t('jobs.deckGoneTitle') : t('error.title')} className="mt-6">
          <p className="text-ink-dim body">{gone ? t('jobs.deckGone') : t('error.body')}</p>
          <Button size="sm" variant="secondary" href={statisticsHref(scope)} className="mt-4">{t('jobs.back')}</Button>
        </Panel>
      </StatsShell>
    )
  }
  return (
    <StatsShell>
      <DeckPage answer={result.data} season={season} scope={{ ...scope, ladder: season.ladder }} names={Object.fromEntries([...cards].map(([id, card]) => [id, card.name]))} />
    </StatsShell>
  )
}

export default DeckRoute
