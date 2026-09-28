import { twMerge } from 'tailwind-merge'

const TONE = {
  positive: { dot: 'bg-win', edge: '[--edge:var(--color-win)]' },
  negative: { dot: 'bg-crimson-lift', edge: '[--edge:var(--color-crimson-lift)]' },
  warn: { dot: 'bg-gold', edge: '[--edge:var(--color-gold)]' },
  info: { dot: 'bg-azure-lift', edge: '[--edge:var(--color-azure-lift)]' },
}

type AlertProps = {
  /** The square's color: what happened, never decoration. */
  tone?: keyof typeof TONE
  /** Colors the chamfer's edge in the tone as well. */
  edged?: boolean
  /** A chip or tag in place of the square ("Dry run"). */
  badge?: React.ReactNode
  /** No square, no chamfer: a quiet surface-200 box that explains a consequence. */
  plain?: boolean
  title?: React.ReactNode
  children?: React.ReactNode
  /** Right side: Dismiss, Retry, a link. */
  action?: React.ReactNode
  className?: string
}

/** The outcome of something just done, or the consequence of what's about to be: a bold line, the detail under it. */
export const Alert = ({ tone = 'info', edged, badge, plain, title, children, action, className }: AlertProps) => (
  <div
    role={plain ? undefined : tone === 'negative' ? 'alert' : 'status'}
    className={twMerge(
      plain ? 'flex flex-col gap-1.5 bg-surface-200 px-4 py-3.5' : 'cut flex items-start gap-3.5 px-4.5 py-3.5 [--fill:var(--color-surface-200)]',
      edged && TONE[tone].edge,
      badge && 'items-center gap-4',
      className,
    )}
  >
    {plain ? null : (badge ?? <span aria-hidden className={twMerge('mt-1.5 size-2 shrink-0', TONE[tone].dot)} />)}
    <div className={twMerge('flex min-w-0 flex-1 flex-col gap-1', plain && 'contents')}>
      {title ? <span className={plain ? 'text-sm font-bold text-ink' : 'body-strong text-ink'}>{title}</span> : null}
      {children ? <div className="text-ink-dim body-sm">{children}</div> : null}
    </div>
    {action}
  </div>
)
