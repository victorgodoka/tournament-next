import { twMerge } from 'tailwind-merge'

type RailHeadProps = {
  /** Two-digit band number in gold, e.g. `01`. */
  num?: string
  label: React.ReactNode
  /** Right-aligned provenance after the rule: a timestamp, a sample size. */
  stamp?: React.ReactNode
  /** Bolds the label and moves it to cyan, for a sub-band inside a band. */
  emphasis?: boolean
  /** Heading level for the label when the band starts a document section. */
  as?: 'h2' | 'h3' | 'span'
  className?: string
}

/** Heads a full-bleed band: numbered mono bar, a rule to the right edge, a provenance stamp. */
export const RailHead = ({ num, label, stamp, emphasis, as: Label = 'span', className }: RailHeadProps) => (
  <div className={twMerge('flex items-baseline gap-3.5 border-b border-line px-5.5 py-4 text-ink-muted signal-lg lg:px-11', className)}>
    {num ? <span className="shrink-0 font-bold text-gold">{num}</span> : null}
    <Label className={twMerge('min-w-0 truncate', emphasis && 'font-bold text-cyan')}>{label}</Label>
    {stamp ? (
      <>
        <span aria-hidden className="h-px flex-1 self-center bg-line" />
        <span className="shrink-0">{stamp}</span>
      </>
    ) : null}
  </div>
)
