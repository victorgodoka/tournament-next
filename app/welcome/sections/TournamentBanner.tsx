'use client'

import Image from 'next/image'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

const DEFAULT_BANNER = '/banners/tournaments/default.png'

type TournamentBannerProps = {
  /** Season code from the API. Empty or unknown falls back to the default banner. */
  season?: string | null
  sizes: string
  className?: string
  imageClassName?: string
  children?: React.ReactNode
}

/** `/banners/tournaments/{season}.png`, swapped for `default.png` when missing or broken. */
export const TournamentBanner = ({ season, sizes, className, imageClassName, children }: TournamentBannerProps) => {
  const [broken, setBroken] = useState(false)
  const src = season?.trim() && !broken ? `/banners/tournaments/${encodeURIComponent(season.trim())}.png` : DEFAULT_BANNER

  return (
    <div className={twMerge('relative overflow-hidden bg-surface-000', className)}>
      <Image
        src={src}
        alt=""
        fill
        sizes={sizes}
        onError={() => setBroken(true)}
        className={twMerge('object-cover object-center', imageClassName)}
      />
      {children}
    </div>
  )
}
