import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { PlayerStatistics, seasonChoices, type StatisticsView } from '@app/profile/statistics/PlayerStatistics'
import { getProfile } from '@utils/profile'
import { pageMetadata } from '@utils/metadata'

type Query = { view?: string | string[]; season?: string | string[]; ladder?: string | string[]; format?: string | string[] }
type StatisticsRouteProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<Query>
}

/** Same call, same cookie, same `limit` as the profile route, so `cache` shares it with the metadata. */
const loadProfile = async (id: string) => getProfile(id, (await headers()).get('cookie'))

const one = (value: string | string[] | undefined) => (typeof value === 'string' && value ? value : undefined)

export async function generateMetadata({ params }: StatisticsRouteProps) {
  const { id } = await params
  const profile = await loadProfile(id)
  const path = `/profile/${id}/statistics`
  if (!profile) return pageMetadata({ title: 'Profile not found', path, noIndex: true })

  const name = profile.displayName ?? profile.handle ?? 'Unknown duelist'
  return pageMetadata({
    title: `${name} · Statistics`,
    path,
    description: `Ranked and tournament statistics for ${name}: decks, win rates, turn order and card choices.`,
    noIndex: profile.isPrivate,
  })
}

const StatisticsRoute = async ({ params, searchParams }: StatisticsRouteProps) => {
  const { id } = await params
  const q = await searchParams
  const profile = await loadProfile(id)
  if (!profile) notFound()

  const choices = profile.isPrivate ? [] : seasonChoices(profile)
  const view = one(q.view)
  const ladder = one(q.ladder)
  const selection: StatisticsView =
    view === 'tournaments' ? { view, format: one(q.format) }
    : view === 'global' ? { view }
    : one(q.season) ? { view: 'ranked', season: one(q.season) }
    : ladder === 'tcg' || ladder === 'genesys' ? { view: 'ranked', ladder }
    : { view: 'ranked', season: choices.find((choice) => choice.open)?.code ?? choices[0]?.code }

  return <PlayerStatistics profile={profile} choices={choices} selection={selection} cookie={(await headers()).get('cookie')} />
}

export default StatisticsRoute
