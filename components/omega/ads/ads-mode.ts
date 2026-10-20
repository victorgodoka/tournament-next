import { usePathname } from 'next/navigation'
import { useAuth } from '@hooks/index'
import type { AuthUser } from '@utils/auth'

/** `rail`: tool pages, which have fixed bottom panels of their own. `all`: every other format too. */
export type AdsMode = 'none' | 'rail' | 'all'

/**
 * Pages that never carry ads. The home gets a VIP section instead; the render page is what the
 * video renderer screenshots, signed out. Every pattern ends at a segment so `/wiki/new` can't
 * swallow `/wiki/newbie-guide`.
 */
const NO_ADS = [
  /^\/$/,
  /^\/admin(\/|$)/,
  /^\/(login|messenger|inventory)(\/|$)/,
  /^\/profile\/edit(\/|$)/,
  /^\/(shop|battlepass)(\/|$)/,
  /^\/simulator\/c\/[^/]+\/render(\/|$)/,
  /^\/wiki\/(new|panel|example)(\/|$)/,
  /^\/wiki\/[^/]+\/(edit|history)(\/|$)/,
]

const RAIL_ONLY = [/^\/deck-builder(\/|$)/, /^\/(calculator|simulator)\/?$/]

/** Pages with a `video-nc` player in the content, where the floating outstream player stays off. */
const VIDEO_PAGES = [/^\/wiki\/(card\/)?[^/]+\/?$/, /^\/statistics\/?$/, /^\/profile\/[^/]+\/statistics\/?$/]

/** An /auth/me without `isVip` predates the field: treat it as VIP rather than risk ads for one. */
const vip = (user: AuthUser | null | undefined) => !!user && user.isVip !== false

export const adsMode = (user: AuthUser | null | undefined, pathname: string): AdsMode => {
  if (user === undefined || vip(user)) return 'none'
  if (NO_ADS.some((re) => re.test(pathname))) return 'none'
  return RAIL_ONLY.some((re) => re.test(pathname)) ? 'rail' : 'all'
}

/** Our own VIP pitch: everyone but a VIP, once auth has answered. */
export const promoVisible = (user: AuthUser | null | undefined): boolean => user !== undefined && !vip(user)

export const isVideoPage = (pathname: string): boolean => VIDEO_PAGES.some((re) => re.test(pathname))

export const useAdsMode = (): AdsMode => adsMode(useAuth().user, usePathname())

export const usePromoVisible = (): boolean => promoVisible(useAuth().user)
