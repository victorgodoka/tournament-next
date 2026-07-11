'use client'

import {
  NITRO_AD_SLOT_IDS,
  STICKY_RAIL_AD_OPTIONS,
} from '@lib/nitro-ads.const'
import { useNitroAd } from './use-nitro-ad'
import './ads.styles.css'

const StickyRideRailAd = () => {
  useNitroAd(NITRO_AD_SLOT_IDS.stickyRail, STICKY_RAIL_AD_OPTIONS)

  return (
    <aside
      id={NITRO_AD_SLOT_IDS.stickyRail}
      className="ads ads--sticky-rail"
      aria-label="Advertisement"
      aria-hidden="true"
    />
  )
}

export default StickyRideRailAd
