'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import { AD_REPORT, ASIDE_AD_OPTIONS, CONTENT_SIZES } from '@utils/nitro-ads.const'
import type { NitroAdOptions } from '@utils/nitro-ads.types'
import { useAdsMode } from './ads-mode'
import { useNitroAd } from './use-nitro-ad'
import { VipPromo } from './vip-promo'

type AdBannerProps = {
  /** Unique on the page; Nitro reports by it. */
  id: `ad-${string}`
  /** `aside`: a 300x250 in a wiki side column, desktop only. */
  placement: 'content' | 'aside'
  className?: string
}

const contentOptions = (): NitroAdOptions => ({
  sizes: typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches ? CONTENT_SIZES.desktop : CONTENT_SIZES.mobile,
  renderVisibleOnly: true,
  report: AD_REPORT,
})

/** A labelled display unit. Blocked by an adblocker, the reserved box shows our VIP promo instead. */
export const AdBanner = ({ id, placement, className }: AdBannerProps) => {
  const mode = useAdsMode()
  const t = useTranslations('Ads')
  const options = useMemo(() => (placement === 'aside' ? ASIDE_AD_OPTIONS : contentOptions()), [placement])
  const { failed } = useNitroAd(id, options, { enabled: mode === 'all' })
  if (mode !== 'all') return null

  return (
    <div
      className={twMerge(
        'flex flex-col items-center gap-1.5',
        // The wiki aside scrolls on its own and is taller than the screen: pinned to its bottom edge the
        // unit stays in view while the contents above it stay readable.
        placement === 'aside' && 'bg-space-000 p-5 max-lg:hidden lg:sticky lg:bottom-0',
        className,
      )}
    >
      <span className="text-ink-muted signal-sm">{t('label')}</span>
      <div className="flex min-h-[250px] w-full items-center justify-center">
        {failed ? <VipPromo className="w-full" /> : <div id={id} />}
      </div>
      <Link href="/download#donations" className="text-ink-muted signal-sm hover:text-ink">
        {t('removeWithVip')}
      </Link>
    </div>
  )
}
