import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { FriendsPanel } from '@omega/friends-panel'
import { formatNumber } from '@omega/profile/labels'
import { Footer } from '@ui/footer'
import { Header } from '@ui/header'
import { pageMetadata } from '@utils/metadata'
import { coverUrl, getMyProfile } from '@utils/profile'
import {
  PUBLIC_DECK_COUNT,
  TOP_DECKS,
  countdown,
  getCommunityDecks,
  getUpcomingTournaments,
  getWelcomeData,
  relative,
  type UpcomingTournament,
} from '@utils/welcome'
import { DailyStats } from './sections/DailyStats'
import { DeckCommunity } from './sections/DeckCommunity'
import { Tournaments } from './sections/Tournaments'
import { WelcomeHero } from './sections/WelcomeHero'
import { SelfProfile, WelcomeData, WelcomeTournament } from '@utils/types'

export const metadata = pageMetadata({
  title: 'Welcome',
  path: '/welcome',
  noIndex: true,
})

type WelcomeRouteProps = {
  /** `?tournament=none` previews the idle state. */
  searchParams: Promise<{ tournament?: string }>
}
type TDailyStatsProps = {
  welcome: WelcomeData | null
  tournament?: string
  now: number
  profile: SelfProfile
}

const TWelcomeComponents = ({ welcome, tournament, now, profile }: TDailyStatsProps) => {
  const t = useTranslations('Welcome.page');
  const upcoming = getUpcomingTournaments(now)
  const live = tournament === 'none' ? null : welcome?.tournaments?.live?.[0] ?? null
  const { tcg = [], other = [] } = welcome?.tournaments?.recent ?? {}
  const next = upcoming[0]
  const name = profile.displayName ?? profile.handle ?? 'Duelist'
  const totalDuels = welcome ? Object.values(welcome.games.last24h).reduce((sum, count) => sum + count, 0) : 0

  const heroLine = (live: WelcomeTournament | null, next: UpcomingTournament | undefined, now: number) => {
    if (live) return t('liveTournament', { name: live.name, rounds: live.rounds, players: formatNumber(live.players) });
    if (!next) return t('noTournamentRunning');
    return t('nextTournament', { name: next.name, time: relative(next.startsAt, now), slots: next.slots - next.slotsTaken });
  }

  const idleLine = (next: UpcomingTournament | undefined, now: number) => next
    ? t('nextEvent', { name: next.name, time: countdown(next.startsAt, now), slotsTaken: next.slotsTaken, slots: next.slots })
    : t('nothingScheduled');

  return <>
    <WelcomeHero
      name={name}
      line={heroLine(live, next, now)}
      nowIso={new Date(now).toISOString()}
      cover={coverUrl(profile.coverImageId) ?? '/profile-cover.jpg'}
      welcome={welcome}
    />
    <DailyStats
      decks={TOP_DECKS}
      stamp={welcome ? t('rollingWindow', { time: relative(welcome.games.updatedAt, now) }) : t('statsUnavailable')}
      sampleNote={totalDuels ? t('sampledDuels', { count: formatNumber(totalDuels) }) : undefined}
    />
    <Tournaments live={live} tcg={tcg} other={other} upcoming={upcoming} idleLine={idleLine(next, now)} now={now} />
  </>
}

const WelcomePage = async ({ searchParams }: WelcomeRouteProps) => {

  const loadWelcome = async (searchParams: WelcomeRouteProps['searchParams']) => {
    const cookie = (await headers()).get('cookie')
    const [profile, welcome, { tournament }] = await Promise.all([
      getMyProfile(cookie),
      getWelcomeData(),
      searchParams,
    ])
    return { profile, welcome, tournament, now: new Date().getTime() }
  }

  const { profile, welcome, tournament, now } = await loadWelcome(searchParams)
  if (!profile) redirect('/login')

  return (
    <>
      <Header />
      <main className="flex min-h-dvh flex-col overflow-x-hidden bg-surface-000 pt-16">
        <TWelcomeComponents profile={profile} welcome={welcome} tournament={tournament} now={now} />
        <DeckCommunity decks={getCommunityDecks(now)} publicDecks={PUBLIC_DECK_COUNT} now={now} />
      </main>
      <Footer />
      <FriendsPanel />
    </>
  )
}

export default WelcomePage
