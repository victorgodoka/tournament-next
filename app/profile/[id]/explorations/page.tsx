import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { AnalyticsShell, duelistLabel, personOf } from '@app/profile/analytics/AnalyticsShell'
import { ExplorationCard } from '@omega/analytics/explorer/exploration-card'
import { EmptyBox } from '@omega/profile/empty-box'
import { PrivateNotice } from '@omega/profile/private-notice'
import { duelistName } from '@utils/analytics'
import { getExplorations, getVariables, sharePath } from '@utils/explorations'
import { getProfile } from '@utils/profile'
import { pageMetadata } from '@utils/metadata'

type ExplorationsRouteProps = { params: Promise<{ id: string }> }

const loadProfile = async (id: string) => getProfile(id, (await headers()).get('cookie'))

export async function generateMetadata({ params }: ExplorationsRouteProps) {
  const { id } = await params
  const profile = await loadProfile(id)
  const path = `/profile/${id}/explorations`
  if (!profile) return pageMetadata({ title: 'Profile not found', path, noIndex: true })
  const name = duelistLabel(profile)
  return pageMetadata({ title: `${name} · Explorations`, path, description: `Every analytics exploration ${name} made public from their ranked games.` })
}

const ExplorationsRoute = async ({ params }: ExplorationsRouteProps) => {
  const { id } = await params
  const cookie = (await headers()).get('cookie')
  const profile = await loadProfile(id)
  if (!profile) notFound()
  const [list, variables] = await Promise.all([getExplorations(id, cookie), getVariables()])
  if (list === null) notFound()

  return (
    <AnalyticsShell person={personOf(profile)} eyebrow="Explorations" back={{ href: `/profile/${id}/analytics`, label: 'Back to analytics' }}>
      {list === 'forbidden' ? (
        <PrivateNotice />
      ) : list.explorations.length ? (
        <ul className="mt-8 grid gap-px border border-line bg-line md:grid-cols-2">
          {list.explorations.map((e) => (
            <ExplorationCard
              key={e.id}
              exploration={e}
              variables={variables}
              href={e.shareToken ? sharePath(e.shareToken) : `/profile/${id}/analytics`}
              showVisibility={list.editable}
              owner={e.coAuthor ? { name: duelistName(e.author), avatar: e.author.avatar } : undefined}
            />
          ))}
        </ul>
      ) : (
        <EmptyBox title="Nothing shared yet" className="mt-8">
          {list.editable ? (
            <>Build one on <Link href={`/profile/${id}/analytics`} className="text-cyan hover:text-cyan">your analytics page</Link> and make it public.</>
          ) : (
            `${duelistLabel(profile)} hasn't made an exploration public yet.`
          )}
        </EmptyBox>
      )}
    </AnalyticsShell>
  )
}

export default ExplorationsRoute
