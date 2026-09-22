import Image from 'next/image'
import { twMerge } from 'tailwind-merge'
import type { Tier } from '@utils/types'

/** The eight badges live in `public/badges`, one PNG per tier. */
export const badgeSrc = (tier: Tier) => `/badges/${tier.toLowerCase()}.png`

type TierBadgeProps = {
  tier: Tier
  sizes?: string
  /** Empty by default: the tier is written next to the badge everywhere it is used. */
  alt?: string
  className?: string
}

/** Plated badge. Sizing is the caller's: this only fills the box it is given. */
export const TierBadge = ({ tier, sizes = '64px', alt = '', className }: TierBadgeProps) => (
  <span className={twMerge('relative block shrink-0 border border-line bg-surface-100', className)}>
    <Image src={badgeSrc(tier)} alt={alt} fill sizes={sizes} className="object-contain p-[8%]" />
  </span>
)
