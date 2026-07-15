'use client'

import StickySideRailAd from './ads.sticky-side-rail.component'
import FloatingOutstreamVideoPlayerAd from './ads.floating-video.component'
import './ads.styles.css'

const AdsShell = () => {
  if (process.env.NEXT_PUBLIC_ENV === 'development') return null    
  return (
    <>
      <StickySideRailAd />
      <FloatingOutstreamVideoPlayerAd />
    </>
  )
}

export default AdsShell
