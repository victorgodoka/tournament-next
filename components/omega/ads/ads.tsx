'use client'

import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { useAuth } from '@hooks/index'
import { removeNitroHost } from '@utils/nitro-ads'
import {
  ANCHOR_AD_OPTIONS,
  ANCHOR_MOBILE_AD_OPTIONS,
  FLOATING_AD_OPTIONS,
  INTERSTITIAL_AD_OPTIONS,
  NITROPAY_SCRIPT_URL,
  NITRO_AD_SLOT_IDS,
  RAIL_LEFT_AD_OPTIONS,
  RAIL_RIGHT_AD_OPTIONS,
} from '@utils/nitro-ads.const'
import type { NitroAdOptions } from '@utils/nitro-ads.types'
import { adsMode, isVideoPage } from './ads-mode'
import { useNitroAd } from './use-nitro-ad'

/** Nitro's install snippet: queues createAd calls until the real script arrives. */
const STUB =
  'window.nitroAds=window.nitroAds||{createAd:function(){return new Promise(e=>{window.nitroAds.queue.push(["createAd",arguments,e])})},addUserToken:function(){window.nitroAds.queue.push(["addUserToken",arguments])},queue:[]};'

/**
 * None of the site-wide formats needs an element: an empty one only collides with the rail.
 * Unmounting (a page without ads, a VIP) takes Nitro's own host off the screen.
 */
const Placement = ({ id, options }: { id: string; options: NitroAdOptions }) => {
  useNitroAd(id, options)
  useEffect(() => () => removeNitroHost(id), [id])
  return null
}

/**
 * The site-wide placements. A VIP, or anyone while /auth/me is in flight, gets nothing, not even
 * the script. Signed in, the messenger dock owns the bottom-right from 640px up, so no right rail
 * and the anchor stays on phones.
 */
export const Ads = () => {
  const { user } = useAuth()
  const pathname = usePathname()
  const mode = adsMode(user, pathname)
  if (mode === 'none') return null

  const signedOut = user === null
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
      />
      <Placement key={NITRO_AD_SLOT_IDS.railLeft} id={NITRO_AD_SLOT_IDS.railLeft} options={RAIL_LEFT_AD_OPTIONS} />
      {mode === 'all' ? (
        <>
          {signedOut ? (
            <Placement key={NITRO_AD_SLOT_IDS.railRight} id={NITRO_AD_SLOT_IDS.railRight} options={RAIL_RIGHT_AD_OPTIONS} />
          ) : null}
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
