'use client'

import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { Button } from '@ui/button/button.component'
import { Panel } from '@ui/panel'
import { useAdsMode, usePromoVisible } from './ads-mode'

/**
 * Our own ad: the VIP pitch on every page that carries ads, and in any ad slot Nitro couldn't
 * fill (adblock). Gone for a VIP, and on /download, which already is the pitch.
 */
export const VipPromo = ({ className }: { className?: string }) => {
  const mode = useAdsMode()
  const visible = usePromoVisible()
  const pathname = usePathname()
  const t = useTranslations('Ads.promo')
  const donations = useTranslations('Download.donations')
  if (!visible || mode === 'none' || pathname === '/download') return null

  return (
    <Panel
      tone="steel"
      label={t('eyebrow')}
      className={twMerge('flex flex-wrap items-center justify-between gap-x-10 gap-y-5', className)}
    >
      <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-2">
        <span className="text-gold signal">{t('eyebrow')}</span>
        <p className="text-ink display-4">{donations('title')}</p>
        <p className="max-w-[62ch] text-ink-dim body">{t('body')}</p>
      </div>
      <Button href="/download#donations" size="signal">
        {t('cta')}
      </Button>
    </Panel>
  )
}
