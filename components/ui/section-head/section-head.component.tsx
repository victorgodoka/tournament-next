import { twMerge } from 'tailwind-merge'

type SectionHeadProps = {
  /** Two-digit section number in gold mono, e.g. `03`. */
  num?: string
  as?: 'h2' | 'h3'
  className?: string
  children: React.ReactNode
}

/** Numbered display heading that opens a section inside a page, as opposed to {@link RailHead}'s full-bleed band. */
export const SectionHead = ({ num, as: Heading = 'h2', className, children }: SectionHeadProps) => (
  <div className={twMerge('flex items-baseline gap-3.5', className)}>
    {num ? <span className="text-gold signal-lg">{num}</span> : null}
    <Heading className="text-ink display-4">{children}</Heading>
  </div>
)
