import { usePathname } from 'next/navigation'
import { useAuth } from '@contexts/auth/auth.context'
import type { AuthUser } from '@utils/auth'

/** `rail`: tool pages, which have fixed bottom panels of their own. `all`: every other format too. */
export type AdsMode = 'none' | 'rail' | 'all'

/**
 * Pages that never carry ads. The simulator's preview fills the window; the render page is the popup that
 * records a combo's video. Every pattern ends at a segment so `/wiki/new` can't swallow `/wiki/newbie-guide`.
 */
const NO_ADS = [
  /^\/admin(\/|$)/,
  /^\/(login|messenger)(\/|$)/,
  /^\/profile\/edit(\/|$)/,
  /^\/simulator\/new\/?$/,
  /^\/simulator\/c\/[^/]+\/render(\/|$)/,
  /^\/wiki\/(new|panel)(\/|$)/,
  /^\/wiki\/[^/]+\/(edit|history)(\/|$)/,
]

const RAIL_ONLY = [/^\/deck-builder(\/|$)/, /^\/(calculator|simulator)\/?$/]

/** Pages with a `video-nc` player in the content, where the floating outstream player stays off. */
const VIDEO_PAGES = [/^\/wiki\/(card\/)?[^/]+\/?$/, /^\/statistics\/?$/]

/** A wiki article: `/wiki/[slug]`, whose page keeps its 1280px column where the others narrow for the rails. */
const ARTICLE_PAGE = /^\/wiki\/[^/]+\/?$/

/** An /auth/me without `isVip` predates the field: treat it as VIP rather than risk ads for one. */
const vip = (user: AuthUser | null | undefined) => !!user && user.isVip !== false

export const adsMode = (user: AuthUser | null | undefined, pathname: string): AdsMode => {
  if (user === undefined || vip(user)) return 'none'
  if (NO_ADS.some((re) => re.test(pathname))) return 'none'
  return RAIL_ONLY.some((re) => re.test(pathname)) ? 'rail' : 'all'
}

/** Our own VIP pitch: everyone but a VIP, once auth has answered. */
export const promoVisible = (user: AuthUser | null | undefined): boolean => user !== undefined && !vip(user)

/**
 * What the page holds while /auth/me is in flight: a signed-out reader's boxes, rendered on the
 * server too, so the page doesn't shift when auth answers. Only a VIP sees them collapse.
 */
export const adsLayout = (user: AuthUser | null | undefined, pathname: string): AdsMode =>
  adsMode(user === undefined ? null : user, pathname)

export const promoLayout = (user: AuthUser | null | undefined): boolean => user === undefined || promoVisible(user)

export const isVideoPage = (pathname: string): boolean => VIDEO_PAGES.some((re) => re.test(pathname))

export const isArticlePage = (pathname: string): boolean => ARTICLE_PAGE.test(pathname)

export const useAdsMode = (): AdsMode => adsMode(useAuth().user, usePathname())

export const useAdsLayout = (): AdsMode => adsLayout(useAuth().user, usePathname())

export const usePromoLayout = (): boolean => promoLayout(useAuth().user)
