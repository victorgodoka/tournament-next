'use client'

import StickySideRailAd from './ads.sticky-side-rail.component'
import FloatingOutstreamVideoPlayerAd from './ads.floating-video.component'
import './ads.styles.css'

const AdsShell = () => {
  // NEXT_PUBLIC_ENV (not NODE_ENV) on purpose: staging deploys build with
  // NODE_ENV=production but still set NEXT_PUBLIC_ENV=development to keep
  // ads off non-production hosts.
  if (process.env.NEXT_PUBLIC_ENV === 'development') return null
  return (
    <>
      <StickySideRailAd />
      <FloatingOutstreamVideoPlayerAd />
    </>
  )
}

export default AdsShell
