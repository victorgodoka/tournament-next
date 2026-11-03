'use client'

/** The statistics pages' building blocks: cards, tier and verdict chips, deck art, filter controls, tracks. */

import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { CardArt } from '@omega/card-art'
import { frameOf } from '@utils/deck/model'
import type { DeckStat } from '@utils/statistics'
import type { WikiCard } from '@utils/wiki'

import { at, BAR, span, WHISKER, type Read } from './format'

// Client modules import the formatters from here too; server ones from './format'.
export * from './format'

/** An instant in the viewer's clock (the server renders its own; the browser corrects it). */
export const LocalTime = ({ iso, locale, day }: { iso: string; locale: string; /** `Mon 02 Nov 19:42` instead of `19:42`. */ day?: boolean }) => (
  <time dateTime={iso} suppressHydrationWarning>
    {new Date(iso).toLocaleString(locale, { ...(day ? { weekday: 'short', day: '2-digit', month: 'short' } : {}), hour: '2-digit', minute: '2-digit', hour12: false })}
  </time>
)

/* ---------------------------------------------------------------- layout */

/** A panel: 16px notch top right, surface-100 over a line-mid edge. */
export const Box = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={twMerge('cut notch flex min-w-0 flex-col [--cut:var(--cut-lg)] [--edge:var(--color-line-mid)] [--fill:var(--color-surface-100)]', className)} {...props}>
    {children}
  </div>
)

export const GoldDot = () => <span aria-hidden className="inline-block size-2 flex-none bg-gold" />

export const SectionHead = ({ title, lede, stamp, id }: { title: string; lede: React.ReactNode; stamp?: React.ReactNode; id?: string }) => (
  <div className="flex flex-col gap-1 min-[720px]:flex-row min-[720px]:flex-wrap min-[720px]:items-end min-[720px]:gap-x-6 min-[720px]:gap-y-3">
    <div className="flex flex-col gap-1 min-[720px]:gap-1.5">
      <h2 id={id} className="m-0 display-2 text-ink max-[719px]:text-[26px]">{title}</h2>
      <p className="m-0 text-ink-dim max-[719px]:text-sm max-[719px]:leading-[22px]">{lede}</p>
    </div>
    {stamp ? <span className="mt-1 text-ink-muted signal-sm min-[720px]:mt-0 min-[720px]:ml-auto">{stamp}</span> : null}
  </div>
)

export const PanelTitle = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <h3 className={twMerge('m-0 display-3 text-ink max-[719px]:text-xl', className)}>{children}</h3>
)

/** 13px dim copy under a panel title. */
export const Lede = ({ children, className }: { children: React.ReactNode; className?: string }) => <p className={twMerge('m-0 text-[13px] leading-5 text-ink-dim', className)}>{children}</p>
/** 12px muted footnote. */
export const Small = ({ children, className }: { children: React.ReactNode; className?: string }) => <span className={twMerge('text-xs leading-4 font-medium text-ink-muted', className)}>{children}</span>


/* ---------------------------------------------------------------- chips */

const TIER_STYLE: Record<string, string> = {
  '1': 'text-gold [--edge:var(--color-gold)] [--fill:var(--color-gold-on)]',
  '1.5': 'text-ink [--edge:var(--color-gold)] [--fill:var(--color-surface-200)]',
  '2': 'text-ink [--edge:var(--color-line-strong)] [--fill:var(--color-surface-200)]',
  '3': 'text-ink-dim [--edge:var(--color-line-mid)] [--fill:var(--color-surface-200)]',
  '4': 'text-ink-muted [--edge:var(--color-line-mid)] [--fill:var(--color-surface-100)]',
}

export const TierChip = ({ tier, size = 'md', className }: { tier: NonNullable<DeckStat['tier']>; size?: 'md' | 'sm'; className?: string }) => (
  <span
    className={twMerge(
      'cut inline-flex flex-none items-center justify-center font-mono font-bold tracking-[0.08em] [--cut:var(--cut-xs)]',
      size === 'sm' ? 'h-5 min-w-9 px-1.5 text-[10px]' : 'h-6 min-w-11 px-2 text-[11px] max-[719px]:h-5.5 max-[719px]:min-w-10 max-[719px]:text-[10px]',
      TIER_STYLE[String(tier)],
      className,
    )}
  >
    T{tier}
  </span>
)

const READ_STYLE: Record<Read, string> = {
  good: 'text-win [--edge:var(--color-win)] [--fill:var(--color-surface-100)]',
  bad: 'text-loss [--edge:var(--color-loss)] [--fill:var(--color-surface-100)]',
  flat: 'text-draw [--edge:var(--color-line-mid)] [--fill:var(--color-surface-200)]',
}

