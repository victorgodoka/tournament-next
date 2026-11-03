'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useCallback } from 'react'
import { twMerge } from 'tailwind-merge'
import { contentWidth, fitSizes } from '@utils/nitro-ads'
import { AD_REPORT, ASIDE_AD_OPTIONS, ASIDE_TALL_AD_OPTIONS, CONTENT_SIZES } from '@utils/nitro-ads.const'
import type { NitroAdOptions } from '@utils/nitro-ads.types'
import { useAdsLayout, useAdsMode } from './ads-mode'
import { useNitroAd } from './use-nitro-ad'
import { VipPromo } from './vip-promo'

type AdBannerProps = {
  /** Unique on the page; Nitro reports by it. */
  id: `ad-${string}`
  /** `aside`: a 300x250 in a side column, desktop only. `tall`: up to a 300x600 half page there. */
  placement: 'content' | 'aside' | 'tall'
  /** A leaderboard band: reserves 90px (50px on phones) instead of a medium rectangle's 250px. */
  slim?: boolean
  className?: string
}

/** Read when the slot asks: only the creatives its box can hold. */
const contentOptions = (id: string): NitroAdOptions | null => {
  const sizes = fitSizes(CONTENT_SIZES, contentWidth(document.getElementById(id)?.parentElement))
  return sizes.length ? { sizes, renderVisibleOnly: true, report: AD_REPORT } : null
}

/**
 * A labelled display unit. The box is there from the server render on (no shift when auth answers),
 * the slot only once ads are on. Blocked by an adblocker, the box shows our VIP promo instead.
 */
export const AdBanner = ({ id, placement, slim, className }: AdBannerProps) => {
  const layout = useAdsLayout()
  const live = useAdsMode() === 'all'
  const t = useTranslations('Ads')
  const options = useCallback(
    () => (placement === 'aside' ? ASIDE_AD_OPTIONS : placement === 'tall' ? ASIDE_TALL_AD_OPTIONS : contentOptions(id)),
    [placement, id],
  )
  const { failed } = useNitroAd(id, options, { enabled: live })
  if (layout !== 'all') return null

  return (
    <div
      className={twMerge(
        'flex flex-col items-center gap-1.5',
        placement !== 'content' && 'bg-space-000 p-5 max-lg:hidden',
        className,
      )}
    >
      <span className="text-ink-muted signal-sm">{t('label')}</span>
      <div className={twMerge('flex min-h-[250px] w-full items-center justify-center', placement === 'tall' && 'min-h-[600px]', slim && 'min-h-[50px] md:min-h-[90px]')}>
        {failed ? <VipPromo className="w-full" /> : live ? <div id={id} /> : null}
      </div>
      <Link href="/download#donations" className="text-ink-muted signal-sm hover:text-ink">
        {t('removeWithVip')}
      </Link>
    </div>
  )
}
