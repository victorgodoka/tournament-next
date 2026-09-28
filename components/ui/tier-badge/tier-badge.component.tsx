import { twMerge } from 'tailwind-merge'
import type { Tier } from '@utils/types'

const COLOR: Record<Tier, string> = {
  Iron: 'var(--color-tier-iron)',
  Bronze: 'var(--color-tier-bronze)',
  Silver: 'var(--color-tier-silver)',
  Gold: 'var(--color-tier-gold)',
  Platinum: 'var(--color-tier-platinum)',
  Diamond: 'var(--color-tier-diamond)',
  Master: 'var(--color-tier-master)',
  Omega: 'var(--color-tier-omega)',
}

type TierBadgeProps = {
  tier: Tier
  /** `lg` on a profile. */
  size?: 'md' | 'lg'
  className?: string
}

/** The ranked tier as a chamfered badge: gem and edge in the tier's color, the name in mono ink. No subdivisions. */
export const TierBadge = ({ tier, size = 'md', className }: TierBadgeProps) => (
  <span
    style={{ '--edge': COLOR[tier] } as React.CSSProperties}
    className={twMerge(
      'cut inline-flex items-center gap-2 text-ink signal-chip [--fill:var(--color-surface-200)]',
      size === 'lg' ? 'h-8 px-3 text-xs [--cut:var(--cut-sm)]' : 'h-6 pr-2 pl-1.75 [--cut:var(--cut-xs)]',
      className,
    )}
  >
    <span aria-hidden style={{ background: COLOR[tier] }} className={twMerge('shrink-0 rotate-45', size === 'lg' ? 'size-2.5' : 'size-2')} />
    {tier}
  </span>
)