export const ReadChip = ({ read, children, className }: { read: Read; children: React.ReactNode; className?: string }) => (
  <span className={twMerge('cut inline-flex h-6 flex-none items-center gap-1.5 px-2.5 whitespace-nowrap signal-chip [--cut:var(--cut-xs)] max-[719px]:h-5.5 max-[719px]:px-2', READ_STYLE[read], className)}>{children}</span>
)


/* ---------------------------------------------------------------- art */

/** A deck's or card's square art, 1px line-mid edge; without a card, its initial on a dotted well. */
export const Art = ({ id, name, size, dim, fluid, className }: { id?: number | null; name: string; size: number; dim?: boolean; /** Sized by `className`; `size` only picks the image. */ fluid?: boolean; className?: string }) => {
  const style = fluid ? undefined : { width: size, height: size }
  return id ? (
    <span style={style} className={twMerge('block flex-none border border-line-mid bg-surface-200', dim && 'opacity-70', className)}>
      <CardArt art={{ id, name: null }} alt="" sizes={`${size}px`} className="size-full" />
    </span>
  ) : (
    <span
      aria-hidden
      style={style}
      className={twMerge(
        'inline-flex flex-none items-center justify-center border border-line-mid bg-surface-200 bg-[radial-gradient(var(--color-line-mid)_1px,transparent_1px)] bg-size-[6px_6px] font-mono text-[11px] font-bold text-ink-muted',
        className,
      )}
    >
      {name.charAt(0)}
    </span>
  )
}

/** The 4px frame color of a card, or a neutral line before its data lands. */
export const frameColor = (card: Pick<WikiCard, 'kind' | 'monsterTypes'> | undefined) => (card ? `var(--color-type-${frameOf(card)})` : 'var(--color-line-mid)')

/* ---------------------------------------------------------------- filters */

export const Label = ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) =>
  htmlFor ? <label htmlFor={htmlFor} className="text-ink-muted signal">{children}</label> : <span className="text-ink-muted signal">{children}</span>

type SegProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { pressed: boolean; ladder?: 'tcg' | 'genesys' }
const SEG_ON = { tcg: 'text-ladder-tcg [--edge:var(--color-ladder-tcg)] [--fill:var(--color-surface-200)]', genesys: 'text-ladder-genesys [--edge:var(--color-ladder-genesys)] [--fill:var(--color-surface-200)]' }

/** One button of a pressed-state group; TCG and Genesys light up in their ladder's color. */
export const Seg = ({ pressed, ladder, className, children, ...props }: SegProps) => (
  <button
    type="button"
    aria-pressed={pressed}
    className={twMerge(
      'cut inline-flex min-h-10 cursor-pointer items-center justify-center px-4 signal-strong [--cut:var(--cut-sm)] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-cyan max-[719px]:min-h-11 max-[719px]:flex-1 max-[719px]:px-3.5',
      pressed
        ? (ladder ? SEG_ON[ladder] : 'text-ink [--edge:var(--color-cyan)] [--fill:var(--color-ground-cyan)]')
        : 'text-ink-muted [--edge:var(--color-line-mid)] [--fill:var(--color-surface-200)] hover:text-ink hover:[--fill:var(--color-surface-300)]',
      className,
    )}
    {...props}
  >
    {children}
  </button>
)

/** A native select in a chamfered box with its caret. */
export const SelectBox = ({ id, value, onChange, options }: { id: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) => (
  <div className="cut relative flex min-h-10 items-center [--edge:var(--color-line-mid)] [--fill:var(--color-surface-200)] hover:[--edge:var(--color-line-strong)] max-[719px]:min-h-11">
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="min-h-10 w-full cursor-pointer appearance-none bg-transparent pr-10 pl-3.5 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-cyan max-[719px]:min-h-11 max-[719px]:text-[15px] [&>option]:bg-surface-200"
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden fill="var(--color-ink-muted)" className="pointer-events-none absolute right-3.5"><path d="M7 9l5 6 5-6z" /></svg>
  </div>
)

/** Mobile: the filters fold behind one button that says what they are set to. */
export const FilterFold = ({ summary, edit, done, children }: { summary: string; edit: string; done: string; children: React.ReactNode }) => {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="cut flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 px-3.5 text-ink [--edge:var(--color-line-strong)] hover:[--fill:var(--color-surface-300)]"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M3 5h18l-7 8v6l-4 2v-8z" /></svg>
          <span className="truncate text-sm">{summary}</span>
        </span>
        <span className="text-cyan signal-strong">{open ? done : edit}</span>
      </button>
      {open ? children : null}
    </div>
  )
}

/* ---------------------------------------------------------------- charts */

