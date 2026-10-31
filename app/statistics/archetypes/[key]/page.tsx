import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Panel } from '@ui/panel'
import { pageMetadata } from '@utils/metadata'
import { archKey, getStatistics, type DeepDiveMode } from '@utils/statistics'
import { DeckPage } from '../../DeckPage'
import { StatsShell } from '../../StatsShell'

type DeckRouteProps = {
  params: Promise<{ key: string }>
  searchParams: Promise<{ ladder?: string | string[]; season?: string | string[]; mode?: string | string[] }>
}

const parseKey = (key: string) => (/^[1-9]\d{0,8}(-[1-9]\d{0,8})?$/.test(key) ? key.split('-').map(Number) : null)
/** `pure` of one key is the `main` row: the page has one address for it. */
const parseMode = (mode: unknown): DeepDiveMode => (mode === 'general' || mode === 'combined' ? mode : 'main')

const read = async ({ params, searchParams }: DeckRouteProps) => {
  const [{ key }, q] = await Promise.all([params, searchParams])
  const archetype = parseKey(key)
  const ladder = q.ladder === 'genesys' ? ('genesys' as const) : ('tcg' as const)
  const season = typeof q.season === 'string' && q.season ? q.season : undefined
  if (!archetype) notFound()
  return { archetype, ladder, season, mode: parseMode(q.mode), result: await getStatistics({ ladder, season }) }
}

export async function generateMetadata(props: DeckRouteProps) {
  const t = await getTranslations('Statistics.deck')
  const { archetype, mode, result } = await read(props)
  const name = mode === 'main' && result.ok ? result.data.archetypes.find((a) => archKey(a.archetype) === archKey(archetype))?.name : null
  return pageMetadata({ title: name ? t('metaTitle', { name }) : t('metaFallback'), path: `/statistics/archetypes/${archKey(archetype)}`, description: t('metaDescription', { name: name ?? 'YGO Omega' }) })
}

/**
 * A deck of the page's list renders from the cached report, on the server. Any other row is read from the viewer's
 * browser: the API's limit is per IP, and every visitor would share the server's.
 */
const DeckRoute = async (props: DeckRouteProps) => {
  const t = await getTranslations('Statistics.error')
  const { archetype, ladder, season, mode, result } = await read(props)
  if (!result.ok)
    return (
      <StatsShell>
        <Panel title={t('title')} className="mt-6"><p className="text-ink-dim body">{t('body')}</p></Panel>
      </StatsShell>
    )
  const { data } = result
  const key = archKey(archetype)
  const index = data.archetypes.findIndex((a) => archKey(a.archetype) === key)
  const listed = mode === 'main' && index >= 0 ? { ...data.archetypes[index]!, rank: index + 1 } : null
  return (
    <StatsShell>
      <DeckPage
        archetype={archetype}
        mode={mode}
        scope={{ ladder, season }}
        listed={listed}
        season={data.season}
        syncedDays={data.syncedDays.count}
        frozenBeforeModes={!data.views}
        matchups={mode === 'main' ? data.matchups.filter((m) => archKey(m.archetype) === key) : []}
        names={Object.fromEntries(data.archetypes.map((a) => [archKey(a.archetype), a.name]))}
        trend={mode === 'main' ? (data.trends.find((d) => archKey(d.archetype) === key) ?? null) : null}
        sampleDeck={data.sampleDecks?.find((d) => archKey(d.archetype) === key) ?? null}
        ratingTiers={data.ratingTiers ?? []}
      />
    </StatsShell>
  )
}

export default DeckRoute
