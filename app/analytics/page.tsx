import Link from 'next/link'
import { headers } from 'next/headers'
import { AnalyticsShell } from '@app/profile/analytics/AnalyticsShell'
import { ExplorationCard } from '@omega/analytics/explorer/exploration-card'
import { EmptyBox } from '@omega/profile/empty-box'
import { duelistName } from '@utils/analytics'
import { getPublicExplorations, getVariables, sharePath } from '@utils/explorations'
import { pageMetadata } from '@utils/metadata'

type AnalyticsFeedProps = { searchParams: Promise<{ before?: string | string[] }> }

export const metadata = pageMetadata({
  title: 'Analytics',
  path: '/analytics',
  description: 'Explorations duelists built from their ranked games and made public: matchups, card usage, hand traps and rating over the season.',
})

/** Every public exploration, newest created first. Paged with `?before=`, one server page at a time. */
const AnalyticsFeed = async ({ searchParams }: AnalyticsFeedProps) => {
  const { before } = await searchParams
  const cursor = typeof before === 'string' && /^\d+$/.test(before) ? before : undefined
  const [page, variables] = await Promise.all([getPublicExplorations(cursor, (await headers()).get('cookie')), getVariables()])

  return (
    <AnalyticsShell
      eyebrow="Public analytics"
      meta="Ranked games · updates within 5 minutes"
      title="Explorations"
      aside={<p className="max-w-[46ch] text-ink-dim body-sm">Pivots duelists built over their own ranked games and chose to publish. Build yours from your profile&apos;s Analytics page.</p>}
    >
      {page.explorations.length ? (
        <ul className="mt-8 grid gap-px border border-line bg-line md:grid-cols-2 xl:grid-cols-3">
          {page.explorations.map((e) => (
            <ExplorationCard
              key={e.id}
              exploration={e}
              variables={variables}
              href={e.shareToken ? sharePath(e.shareToken) : `/profile/${e.ownerId}/analytics`}
              owner={{ name: duelistName(e.owner), avatar: e.owner.avatar }}
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
