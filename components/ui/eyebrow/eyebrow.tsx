import { twMerge } from 'tailwind-merge'

type EyebrowProps = {
  tone?: 'gold' | 'cyan' | 'neutral'
  /** Blinks the leading square on a steps(1,end) loop. Only for genuinely live state. */
  live?: boolean
  /** Set `false` to drop the rule that fills the remaining width. */
  rule?: boolean
  /** Right-aligned provenance after the rule, in ink-muted. */
  meta?: React.ReactNode
  children: React.ReactNode
  className?: string
}

const toneClasses = {
  gold: { text: 'text-gold', dot: 'bg-gold' },
  cyan: { text: 'text-cyan', dot: 'bg-cyan' },
  neutral: { text: 'text-ink-muted', dot: 'bg-ink-muted' },
}

/** Mono label above a hero or band: a square, the label, a rule, then provenance. */
export const Eyebrow = ({ tone = 'gold', live, rule = true, meta, children, className }: EyebrowProps) => (
  <div className={twMerge('flex w-full items-center gap-3 text-ink-muted signal-lg text-xs', className)}>
    <span aria-hidden className={twMerge('size-2 shrink-0', toneClasses[tone].dot, live && 'animate-blink')} />
    <span className={toneClasses[tone].text}>{children}</span>
    {rule ? <span aria-hidden className="h-px flex-1 bg-line" /> : null}
    {meta ? <span>{meta}</span> : null}
  </div>
)
