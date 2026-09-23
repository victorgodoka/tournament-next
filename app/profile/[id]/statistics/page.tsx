import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { PlayerStatistics, seasonChoices } from '@app/profile/statistics/PlayerStatistics'
import { getProfile } from '@utils/profile'
import { pageMetadata } from '@utils/metadata'

type StatisticsRouteProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ season?: string | string[] }>
}

/** Same call, same cookie, same `limit` as the profile route, so `cache` shares it with the metadata. */
const loadProfile = async (id: string) => getProfile(id, (await headers()).get('cookie'))

export async function generateMetadata({ params }: StatisticsRouteProps) {
  const { id } = await params
  const profile = await loadProfile(id)
  const path = `/profile/${id}/statistics`
  if (!profile) return pageMetadata({ title: 'Profile not found', path, noIndex: true })

  const name = profile.displayName ?? profile.handle ?? 'Unknown duelist'
  return pageMetadata({
    title: `${name} · Season statistics`,
    path,
    description: `Ranked season analytics for ${name}: decks, card usage, hand traps and every game.`,
    noIndex: profile.isPrivate,
  })
}

const StatisticsRoute = async ({ params, searchParams }: StatisticsRouteProps) => {
  const { id } = await params
  const { season: requested } = await searchParams
  const profile = await loadProfile(id)
  if (!profile) notFound()

  const choices = profile.isPrivate ? [] : seasonChoices(profile)
  const season = (typeof requested === 'string' && requested) || choices.find((choice) => choice.open)?.code || choices[0]?.code

  return <PlayerStatistics profile={profile} choices={choices} season={season} cookie={(await headers()).get('cookie')} />
}

export default StatisticsRoute
