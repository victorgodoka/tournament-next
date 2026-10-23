'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@hooks/index'
import { adsMode } from '@omega/ads/ads-mode'
import { LOGIN_PENDING_KEY, consentFromTcf, track, updateConsent } from '@utils/gtm'

/** A Discord account created this recently, signing in, is a new sign-up rather than a return. */
const SIGN_UP_WINDOW_MS = 10 * 60_000

/** `nitroAds.rendered`'s `detail.adInfo`, as the live script sends it. Undocumented: read defensively. */
interface NitroAdInfo {
  auf?: string
  adUnitCode?: string
  bidder?: string
  cpm?: number
  mediaType?: string
  width?: number
  height?: number
  refresh?: boolean
}

const section = (pathname: string) => pathname.split('/')[1] || 'home'

const takeLoginPending = (): boolean => {
  try {
    const pending = sessionStorage.getItem(LOGIN_PENDING_KEY) !== null
    sessionStorage.removeItem(LOGIN_PENDING_KEY)
    return pending
  } catch {
    return false
  }
}

/**
 * Page views (GTM's GA4 tag sends none of its own: App Router navigations are pushState), the
 * Discord sign-in coming back, Nitro's rendered ads and the CMP's answer, all onto the dataLayer.
 */
export const Tracking = () => {
  const pathname = usePathname()
  const { user } = useAuth()
  const previous = useRef<{ href: string; title: string } | null>(null)
  // Primitives, not `user`: `refresh()` after equipping a cosmetic is a new object, not a new page.
  const tier = user === undefined ? undefined : user === null ? 'guest' : user.isVip ? 'vip' : 'free'
  const userId = user?.id
  const createdAt = user?.createdAt

  useEffect(() => {
    if (!createdAt || !takeLoginPending()) return
    const fresh = Date.now() - Date.parse(createdAt) < SIGN_UP_WINDOW_MS
    track(fresh ? 'sign_up' : 'login', { method: 'discord' })
  }, [createdAt])

  // Held until /auth/me answers: the page view says whether this reader is signed in, a VIP, shown ads.
  useEffect(() => {
    if (tier === undefined) return
    let sent = false
    const send = () => {
      if (sent) return
      sent = true
      observer.disconnect()
      clearTimeout(timer)
      track('page_view', {
        page_location: location.href,
        page_title: document.title,
        page_referrer: previous.current?.href ?? document.referrer,
        content_group: section(pathname),
        // Past the VIP check, `adsMode` only looks at the path.
        ads_mode: tier === 'vip' ? 'none' : adsMode(null, pathname),
        login_status: tier === 'guest' ? 'guest' : 'signed_in',
        user_tier: tier,
        user_id: userId,
      })
      previous.current = { href: location.href, title: document.title }
    }
    // A client navigation streams the new <title> in after the URL changes: wait for it, 1 s at
    // most (two pages may share a title). A timer, not rAF: a background tab never paints.
    const titled = () => !!document.title && document.title !== previous.current?.title
    const observer = new MutationObserver(() => titled() && send())
    const timer = setTimeout(send, titled() ? 0 : 1_000)
    observer.observe(document.head, { childList: true, subtree: true, characterData: true })
    return () => {
      observer.disconnect()
      clearTimeout(timer)
    }
  }, [pathname, tier, userId])

  useEffect(() => {
    // GA4's publisher `ad_impression`. The value is the winning bid's CPM, an estimate before
    // Nitro's revenue share: Nitro's dashboard stays the payout figure.
    const onRendered = (e: Event) => {
      const info: NitroAdInfo = (e as CustomEvent<{ adInfo?: NitroAdInfo }>).detail?.adInfo ?? {}
      track('ad_impression', {
        ad_platform: 'nitropay',
        ad_source: info.bidder,
        ad_format: info.auf,
        ad_unit_name: info.adUnitCode,
        ad_size: info.width && info.height ? `${info.width}x${info.height}` : undefined,
        ad_media_type: info.mediaType,
        ad_refresh: info.refresh,
        value: typeof info.cpm === 'number' ? info.cpm / 1000 : undefined,
        currency: 'USD',
        content_group: section(location.pathname),
      })
    }
    document.addEventListener('nitroAds.rendered', onRendered)

    // Nitro's CMP defines __tcfapi once its script runs, and only where ads load at all.
    // ponytail: polls 10 s; a VIP never gets the CMP and keeps the regional defaults.
    let tries = 0
    const timer = setInterval(() => {
      if (!window.__tcfapi && ++tries < 20) return
      clearInterval(timer)
      window.__tcfapi?.('addEventListener', 2, (tcData, success) => {
        const consent = success ? consentFromTcf(tcData) : null
        if (consent) updateConsent(consent)
      })
    }, 500)

    return () => {
      document.removeEventListener('nitroAds.rendered', onRendered)
      clearInterval(timer)
    }
  }, [])

  return null
}
