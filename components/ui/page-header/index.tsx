import { twMerge } from 'tailwind-merge'
import { Eyebrow } from '@ui/eyebrow'

type PageHeaderProps = {
  /** What's here: "Your decks", "Omega Weekly #212". */
  title: React.ReactNode
  /** Where you are: "Deck Manager", "Tournament". */
  eyebrow?: React.ReactNode
  eyebrowTone?: React.ComponentProps<typeof Eyebrow>['tone']
  eyebrowMeta?: React.ReactNode
  lead?: React.ReactNode
  /** Actions on the right. One primary at most, and it goes last. */
  end?: React.ReactNode
  /**
   * A workspace screen under its own top bar: no hairline or top padding, the eyebrow without its
   * rule, and an 18px lead.
   */
  flush?: boolean
  className?: string
}

/** The top of a page: Eyebrow, Anton title, optional lead, actions on the right, closed by a hairline. */
export const PageHeader = ({ title, eyebrow, eyebrowTone, eyebrowMeta, lead, end, flush, className }: PageHeaderProps) => (
  <header className={twMerge('flex flex-wrap items-end gap-5 border-b border-line pt-8 pb-5', flush && 'gap-6 border-0 p-0', className)}>
    <div className={twMerge('flex min-w-65 flex-1 flex-col gap-3', flush && 'gap-3.5')}>
      {eyebrow ? (
        <Eyebrow tone={eyebrowTone} meta={eyebrowMeta} rule={!flush}>
          {eyebrow}
        </Eyebrow>
      ) : null}
      <h1 className="text-ink display-1">{title}</h1>
      {lead ? <p className={flush ? 'max-w-190 text-ink-dim lead' : 'max-w-[60ch] text-ink-dim body'}>{lead}</p> : null}
    </div>
    {end ? <div className={twMerge('flex flex-wrap items-center gap-3', flush && 'gap-4 pb-1')}>{end}</div> : null}
  </header>
)
