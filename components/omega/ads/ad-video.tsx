'use client'

import { twMerge } from 'tailwind-merge'
import { VIDEO_NC_AD_OPTIONS } from '@utils/nitro-ads.const'
import { useAdsLayout, useAdsMode } from './ads-mode'
import { useNitroAd } from './use-nitro-ad'
import { VipPromo } from './vip-promo'

/**
 * Nitro's in-content video player, the best-paying unit: one per page, near the top of the content.
 * The 16:9 box holds its place from the server render on; blocked, it shows our VIP promo instead.
 */
export const AdVideo = ({ id, className }: { id: `ad-${string}`; className?: string }) => {
  const layout = useAdsLayout()
  const live = useAdsMode() === 'all'
  const { failed } = useNitroAd(id, VIDEO_NC_AD_OPTIONS, { enabled: live })
  if (layout !== 'all') return null

  return (
    <div
      id={live && !failed ? id : undefined}
      className={twMerge('flex aspect-video w-full max-w-[640px] items-center', className)}
    >
      {failed ? <VipPromo className="w-full" /> : null}
    </div>
  )
}
