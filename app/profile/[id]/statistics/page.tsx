import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { PlayerStatistics, seasonChoices, type StatisticsSelection } from '@app/profile/statistics/PlayerStatistics'
import { getProfile } from '@utils/profile'
import { pageMetadata } from '@utils/metadata'

type Query = { season?: string | string[]; ladder?: string | string[]; period?: string | string[] }
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
  const t = await getTranslations('PlayerStatistics.meta')
  if (!profile) return pageMetadata({ title: t('notFound'), path, noIndex: true })

  const name = profile.displayName ?? profile.handle ?? t('unknown')
  return pageMetadata({
    title: t('title', { name }),
    path,
    description: t('description', { name }),
    // Owner-only page: never indexed.
    noIndex: true,
  })
}

const StatisticsRoute = async ({ params, searchParams }: StatisticsRouteProps) => {
  const { id } = await params
  const q = await searchParams
  const profile = await loadProfile(id)
  if (!profile) notFound()

  const choices = profile.isPrivate ? [] : seasonChoices(profile)
  const ladderParam = one(q.ladder)
  // A season names its ladder; else `?ladder=`; else the first played ladder's open season. `?period=last7` cuts to a week.
  const picked = choices.find((choice) => choice.code === one(q.season))
  const first = choices.find((choice) => choice.open) ?? choices[0]
  const ladderOf = (format?: 'TCG' | 'Genesys'): 'tcg' | 'genesys' => (format === 'Genesys' ? 'genesys' : 'tcg')
  const period = one(q.period) === 'last7' ? 'last7' : 'season'
  const selection: StatisticsSelection = picked
    ? { season: picked.code, ladder: ladderOf(picked.format), period }
    : ladderParam === 'tcg' || ladderParam === 'genesys'
      ? { ladder: ladderParam, period }
      : { season: first?.code, ladder: ladderOf(first?.format), period }

  return <PlayerStatistics profile={profile} choices={choices} selection={selection} cookie={(await headers()).get('cookie')} />
}

export default StatisticsRoute
