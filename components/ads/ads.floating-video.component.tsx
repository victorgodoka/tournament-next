'use client'

import {
  FLOATING_OUTSTREAM_AD_OPTIONS,
  NITRO_AD_SLOT_IDS,
} from '@lib/nitro-ads.const'
import { useNitroAd } from './use-nitro-ad'

const FloatingOutstreamVideoPlayerAd = () => {
  useNitroAd(
    NITRO_AD_SLOT_IDS.floatingOutstream,
    FLOATING_OUTSTREAM_AD_OPTIONS,
  )

  return (
    <aside
      id={NITRO_AD_SLOT_IDS.floatingOutstream}
      className="ads ads--floating-outstream"
      aria-label="Advertisement"
    />
  )
}

export default FloatingOutstreamVideoPlayerAd
