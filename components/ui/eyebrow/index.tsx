import { twMerge } from 'tailwind-merge'

type EyebrowProps = {
  tone?: 'gold' | 'cyan' | 'neutral' | 'positive' | 'negative' | 'amber'
  /** Pulses the leading square. Only for genuinely live state. */
  live?: boolean
  /** Set `false` to drop the rule that fills the remaining width. */
  rule?: boolean
  /** Right-aligned provenance after the rule: "Updated 19:42", "4,812 games". */
  meta?: React.ReactNode
  children: React.ReactNode
  className?: string
}

/** Only the square carries the tone; the label stays ink-dim. */
const squareClasses = {
  gold: 'bg-gold',
  amber: 'bg-gold',
  cyan: 'bg-cyan',
  neutral: 'bg-ink-muted',
  positive: 'bg-win',
  negative: 'bg-crimson-lift',
}

/** Mono label above a title: a square, the label, a rule, then provenance. States where you are. */
export const Eyebrow = ({ tone = 'gold', live, rule = true, meta, children, className }: EyebrowProps) => (
  <div className={twMerge('flex w-full items-center gap-3 text-ink-muted signal', className)}>
    <span aria-hidden className={twMerge('size-2 shrink-0', squareClasses[tone], live && 'animate-blink')} />
    <span className="whitespace-nowrap text-ink-dim">{children}</span>
    {rule ? <span aria-hidden className="h-px min-w-6 flex-1 bg-line-mid" /> : null}
    {meta ? <span className="whitespace-nowrap signal-sm">{meta}</span> : null}
  </div>
)
