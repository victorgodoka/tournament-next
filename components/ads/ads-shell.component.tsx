'use client'

import StickySideRailAd from './ads.sticky-side-rail.component'
import FloatingOutstreamVideoPlayerAd from './ads.floating-video.component'
import './ads.styles.css'

const AdsShell = () => {
  return (
    <>
      <StickySideRailAd />
      <FloatingOutstreamVideoPlayerAd />
    </>
  )
}

export default AdsShell
