'use client'

import { twMerge } from 'tailwind-merge'
import { VIDEO_NC_AD_OPTIONS } from '@utils/nitro-ads.const'
import { useAdsMode } from './ads-mode'
import { useNitroAd } from './use-nitro-ad'

/** Nitro's in-content video player, the best-paying unit: one per page, near the top of the content. */
export const AdVideo = ({ id, className }: { id: `ad-${string}`; className?: string }) => {
  const mode = useAdsMode()
  useNitroAd(id, VIDEO_NC_AD_OPTIONS, { enabled: mode === 'all' })
  if (mode !== 'all') return null

  return <div id={id} className={twMerge('aspect-video w-full max-w-[640px]', className)} />
}
