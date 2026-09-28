import { twMerge } from 'tailwind-merge'

type RailHeadProps = {
  /** Two-digit band number in gold, e.g. `01`. Pages number their strips in order. */
  num?: string
  label: React.ReactNode
  /** Right-aligned provenance after the rule: "Updated 19:42", "4,812 games", "Season 7". */
  stamp?: React.ReactNode
  /** A nested head: the label turns cyan. Pair it without `num`. */
  emphasis?: boolean
  /** Heading level for the label when the band starts a document section. */
  as?: 'h2' | 'h3' | 'span'
  className?: string
}

/** Section head built as a strip: gold number, mono label, a rule to the edge, a provenance stamp. */
export const RailHead = ({ num, label, stamp, emphasis, as: Label = 'span', className }: RailHeadProps) => (
  <div className={twMerge('flex items-center gap-3 border-b border-line px-gutter py-3 text-ink-muted signal', className)}>
    {num ? <span className="shrink-0 font-bold text-gold">{num}</span> : null}
    <Label className={twMerge('min-w-0 truncate font-bold text-ink', emphasis && 'text-cyan')}>{label}</Label>
    {stamp ? (
      <>
        <span aria-hidden className="h-px flex-1 bg-line-mid" />
        <span className="shrink-0 signal-sm">{stamp}</span>
      </>
    ) : null}
  </div>
)
