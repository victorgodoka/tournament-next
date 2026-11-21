import { cache } from 'react'
import { getTranslations } from 'next-intl/server'
import { AdminBar } from '@ui/admin-bar'
import { Button } from '@ui/button'
import { Panel } from '@ui/panel'
import { cardsByIds } from '@utils/cards'
import { pageMetadata } from '@utils/metadata'
import type { WikiCard } from '@utils/wiki'
import { getDeck, getMeta, getSeasons, leadOf, plainDecks, scopeFrom, seasonOf, statisticsHref, type Meta } from '@utils/statistics'
import { DeckPage, type Family } from '../../DeckPage'
import { facesOf, nameOf } from '../../format'
import { StatsShell } from '../../StatsShell'

type Query = { ladder?: string | string[]; season?: string | string[]; window?: string | string[]; band?: string | string[] }
type DeckRouteProps = { params: Promise<{ key: string }>; searchParams: Promise<Query> }

const read = cache(async (key: string, q: string) => {
  let scope = scopeFrom(Object.fromEntries(new URLSearchParams(q)))
  let result = await getDeck(key, scope)
  // An empty default aggregate band is not a missing deck: read every rating instead.
  if (scope.band === 'aggregate' && !result.ok && result.status === 404) {
    scope = { ...scope, band: 'all' }
    result = await getDeck(key, scope)
  }
  return { scope, result }
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

/** The deck's lead row (`A*`) and the plain keys it leads, most played first: its versions. */
const familyOf = (key: string, meta: Meta | null): Family | null => {
  if (!meta || !key || key.endsWith('*')) return null
  const lead = leadOf(key)
  const row = meta.decks.find((d) => d.key === `${lead}*`)
  if (!row) return null
  const members = plainDecks(meta.decks).filter((d) => leadOf(d.key) === lead).sort((a, b) => b.share - a.share)
  return { key: row.key, name: nameOf(row), share: row.share, members }
}

const DeckRoute = async (props: DeckRouteProps) => {
  const t = await getTranslations('Statistics')
  const { key, scope, result } = await load(props)
  // The deck's cards come without names or kinds; the season is the one the API read; the meta (cached) has its versions.
  const ids = result.ok ? [...result.data.cards.map((c) => c.card)] : []
  const [seasons, cards, meta] = await Promise.all([getSeasons(), cardsByIds(ids).catch(() => new Map<number, WikiCard>()), getMeta(scope)])
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
  const fit = meta.ok ? meta.data.fit : null
  return (
    <StatsShell>
      <AdminBar reads={`Identified decks › ${result.data.deck.name ?? key}`} href={`/admin/decks/${leadOf(key)}${season.ladder === 'genesys' ? '?ladder=genesys' : ''}`} label="Edit this deck" />
      <DeckPage
        answer={result.data}
        season={season}
        scope={{ ...scope, ladder: season.ladder }}
        cards={Object.fromEntries([...cards].map(([id, c]) => [id, { name: c.name, kind: c.kind, monsterTypes: c.monsterTypes }]))}
        family={familyOf(key, meta.ok ? meta.data : null)}
        builtAt={fit?.builtAt ?? null}
        tiers={fit?.tiers ?? null}
        aggregateFloor={fit?.aggregateFloor ?? ''}
        faces={meta.ok ? facesOf(meta.data.decks) : {}}
      />
    </StatsShell>
  )
}

export default DeckRoute
