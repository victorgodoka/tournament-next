import { twMerge } from 'tailwind-merge'
import type { SeoLevel } from '@utils/wiki-seo'

/*
 * The editor's building blocks, drawn on the DS chamfer (`.cut` with --edge / --fill / --sw).
 * Inputs can't carry the chamfer's pseudo-elements, so a `Frame` draws it and the input sits
 * transparent inside; the frame turns cyan and 2px while anything in it has focus.
 */

export type Tone = 'default' | 'warn' | 'danger' | 'active'

const EDGE: Record<Tone, string> = {
  default: '[--edge:var(--color-line-mid)] focus-within:[--edge:var(--color-cyan)] focus-within:[--sw:2px]',
  active: '[--edge:var(--color-cyan)] [--sw:2px]',
  warn: '[--edge:var(--color-gold)]',
  danger: '[--edge:var(--color-crimson-lift)] [--sw:2px]',
}

export const Frame = ({ tone = 'default', className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) => (
  <div className={twMerge('cut flex min-w-0 items-center [--fill:var(--color-surface-200)]', EDGE[tone], className)}>{children}</div>
)

/** The bare input inside a `Frame`. */
export const INPUT = 'block w-full min-w-0 bg-transparent px-3 py-2.5 text-ink placeholder:text-ink-muted focus-visible:outline-none'

/** Label on the left, a count or state on the right. */
export const FieldHead = ({
  htmlFor,
  label,
  meta,
  metaTone,
}: {
  htmlFor?: string
  label: React.ReactNode
  meta?: React.ReactNode
  metaTone?: 'muted' | 'warn' | 'pass' | 'fix'
}) => {
  const Label = htmlFor ? 'label' : 'p'
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <Label htmlFor={htmlFor} className="text-ink-muted signal">
        {label}
      </Label>
      {meta !== undefined ? (
        <span className={twMerge('text-ink-muted signal-sm', metaTone === 'warn' && 'text-gold', metaTone === 'pass' && 'text-win', metaTone === 'fix' && 'text-loss')}>
          {meta}
        </span>
      ) : null}
    </div>
  )
}

export const Help = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <p className={twMerge('mt-1.5 text-ink-muted caption', className)}>{children}</p>
)

/** Green up to the limit, gold past it. */
export const Meter = ({ value, limit, max }: { value: number; limit: number; max: number }) => (
  <div aria-hidden className="mt-2 flex h-1 bg-surface-200">
    <div className="bg-win" style={{ width: `${(Math.min(value, limit) / max) * 100}%` }} />
    {value > limit ? <div className="bg-gold" style={{ width: `${((Math.min(value, max) - limit) / max) * 100}%` }} /> : null}
  </div>
)

const BADGE: Record<SeoLevel | 'block', { label: string; className: string }> = {
  block: { label: 'Block', className: 'bg-crimson text-ink' },
  fix: { label: 'Fix', className: 'bg-loss text-cyan-on' },
  warn: { label: 'Warn', className: 'bg-gold text-gold-on' },
  pass: { label: 'Pass', className: 'bg-win text-cyan-on' },
}

export const Badge = ({ level, className }: { level: SeoLevel | 'block'; className?: string }) => (
  <span className={twMerge('block rounded-xs py-0.75 text-center signal-sm', BADGE[level].className, className)}>{BADGE[level].label}</span>
)

/** Small "New" / count flag on gold. */
export const Flag = ({ children }: { children: React.ReactNode }) => (
  <span className="rounded-xs bg-gold px-1.25 py-0.5 text-gold-on signal-sm">{children}</span>
)

/** Chamfered chip: keywords, tags, "Free ✓". */
export const Pill = ({ children, tone = 'cyan', className }: { children: React.ReactNode; tone?: 'cyan' | 'neutral' | 'warn'; className?: string }) => (
  <span
    className={twMerge(
      'cut inline-flex items-center gap-1.5 px-2 py-1.25 text-ink signal-sm [--cut:var(--cut-xs)]',
      tone === 'cyan' && '[--edge:var(--color-ground-cyan)] [--fill:var(--color-ground-cyan)]',
      tone === 'neutral' && '[--edge:var(--color-surface-300)] [--fill:var(--color-surface-300)]',
      tone === 'warn' && 'text-gold [--edge:var(--color-gold)] [--fill:var(--color-surface-200)]',
      className,
    )}
  >
    {children}
  </span>
)

/** Notched panel (top-right cut) with a mono head row. */
export const Panel = ({
  title,
  meta,
  edge = 'mid',
  className,
  children,
  ...props
}: {
  title?: React.ReactNode
  meta?: React.ReactNode
  edge?: 'mid' | 'line'
} & React.HTMLAttributes<HTMLElement>) => (
  <section
    className={twMerge(
      'cut notch [--cut:var(--cut-lg)]',
      edge === 'line' ? '[--edge:var(--color-line)]' : '[--edge:var(--color-line-mid)]',
      className,
    )}
    {...props}
  >
    {title !== undefined ? (
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <h2 className="text-ink-muted signal-strong">{title}</h2>
        {meta !== undefined ? <span className="text-ink-muted signal-sm">{meta}</span> : null}
      </div>
    ) : null}
    {children}
  </section>
)

/** 32px square icon button used across block rows. Always pass an aria-label. */
export const ICON =
  'inline-flex size-8 shrink-0 cursor-pointer items-center justify-center border border-line bg-surface-100 text-ink-dim signal-strong hover:border-cyan hover:text-cyan disabled:pointer-events-none disabled:opacity-40'

/** Checkbox row. */
export const Check = ({
  id,
  checked,
  onChange,
  children,
  className,
}: {
  id: string
  checked: boolean
  onChange: (checked: boolean) => void
  children: React.ReactNode
  className?: string
}) => (
  <div className={twMerge('flex items-center gap-2.5', className)}>
    <input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="m-0 size-4 shrink-0 accent-cyan" />
    <label htmlFor={id} className="text-ink body-sm">
      {children}
    </label>
  </div>
)

const TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })
const DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

/** `19:44` today, `Sat 12 Sep 18:04` otherwise. Client-only: call it from event-driven state, not SSR. */
export const when = (value: string | number, now = Date.now()) => {
  const date = new Date(value)
  return new Date(now).toDateString() === date.toDateString() ? `Today ${TIME.format(date)}` : `${DAY.format(date)} ${TIME.format(date)}`
}

export const clock = (value: string | number) => TIME.format(new Date(value))
