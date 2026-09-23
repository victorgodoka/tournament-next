import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { AnalyticsShell, personOfDuelist } from '@app/profile/analytics/AnalyticsShell'
import { ExplorationView } from '@omega/analytics/explorer/output'
import { duelistName } from '@utils/analytics'
import { getSharedExploration, getVariables } from '@utils/explorations'
import { pageMetadata } from '@utils/metadata'

type SharedRouteProps = { params: Promise<{ shareToken: string }> }

const load = async (token: string) => getSharedExploration(token, (await headers()).get('cookie'))

const VISIBILITY_EYEBROW = { private: 'Private exploration · only you', link: 'Shared exploration', public: 'Public exploration' } as const

export async function generateMetadata({ params }: SharedRouteProps) {
  const { shareToken } = await params
  const shared = await load(shareToken)
  const path = `/analytics/e/${shareToken}`
  if (!shared) return pageMetadata({ title: 'Exploration not found', path, noIndex: true })
  const { exploration, owner } = shared
  return pageMetadata({
    title: `${exploration.name} · ${duelistName(owner)}`,
    path,
    description: `${exploration.name}: an analytics exploration ${duelistName(owner)} built from their ranked games.`,
    // Only public ones are listed; a link-only or private one stays out of search.
    noIndex: exploration.visibility !== 'public',
  })
}

/** The share URL of a `link` or `public` exploration. Works even when the owner's profile is private. */
const SharedRoute = async ({ params }: SharedRouteProps) => {
  const { shareToken } = await params
  const [shared, variables] = await Promise.all([load(shareToken), getVariables()])
  if (!shared) notFound()
  const { exploration, owner } = shared

  return (
    <AnalyticsShell
      person={personOfDuelist(owner)}
      eyebrow={VISIBILITY_EYEBROW[exploration.visibility]}
      meta="Live · updates within 5 minutes"
      title={exploration.name}
      back={{ href: '/analytics', label: 'Public analytics' }}
      aside={
        <Link href={`/profile/${owner.id}/analytics`} className="flex min-h-11 items-center border border-line-strong px-4 text-ink signal-chip hover:bg-ink hover:text-ink-on">
          {duelistName(owner)}&apos;s analytics
        </Link>
      }
    >
      <ExplorationView shared={shared} variables={variables} />
    </AnalyticsShell>
  )
}

export default SharedRoute
