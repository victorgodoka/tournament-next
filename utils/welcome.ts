import { API_URL } from './auth'
import type { WelcomeData } from '@utils/types'
import { cache } from 'react'

/** Public and cached by the API for at most 2 minutes (WELCOME_API.md §3): refetching sooner returns the same data. */
export const getWelcomeData = cache(async (): Promise<WelcomeData | null> => {
  try {
    const res = await fetch(`${API_URL}/welcome`, { next: { revalidate: 120 } })
    if (!res.ok) {
      // Log the error instead of throwing, so the page can still render.
      console.error(`GET /welcome failed with ${res.status}`)
      return null
    }
    const data: WelcomeData = await res.json()
    // The first visit after a quiet spell gets the stale copy while it revalidates; the game's
    // recurring tournaments come every few hours, so drop the ones that already started.
    const now = Date.now()
    return { ...data, tournaments: { ...data.tournaments, upcoming: data.tournaments.upcoming.filter((u) => Date.parse(u.startsAt) > now) } }
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
