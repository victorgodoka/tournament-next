import { twMerge } from 'tailwind-merge'

export type ChipTone = 'gold' | 'cyan' | 'indigo' | 'neutral' | 'positive' | 'negative' | 'amber'

type ChipProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: ChipTone
  /** Filled rather than outlined. For the single most important status in a set. */
  solid?: boolean
  /** Prefixes a 6px square in the current color. */
  dot?: boolean
}

const outline: Record<ChipTone, string> = {
  gold: 'text-gold',
  cyan: 'text-cyan',
  indigo: 'text-indigo-lift',
  neutral: 'text-ink-muted',
  positive: 'text-positive',
  negative: 'text-negative',
  amber: 'text-amber',
}

const fill: Record<ChipTone, string> = {
  gold: 'border-gold bg-gold text-gold-on',
  cyan: 'border-cyan bg-cyan text-cyan-on',
  indigo: 'border-indigo bg-indigo text-indigo-on',
  neutral: 'border-ink bg-ink text-surface-000',
  positive: 'border-positive bg-positive text-positive-on',
  negative: 'border-negative bg-negative text-negative-on',
  amber: 'border-amber bg-amber text-amber-on',
}

/** Status label: mono, square, outlined in its own color. */
export const Chip = ({ tone = 'neutral', solid, dot, children, className, ...props }: ChipProps) => (
  <span
    className={twMerge(
      'inline-flex items-center gap-1.5 justify-self-start border border-current px-2.5 py-1.25 whitespace-nowrap signal-chip',
      solid ? fill[tone] : outline[tone],
      className,
    )}
    {...props}
  >
    {dot ? <span aria-hidden className="size-1.5 shrink-0 bg-current" /> : null}
    {children}
  </span>
)
