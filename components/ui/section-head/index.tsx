import { twMerge } from 'tailwind-merge'

type SectionHeadProps = {
  /** Two-digit section number in gold mono, e.g. `03`. */
  num?: string
  as?: 'h2' | 'h3'
  /** Card-title size (display-3) with a hairline running to `end`: a section inside a working screen. */
  compact?: boolean
  /** Right side after the rule: a mono stamp or the section's controls. With `compact` or `ruled`. */
  end?: React.ReactNode
  /** Card-title size under a hairline, the number in gold Anton: a section of a page's main column. */
  ruled?: boolean
  id?: string
  className?: string
  children: React.ReactNode
}

/** Numbered display heading that opens a section inside a page, as opposed to {@link RailHead}'s strip. */
export const SectionHead = ({ num, as: Heading = 'h2', compact, end, ruled, id, className, children }: SectionHeadProps) =>
  ruled ? (
    <div className={twMerge('flex items-baseline gap-3 border-t border-line pt-3 min-[720px]:gap-3.5 min-[720px]:pt-3.5', className)}>
      {num ? <span className="text-gold display-3">{num}</span> : null}
      <Heading id={id} className="text-ink display-3">{children}</Heading>
      {typeof end === 'string' ? <span className="ml-auto text-ink-muted signal-sm max-[719px]:hidden">{end}</span> : end}
    </div>
  ) : compact ? (
    <div className={twMerge('flex flex-wrap items-center gap-3.5', className)}>
      {num ? <span className="font-bold text-gold signal-strong">{num}</span> : null}
      <Heading className="text-ink display-3">{children}</Heading>
      <span aria-hidden className="h-px min-w-6 flex-1 bg-line" />
      {typeof end === 'string' ? <span className="text-ink-muted signal-sm">{end}</span> : end}
    </div>
  ) : (
    <div className={twMerge('flex items-baseline gap-3', className)}>
      {num ? <span className="font-bold text-gold signal">{num}</span> : null}
      <Heading className="text-ink display-2">{children}</Heading>
    </div>
  )
