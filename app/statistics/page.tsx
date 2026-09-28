import Link from 'next/link'
import { headers } from 'next/headers'
import { AnalyticsShell } from '@app/profile/analytics/AnalyticsShell'
import { ExplorationCard } from '@omega/analytics/explorer/exploration-card'
import { EmptyBox } from '@omega/profile/empty-box'
import { duelistName } from '@utils/analytics'
import { getPublicExplorations, getVariables, sharePath } from '@utils/explorations'
import { pageMetadata } from '@utils/metadata'

type StatisticsFeedProps = { searchParams: Promise<{ cursor?: string | string[]; before?: string | string[] }> }

export const metadata = pageMetadata({
  title: 'Statistics',
  path: '/statistics',
  description: 'The explorations duelists built from their own ranked games and chose to publish.',
})

/** Every public exploration, newest created first. Paged with `?cursor=` (`?before=`, the old name, still read), one server page at a time. */
const StatisticsFeed = async ({ searchParams }: StatisticsFeedProps) => {
  const { cursor: raw, before } = await searchParams
  const param = raw ?? before
  const cursor = typeof param === 'string' && /^\d+$/.test(param) ? param : undefined
  const [page, variables] = await Promise.all([getPublicExplorations(cursor, (await headers()).get('cookie')), getVariables()])

  return (
    <AnalyticsShell
      eyebrow="Public statistics"
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
          <Link href="/statistics" className="flex min-h-11 items-center border border-line px-4 text-ink-dim signal-chip hover:border-ink hover:text-ink">← Newest</Link>
        ) : null}
        {page.nextCursor ? (
          <Link href={`/statistics?cursor=${page.nextCursor}`} className="flex min-h-11 items-center border border-cyan px-4 text-cyan signal-chip hover:bg-ground-cyan">Older →</Link>
        ) : null}
      </nav>
    </AnalyticsShell>
  )
}

export default StatisticsFeed
