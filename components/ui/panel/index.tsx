import { twMerge } from 'tailwind-merge'

type PanelProps = {
  /** Anton card title. Without one, pass `label` so the region still has a name. */
  title?: React.ReactNode
  /** Mono, right-aligned after the title. */
  meta?: React.ReactNode
  actions?: React.ReactNode
  /** `raised` for most content; `steel` once per page for the featured thing; `sunken` for a well on space-000. */
  tone?: 'raised' | 'steel' | 'sunken' | 'framed'
  label?: string
  className?: string
  style?: React.CSSProperties
  children?: React.ReactNode
}

const TONE = {
  raised: '[--edge:var(--color-line)] [--fill:var(--color-surface-100)]',
  /** A side-rail card: the card edge instead of the hairline, content 14px under the title. */
  framed: '[--edge:var(--color-line-mid)] [--fill:var(--color-surface-100)]',
  steel: '[--edge:var(--color-line-strong)] [--fill:var(--color-steel)]',
  sunken: '[--edge:var(--color-line)] [--fill:var(--color-space-000)]',
}

/** The container: a hairline-edged block, notched at its top-right corner. */
export const Panel = ({ title, meta, actions, tone = 'raised', label, className, style, children }: PanelProps) => (
  <section
    aria-label={title ? undefined : label}
    style={style}
    className={twMerge('cut notch p-4 text-ink [--cut:var(--cut-lg)] min-[720px]:p-6', TONE[tone], className)}
  >
    {title ? (
      <header className={twMerge('mb-5 flex items-baseline gap-3', tone === 'framed' && 'mb-3.5 items-center')}>
        <h3 className="display-3">{title}</h3>
        {meta ? <span className={twMerge('ml-auto signal-sm', tone === 'steel' ? 'text-ink-dim' : 'text-ink-muted')}>{meta}</span> : null}
        {actions}
      </header>
    ) : null}
    {children}
  </section>
)
