import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
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
  getTournaments,
  getWelcomeData,
  relative,
  type LiveTournament,
  type UpcomingTournament,
} from '@utils/welcome'
import { DailyStats } from './sections/DailyStats'
import { DeckCommunity } from './sections/DeckCommunity'
import { Tournaments } from './sections/Tournaments'
import { WelcomeHero } from './sections/WelcomeHero'

export const metadata = pageMetadata({
  title: 'Welcome',
  path: '/welcome',
  noIndex: true,
})

type WelcomeRouteProps = {
  /** `?tournament=none` previews the idle state while tournaments are still mocked. */
  searchParams: Promise<{ tournament?: string }>
}

// ponytail: the "N friends ready" clause left with the mock viewer. The messenger is browser-only
// (per-IP rate limit), so bring it back client-side from the dock if it's missed.
const heroLine = (live: LiveTournament | null, next: UpcomingTournament | undefined, now: number) => {
  if (live) return `${live.name} is live: round ${live.round} of ${live.rounds}, ${formatNumber(live.playersLeft)} duelists still in.`
  if (!next) return 'No tournament is running and nothing is scheduled yet.'
  return `No tournament is running. ${next.name} starts ${relative(next.startsAt, now)}, with ${next.slots - next.slotsTaken} slots left.`
}

const idleLine = (next: UpcomingTournament | undefined, now: number) => next
  ? `The next event is ${next.name}, starting ${countdown(next.startsAt, now)}. ${next.slotsTaken} of ${next.slots} slots are taken.`
  : 'Nothing is scheduled yet. New events are announced on Discord first.'

/** Reads the clock once per request, so every relative label on the page agrees. */
const loadWelcome = async (searchParams: WelcomeRouteProps['searchParams']) => {
  const cookie = (await headers()).get('cookie')
  const [profile, welcome, { tournament }] = await Promise.all([
    getMyProfile(cookie),
    getWelcomeData(),
    searchParams,
  ])
  return { profile, welcome, tournament, now: Date.now() }
}

const WelcomePage = async ({ searchParams }: WelcomeRouteProps) => {
  const { profile, welcome, tournament, now } = await loadWelcome(searchParams)
  if (!profile) redirect('/login')

  const board = getTournaments(now)
  const live = tournament === 'none' ? null : board.live
  const next = board.upcoming[0]
  const name = profile.displayName ?? profile.handle ?? 'Duelist'
  const totalDuels = welcome ? Object.values(welcome.games.last24h).reduce((sum, count) => sum + count, 0) : 0

  return (
    <>
      <Header />
      <main className="flex min-h-dvh flex-col overflow-x-hidden bg-surface-000 pt-16">
        <WelcomeHero
          name={name}
          line={heroLine(live, next, now)}
          nowIso={new Date(now).toISOString()}
          cover={coverUrl(profile.coverImageId) ?? '/profile-cover.jpg'}
          welcome={welcome}
        />
        <DailyStats
          decks={TOP_DECKS}
          stamp={welcome ? `Rolling window, updated ${relative(welcome.games.updatedAt, now)}` : 'Stats unavailable'}
          sampleNote={totalDuels ? `Sampled across ${formatNumber(totalDuels)} duels` : undefined}
        />
        <Tournaments live={live} past={board.past} upcoming={board.upcoming} idleLine={idleLine(next, now)} now={now} />
        <DeckCommunity decks={getCommunityDecks(now)} publicDecks={PUBLIC_DECK_COUNT} now={now} />
      </main>
      <Footer />
      <FriendsPanel />
    </>
  )
}

export default WelcomePage
