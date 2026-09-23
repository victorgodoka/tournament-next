import Link from 'next/link'
import { headers } from 'next/headers'
import { AnalyticsShell } from '@app/profile/analytics/AnalyticsShell'
import { ExplorationCard } from '@omega/analytics/explorer/exploration-card'
import { EmptyBox } from '@omega/profile/empty-box'
import { duelistName } from '@utils/analytics'
import { getPublicExplorations, getVariables, sharePath } from '@utils/explorations'
import { getGlobalVariables, globalPath, listGlobalExplorations } from '@utils/global-explorer'
import { pageMetadata } from '@utils/metadata'

type AnalyticsFeedProps = { searchParams: Promise<{ before?: string | string[] }> }

export const metadata = pageMetadata({
  title: 'Analytics',
  path: '/analytics',
  description: 'Server-wide ranked analytics — meta share, matchups, engines and hand traps — plus the explorations duelists built from their own games.',
})

/** Every public exploration, newest created first. Paged with `?before=`, one server page at a time. */
const AnalyticsFeed = async ({ searchParams }: AnalyticsFeedProps) => {
  const { before } = await searchParams
  const cursor = typeof before === 'string' && /^\d+$/.test(before) ? before : undefined
  const [page, variables, global, globalVariables] = await Promise.all([
    getPublicExplorations(cursor, (await headers()).get('cookie')),
    getVariables(),
    // The server-wide section is a bonus on top of the feed: a failed read hides it, not the page.
    cursor ? [] : listGlobalExplorations().catch(() => []),
    getGlobalVariables().catch(() => null),
  ])

  return (
    <AnalyticsShell
      eyebrow="Public analytics"
      meta="Ranked games · updates within 5 minutes"
      title="Explorations"
      aside={<p className="max-w-[46ch] text-ink-dim body-sm">Pivots duelists built over their own ranked games and chose to publish. Build yours from your profile&apos;s Analytics page.</p>}
    >
      {global.length && globalVariables ? (
        <section aria-labelledby="server-wide" className="mt-8">
          <h2 id="server-wide" className="text-ink display-4">Server-wide</h2>
          <p className="mt-1.5 max-w-[62ch] text-ink-dim body-sm">
            Every ranked duel, one sample per deck per game: meta share, matchups, engines, techs and hand traps. Built by staff,
            updated once a day.
          </p>
          <ul className="mt-5 grid gap-px border border-line bg-line md:grid-cols-2 xl:grid-cols-3">
            {global.map((e) => (
              <ExplorationCard key={e.id} exploration={e} variables={globalVariables} href={globalPath(e.id)} />
            ))}
          </ul>
          <h2 className="mt-10 text-ink display-4">From duelists</h2>
        </section>
      ) : null}
      {page.explorations.length ? (
        <ul className="mt-8 grid gap-px border border-line bg-line md:grid-cols-2 xl:grid-cols-3">
          {page.explorations.map((e) => (
            <ExplorationCard
              key={e.id}
              exploration={e}
              variables={variables}
              href={e.shareToken ? sharePath(e.shareToken) : `/profile/${e.ownerId}/analytics`}
              owner={{ name: e.coAuthor ? `${duelistName(e.author)} with ${duelistName(e.coAuthor)}` : duelistName(e.author), avatar: e.author.avatar }}
            />
          ))}
        </ul>
      ) : (
        <EmptyBox title={cursor ? 'No older explorations' : 'Nothing published yet'} className="mt-8">
          {cursor ? 'You reached the first exploration ever published.' : 'Public explorations show up here as soon as a duelist publishes one.'}
        </EmptyBox>
      )}

      <nav aria-label="Pages" className="mt-6 flex flex-wrap gap-3">
        {cursor ? (
          <Link href="/analytics" className="flex min-h-11 items-center border border-line px-4 text-ink-dim signal-chip hover:border-ink hover:text-ink">← Newest</Link>
        ) : null}
        {page.nextCursor ? (
          <Link href={`/analytics?before=${page.nextCursor}`} className="flex min-h-11 items-center border border-gold px-4 text-gold signal-chip hover:bg-ground-gold">Older →</Link>
        ) : null}
      </nav>
    </AnalyticsShell>
  )
}

export default AnalyticsFeed
