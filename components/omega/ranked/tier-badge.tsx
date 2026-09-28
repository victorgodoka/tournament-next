import Image from 'next/image'
import { twMerge } from 'tailwind-merge'
import type { Tier } from '@utils/types'

type TierBadgeProps = {
  tier: Tier
  sizes?: string
  /** Empty by default: the tier is written next to the badge everywhere it is used. */
  alt?: string
  className?: string
  /** Season `code`; picks `public/badges/<code>/`. Without one, the flat `public/badges/` set. */
  season?: string
}

/** Season tier artwork on a surface-200 plate. Sizing is the caller's. For the DS text badge, use @ui/tier-badge. */
export const TierBadge = ({ tier, sizes = '64px', alt = '', className, season }: TierBadgeProps) => (
  <span className={twMerge('relative block shrink-0 border border-line-mid bg-surface-200', className)}>
    <Image src={`/badges/${season ? `${season.toLowerCase()}/` : ''}${tier.toLowerCase()}.png`} alt={alt} fill sizes={sizes} className="object-contain p-[8%]" />
  </span>
)
