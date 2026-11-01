'use client'

import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { useAuth } from '@contexts/auth/auth.context'
import { track } from '@utils/gtm'
import { removeNitroHost } from '@utils/nitro-ads'
import {
  ANCHOR_AD_OPTIONS,
  ANCHOR_MOBILE_AD_OPTIONS,
  FLOATING_AD_OPTIONS,
  INTERSTITIAL_AD_OPTIONS,
  NITROPAY_SCRIPT_URL,
  NITRO_AD_SLOT_IDS,
  RAIL_ARTICLE_DOCK_QUERY,
  RAIL_ARTICLE_QUERY,
  RAIL_LEFT_AD_OPTIONS,
  RAIL_RIGHT_AD_OPTIONS,
  RAIL_RIGHT_DOCK_AD_OPTIONS,
  RAIL_WIDE_MIN_WIDTH,
} from '@utils/nitro-ads.const'
import type { NitroAdOptions, NitroRailAdOptions } from '@utils/nitro-ads.types'
import { adsMode, isArticlePage, isVideoPage } from './ads-mode'
import { useNitroAd } from './use-nitro-ad'

/** Nitro's install snippet: queues createAd calls until the real script arrives. */
const STUB =
  'window.nitroAds=window.nitroAds||{createAd:function(){return new Promise(e=>{window.nitroAds.queue.push(["createAd",arguments,e])})},addUserToken:function(){window.nitroAds.queue.push(["addUserToken",arguments])},queue:[]};'

/**
 * None of the site-wide formats needs an element: an empty one only collides with the rail.
 * Unmounting (a page without ads, a VIP) takes Nitro's own host off the screen.
 */
const Placement = ({ id, options }: { id: string; options: NitroAdOptions | (() => NitroAdOptions) }) => {
  useNitroAd(id, options, { remove: removeNitroHost })
  return null
}

/** Read when the rail asks, like Nitro's own collision check: it doesn't follow a resize either. */
const fitRail = (options: NitroRailAdOptions) => (): NitroRailAdOptions =>
  document.body.clientWidth >= RAIL_WIDE_MIN_WIDTH ? options : { ...options, sizes: [[160, 600]] }
const RAIL_LEFT = fitRail(RAIL_LEFT_AD_OPTIONS)
const RAIL_RIGHT = fitRail(RAIL_RIGHT_AD_OPTIONS)
const RAIL_RIGHT_DOCK = fitRail(RAIL_RIGHT_DOCK_AD_OPTIONS)
const RAIL_LEFT_ARTICLE = fitRail({ ...RAIL_LEFT_AD_OPTIONS, mediaQuery: RAIL_ARTICLE_QUERY })
const RAIL_RIGHT_ARTICLE = fitRail({ ...RAIL_RIGHT_AD_OPTIONS, mediaQuery: RAIL_ARTICLE_QUERY })
const RAIL_RIGHT_DOCK_ARTICLE = fitRail({ ...RAIL_RIGHT_DOCK_AD_OPTIONS, mediaQuery: RAIL_ARTICLE_DOCK_QUERY })

/**
 * The site-wide placements. A VIP, or anyone while /auth/me is in flight, gets nothing, not even
 * the script. Signed in, the messenger dock owns the bottom-right from 640px up, so the right rail
 * keeps clear of it and the anchor stays on phones.
 */
export const Ads = () => {
  const { user } = useAuth()
  const pathname = usePathname()
  const mode = adsMode(user, pathname)
  if (mode === 'none') return null

  const signedOut = user === null
  const article = isArticlePage(pathname)
  return (
    <>
      <Script id="nitro-ads-stub" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: STUB }} />
      <Script
        id="nitro-ads-loader"
        src={NITROPAY_SCRIPT_URL}
        strategy="afterInteractive"
        data-cfasync="false"
        data-log-level="warn"
        data-spa="auto"
        data-demo={process.env.NODE_ENV === 'production' ? undefined : 'true'}
        // Blocked script: the ad-blocker rate, per section, for the revenue reports.
        onError={() => track('ad_blocked', { ads_mode: mode })}
      />
      <Placement key={NITRO_AD_SLOT_IDS.railLeft} id={NITRO_AD_SLOT_IDS.railLeft} options={article ? RAIL_LEFT_ARTICLE : RAIL_LEFT} />
      {mode === 'all' ? (
        <>
          <Placement
            key={NITRO_AD_SLOT_IDS.railRight}
            id={NITRO_AD_SLOT_IDS.railRight}
            options={
              article ? (signedOut ? RAIL_RIGHT_ARTICLE : RAIL_RIGHT_DOCK_ARTICLE) : signedOut ? RAIL_RIGHT : RAIL_RIGHT_DOCK
            }
          />
          <Placement
            key={NITRO_AD_SLOT_IDS.anchor}
            id={NITRO_AD_SLOT_IDS.anchor}
            options={signedOut ? ANCHOR_AD_OPTIONS : ANCHOR_MOBILE_AD_OPTIONS}
          />
          {isVideoPage(pathname) ? null : (
            <Placement key={NITRO_AD_SLOT_IDS.floating} id={NITRO_AD_SLOT_IDS.floating} options={FLOATING_AD_OPTIONS} />
          )}
          <Placement
            key={NITRO_AD_SLOT_IDS.interstitial}
            id={NITRO_AD_SLOT_IDS.interstitial}
            options={INTERSTITIAL_AD_OPTIONS}
          />
        </>
      ) : null}
    </>
  )
}
