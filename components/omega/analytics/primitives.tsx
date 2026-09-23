import { twMerge } from 'tailwind-merge'
import { CardArt } from '@omega/card-art'
import type { Side } from '@utils/analytics'

/**
 * One colour per side for the whole duel view: gold is `player1` (the winner, unless a draw),
 * cyan is `player2`. Every mark also carries the duelist's name, so colour is never the only cue.
 */
export const SIDE = {
  player1: { text: 'text-gold', bg: 'bg-gold', border: 'border-gold', ground: 'bg-ground-gold', stripe: 'shadow-[inset_2px_0_0_var(--color-gold)]' },
  player2: { text: 'text-cyan', bg: 'bg-cyan', border: 'border-cyan', ground: 'bg-ground-cyan', stripe: 'shadow-[inset_2px_0_0_var(--color-cyan)]' },
} as const satisfies Record<Side, Record<string, string>>

export const other = (side: Side): Side => (side === 'player1' ? 'player2' : 'player1')

/** Label over value, hairline-gapped: the same grid the ladder card uses. */
export const StatTiles = ({
  items,
  className,
}: {
  items: { label: string; value: React.ReactNode; tone?: string; note?: React.ReactNode }[]
  className?: string
}) => (
  <dl className={twMerge('grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-3 lg:grid-cols-(--cols)', className)} style={{ '--cols': `repeat(${Math.min(items.length, 6)}, minmax(0, 1fr))` } as React.CSSProperties}>
    {items.map(({ label, value, tone, note }) => (
      <div key={label} className="min-w-0 bg-surface-000 px-4 py-3.5">
        <dt className="truncate text-ink-muted signal-sm">{label}</dt>
        <dd className={twMerge('mt-1.75 text-ink display-5 tabular-nums', tone)}>{value}</dd>
        {note ? <dd className="mt-1 truncate text-ink-muted mono-note">{note}</dd> : null}
      </div>
    ))}
  </dl>
)

/**
 * A rate as a flat bar over a hairline track. `null` renders an empty track and a dash, never 0%.
 * The number sits beside the bar, so the bar is never the only way to read the value.
 */
export const Meter = ({
  label,
  rate,
  value,
  tone = 'bg-gold',
  className,
}: {
  label: React.ReactNode
  rate: number | null
  /** Text beside the bar; defaults to the rate as a percentage. */
  value?: React.ReactNode
  tone?: string
  className?: string
}) => (
  <div className={twMerge('min-w-0', className)}>
    <div className="flex items-baseline justify-between gap-3">
      <span className="truncate text-ink-muted signal-sm">{label}</span>
      <span className="shrink-0 text-ink mono-data tabular-nums">{value ?? (rate === null ? '—' : `${Math.round(rate * 100)}%`)}</span>
    </div>
    <div aria-hidden className="mt-1.5 h-1.5 bg-surface-300">
      <div className={twMerge('h-full', tone)} style={{ width: `${Math.max(0, Math.min(1, rate ?? 0)) * 100}%` }} />
    </div>
  </div>
)

/** Card thumbnail plus its name. `name: null` is an unknown passcode: show the number. */
export const CardLine = ({
  id,
  name,
  size = 'md',
  children,
  className,
}: {
  id: number
  name: string | null
  size?: 'sm' | 'md'
  /** A second line under the name. */
  children?: React.ReactNode
  className?: string
}) => (
  <div className={twMerge('flex min-w-0 items-center gap-3', className)}>
    <CardArt
      art={{ id, name }}
      alt=""
      sizes={size === 'sm' ? '32px' : '40px'}
      className={twMerge('shrink-0 border border-line', size === 'sm' ? 'size-8' : 'size-10')}
    />
    <div className="min-w-0">
      <p className="truncate text-ink body-strong" title={name ?? undefined}>
        {name ?? <span className="text-ink-muted mono-data">#{id}</span>}
      </p>
      {children ? <div className="mt-0.5 text-ink-muted mono-data">{children}</div> : null}
    </div>
  </div>
)

/** Small uppercase heading inside a panel, below a section head. */
export const PanelLabel = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <h3 className={twMerge('text-ink-muted signal', className)}>{children}</h3>
)

/** Pulsing placeholder rows while a slow endpoint answers. Still under reduced motion. */
export const Skeleton = ({ rows = 4, label }: { rows?: number; label: string }) => (
  <div role="status" className="grid gap-2">
    <span className="sr-only">{label}</span>
    {Array.from({ length: rows }, (_, i) => (
      <div key={i} aria-hidden className="h-12 bg-surface-100 motion-safe:animate-pulse" style={{ animationDelay: `${i * 90}ms` }} />
    ))}
  </div>
)
