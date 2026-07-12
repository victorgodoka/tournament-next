'use client'

import { Suspense } from 'react'
import StickySideRailAd from './ads.sticky-side-rail.component'
import FloatingOutstreamVideoPlayerAd from './ads.floating-video.component'
import { useNitroAdsNavigation } from './use-nitro-ads-navigation'
import './ads.styles.css'

function NitroAdsNavigation() {
  useNitroAdsNavigation()
  return null
}

const AdsShell = () => {
  return (
    <>
      <Suspense fallback={null}>
        <NitroAdsNavigation />
      </Suspense>
      <StickySideRailAd />
      <FloatingOutstreamVideoPlayerAd />
    </>
  )
}

export default AdsShell
