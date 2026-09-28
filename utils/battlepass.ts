/**
 * Battlepass endpoints on omega-server-v3 (see its BATTLEPASS_API.md).
 * The seasons and the track are public and cached a minute; progress, claims and the premium purchase
 * need the session cookie and run in the browser. Errors use the API envelope, so they throw
 * {@link ShopApiError}: branch on `code`, never on `message`.
 */
import { API_URL } from '@utils/auth'
import { ShopApiError, request } from '@utils/shop'
import type { ShopItem } from '@utils/types'

export type PassTrack = 'free' | 'premium'

export type PassSeason = {
  code: string
  name: string
  description: string
  startsAt: string
  endsAt: string
  /** XP is still being earned: inside the window. Claims keep working after it while the season is listed. */
  open: boolean
  formats: string[]
  /** Duel Points for the premium track on the site; `null` = not sold here. */
  premiumPrice: number | null
  /** The game's Omega Pass unlocks premium. */
  premiumOmegaPass: boolean
}

export type PassReward = { season: string; level: number; premium: boolean; itemId: string; qty: number; item: ShopItem }

/** `xp` is the **total** XP the level needs, not the step from the one before. */
export type PassLevel = { level: number; xp: number; free: PassReward | null; premium: PassReward | null }

export type PassProgress = {
  season: PassSeason
  xp: number
  level: number
  maxLevel: number
  /** The next level and its total XP; `null` at the top. */
  nextLevel: { level: number; xp: number } | null
  premium: boolean
  /** `omega_pass` is read live: when the game's pass expires, premium locks again (claims stay). */
  premiumSource: 'omega_pass' | 'web' | null
  claimed: { level: number; track: PassTrack; itemId: string; qty: number; claimedAt: string }[]
  /** Exactly what `claim-all` takes right now. */
  claimable: { level: number; track: PassTrack }[]
}

export type PassClaim = {
  level: number
  track: PassTrack
  itemId: string
  qty: number
  /** `balance` is the new Duel Points balance for a currency reward; `granted: false` = already owned, still claimed. */
  grant: { itemId: string; currency: boolean; granted?: boolean; balance?: number }
}

const seg = encodeURIComponent

const publicGet = async <T>(path: string): Promise<T> => {
  const res = await fetch(`${API_URL}${path}`, { next: { revalidate: 60 } })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ShopApiError(res.status, body.error, body.message)
  }
  return res.json()
}

export const getSeasons = () => publicGet<{ seasons: PassSeason[] }>('/battlepass').then((r) => r.seasons)

export const getTrack = (season: string) => publicGet<{ season: PassSeason; levels: PassLevel[] }>(`/battlepass/${seg(season)}`)

/** `401` when signed out. */
export const getProgress = (season: string, signal?: AbortSignal) => request<PassProgress>(`/battlepass/${seg(season)}/me`, { signal })

export const claimReward = (season: string, level: number, track: PassTrack) =>
  request<PassClaim>(`/battlepass/${seg(season)}/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ level, track }),
  })

/** One transaction; `claimed: []` when there was nothing. Rewards another tab took meanwhile are skipped. */
export const claimAll = (season: string) => request<{ claimed: PassClaim[] }>(`/battlepass/${seg(season)}/claim-all`, { method: 'POST' })

/** Charge and unlock in one transaction; `402 INSUFFICIENT_FUNDS` charges nothing. */
export const buyPremium = (season: string) =>
  request<{ premium: true; premiumSource: 'web'; balance: number }>(`/battlepass/${seg(season)}/premium`, { method: 'POST' })

export const PASS_ERRORS: Record<string, string> = {
  PREMIUM_REQUIRED: 'That reward is on the premium track. Unlock premium to claim it.',
  LEVEL_NOT_REACHED: 'You haven’t reached that level yet. XP shows up a few minutes after a duel.',
  NOT_FOUND: 'That reward is no longer on the track. Reload the page.',
  INSUFFICIENT_FUNDS: 'Not enough Duel Points. Nothing was charged.',
  NOT_FOR_SALE: 'The premium track isn’t sold on the site this season.',
  UNAUTHENTICATED: 'Your session expired. Sign in again.',
  FORBIDDEN: "This account can't do that right now.",
}

export const passErrorMessage = (error: unknown) => {
  const code = error instanceof ShopApiError ? error.code : undefined
  return (code && PASS_ERRORS[code]) || "That didn't go through. Reload the page and try again."
}
