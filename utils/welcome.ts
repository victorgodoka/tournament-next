import { API_URL } from './auth'
import type { CardArt, WelcomeData } from '@utils/types'
import { cache } from 'react'

/** Anonymous site-wide counters on the busiest page: one shared copy for 30 s is plenty. */
export const getWelcomeData = cache(async (): Promise<WelcomeData | null> => {
  try {
    const res = await fetch(`${API_URL}/welcome`, { next: { revalidate: 30 } })
    if (!res.ok) {
      // Log the error instead of throwing, so the page can still render.
      console.error(`GET /welcome failed with ${res.status}`)
      return null
    }
    return res.json()
  } catch (error) {
    console.error(error)
    return null
  }
})

/** `+6.4%` against the previous window. `null` when there is nothing to compare with. */
export const change = (current: number, previous: number) => {
  if (!previous) return null
  const pct = ((current - previous) / previous) * 100
  return { up: pct >= 0, label: `${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(1)}%` }
}

const RELATIVE = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

/** `4 minutes ago`, `yesterday`, `in 2 hours`. */
export const relative = (iso: string, now: number) => {
  const minutes = Math.round((Date.parse(iso) - now) / 60_000)
  if (!minutes) return 'just now'
  if (Math.abs(minutes) < 60) return RELATIVE.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return RELATIVE.format(hours, 'hour')
  return RELATIVE.format(Math.round(hours / 24), 'day')
}

/** `in 2 h 40 m`, for events starting soon. */
export const countdown = (iso: string, now: number) => {
  const minutes = Math.max(0, Math.round((Date.parse(iso) - now) / 60_000))
  const hours = Math.floor(minutes / 60)
  return hours ? `in ${hours} h ${minutes % 60} m` : `in ${minutes} m`
}

export type UpcomingTournament = {
  id: string
  name: string
  format: string
  startsAt: string
  slotsTaken: number
  slots: number
}

export type TopDeck = { name: string; format: string; share: number; duels: number; art: CardArt }

export type CommunityDeck = {
  id: string
  badge: string
  accent: 'gold' | 'cyan' | 'indigo'
  name: string
  author: string
  updatedAt: string
  metric: string
  note: string
  tags: string[]
  art: CardArt
}

const HOUR = 3_600_000
const at = (now: number, hours: number) => new Date(now + hours * HOUR).toISOString()

// ponytail: mocks until upcoming tournaments, deck-stats and deck-community endpoints exist. Keep the shapes, swap the bodies.
/** The game database only knows started tournaments, so `/welcome` has no upcoming list. */
export const getUpcomingTournaments = (now: number): UpcomingTournament[] => [
  { id: 'fgl', name: 'Friday Genesys Ladder', format: 'Genesys swiss', startsAt: at(now, 2.67), slotsTaken: 48, slots: 64 },
  { id: 'soc', name: 'Saturday Omega Cup', format: 'TCG single elim', startsAt: at(now, 28), slotsTaken: 91, slots: 128 },
  { id: 'sdg', name: 'Sunday Draft Gauntlet', format: 'Draft', startsAt: at(now, 49), slotsTaken: 12, slots: 32 },
]

export const TOP_DECKS: TopDeck[] = [
  { name: 'Mitsurugi', format: 'TCG', share: 14.2, duels: 8934, art: { id: 13332685, name: 'Ame no Habakiri no Mitsurugi' } },
  { name: 'Sky Striker', format: 'TCG', share: 11.8, duels: 7421, art: { id: 26077387, name: 'Sky Striker Ace Raye' } },
  { name: 'Branded Despia', format: 'TCG', share: 9.4, duels: 5907, art: { id: 68468459, name: 'Fallen of Albaz' } },
]

export const getCommunityDecks = (now: number): CommunityDeck[] => [
  {
    id: 'mitsurugi-turbo', badge: 'Most liked', accent: 'gold', name: 'Mitsurugi Turbo', author: '@marufuji', updatedAt: at(now, -6),
    metric: '2,418 likes', note: 'Three-card combo line with the new Ritual engine, built for the Season 14 ladder.', tags: ['TCG', 'Meta'],
    art: { id: 13332685, name: 'Ame no Habakiri no Mitsurugi' },
  },
  {
    id: 'sky-striker-control', badge: 'Most viewed', accent: 'cyan', name: 'Sky Striker Control', author: '@kaiba', updatedAt: at(now, -50),
    metric: '41,067 views', note: 'Grind-game shell with a wider spell and trap package for the Automatic bracket.', tags: ['TCG', 'Control'],
    art: { id: 26077387, name: 'Sky Striker Ace Raye' },
  },
  {
    id: 'elfnote-synchro', badge: 'Just posted', accent: 'indigo', name: 'Elfnote Synchro', author: '@candy', updatedAt: at(now, -0.23),
    metric: 'New', note: 'Fresh Genesys list that skips the extra deck tax and still ends on a full board.', tags: ['Genesys', 'Rogue'],
    art: { id: 85976588, name: 'Elfnote' },
  },
]

export const PUBLIC_DECK_COUNT = 1842