/** A share line with no axes on its own scale, 120×28 drawn into `width`×`height`. */
export const Spark = ({ values, width, height, label, minor }: { values: number[]; width: number; height: number; label: string; minor?: boolean }) => {
  if (values.length < 2) return <span style={{ width }} />
  const min = Math.min(...values)
  const range = Math.max(...values) - min || 1
  const points = values.map((v, i) => `${((i / (values.length - 1)) * 120).toFixed(1)},${(28 - 3 - ((v - min) / range) * 22).toFixed(1)}`).join(' ')
  return (
    <svg width={width} height={height} viewBox="0 0 120 28" preserveAspectRatio="none" role="img" aria-label={label} className="overflow-visible">
      <polyline points={points} fill="none" stroke={minor ? 'var(--color-series-3)' : 'var(--color-series-1)'} strokeWidth={minor ? 1.5 : 2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/**
 * An estimate on [lo, hi]: the interval as a band, the value as a white tick, the 50% line. `expected` adds the gold
 * tick and colors the band by `read`. Heights follow the row: `h` is the track, the rest centers on it.
 */
export const Track = ({ value, low, high, lo, hi, h, read, expected, dim, mid = 0.5 }: {
  value: number; low: number; high: number; lo: number; hi: number; h: number; read?: Read; expected?: number; dim?: boolean; mid?: number
}) => {
  const c = h / 2
  return (
    <span aria-hidden className="relative block" style={{ height: h }}>
      <span className="absolute right-0 left-0 h-px bg-line" style={{ top: c }} />
      <span className="absolute w-px bg-line-mid" style={{ top: c - Math.min(14, h / 2 - 2) + 2, bottom: c - Math.min(14, h / 2 - 2) + 2, left: at(mid, lo, hi) }} />
      <span
        className={twMerge('absolute rounded-xs', dim ? 'bg-line-mid' : expected != null ? BAR[read ?? 'flat'] : 'bg-series-3 opacity-75')}
        style={{ top: c - 3, height: expected != null ? 9 : 7, left: at(low, lo, hi), width: span(low, high, lo, hi) }}
      />
      <span className={twMerge('absolute -ml-px w-0.75', dim ? 'bg-ink-dim' : 'bg-ink')} style={{ top: c - 8, height: 17, left: at(value, lo, hi) }} />
      {expected != null ? <span className="absolute -ml-px w-0.5 bg-gold" style={{ top: c - 14, height: 29, left: at(expected, lo, hi) }} /> : null}
    </span>
  )
}

/** A gap around zero on ±range: the bar from 0 to the gap, the whisker its interval; colored by `read`. */
export const GapTrack = ({ gap, low, high, range, h, read, dim }: { gap: number; low: number; high: number; range: number; h: number; read: Read; dim?: boolean }) => {
  const c = h / 2
  const a = Math.min(0, gap)
  const b = Math.max(0, gap)
  return (
    <span aria-hidden className="relative block" style={{ height: h }}>
      <span className="absolute left-1/2 w-px bg-line-mid" style={{ top: Math.max(0, c - 12), bottom: Math.max(0, c - 12) }} />
      <span className={twMerge('absolute h-px', dim ? 'bg-line-mid' : WHISKER[read])} style={{ top: c, left: at(low, -range, range), width: span(low, high, -range, range) }} />
      <span className={twMerge('absolute rounded-xs', dim ? 'bg-line-mid' : BAR[read])} style={{ top: c - 5, height: 10, left: at(a, -range, range), width: span(a, b, -range, range) }} />
    </span>
  )
}

/** Axis labels over a track column. */
export const Axis = ({ ticks, lo, hi, label, suffix = '%' }: { ticks: number[]; lo: number; hi: number; label: string; suffix?: string }) => (
  <span role="columnheader" aria-label={label} className="relative block h-11">
    {ticks.map((v) => (
      <span key={v} className="absolute top-4 -translate-x-1/2 text-ink-muted signal-sm" style={{ left: at(v, lo, hi) }}>{v}{suffix}</span>
    ))}
  </span>
)

/** One `name n` line of a list column: copies right-aligned in mono. */
export const CountLine = ({ count, name }: { count: number; name: string }) => (
  <div className="grid min-h-7 grid-cols-[22px_1fr] items-center gap-2 border-b border-line max-[719px]:grid-cols-[20px_1fr]">
    <span className="text-right font-mono text-xs text-ink">{count}</span>
    <span className="truncate text-[13px] leading-[18px] text-ink-dim">{name}</span>
  </div>
)

/** Copies text, and says so on the button for two seconds. */
export const CopyButton = ({ text, label, done, className }: { text: string; label: string; done: string; className?: string }) => {
  const [copied, setCopied] = useState(false)
  const copy = () =>
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  return (
    <button type="button" onClick={copy} className={className}>
      {copied ? done : label}
    </button>
  )
}
