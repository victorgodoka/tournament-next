import { twMerge } from 'tailwind-merge'
import { Panel } from '@ui/panel'

/**
 * The charts of a tournament's stats tab. Plain divs on the DS tokens, like the ones on /statistics:
 * a tournament has a few dozen decks at most, so nothing here needs a chart library.
 */

const SERIES = [1, 2, 3, 4, 5, 6].map((n) => `var(--color-series-${n})`)
const OTHERS = 'var(--color-line-mid)'
const NOTE = 'text-[13px] leading-5 text-ink-muted'
const pctOf = (value: number, total: number) => `${total ? Math.min(100, (value / total) * 100) : 0}%`

/** Game 1 on the play vs on the draw, as one split bar. */
export const TurnSplit = ({ title, meta, first, firstLabel, secondLabel, format }: {
  title: string
  meta: string
  /** Rate the player going first won, 0–1; `null` with no decided game 1. */
  first: number | null
  firstLabel: string
  secondLabel: string
  format: (rate: number | null) => string
}) => (
  <Panel title={title} meta={meta}>
    <div className="flex flex-col gap-3">
      <div className="flex h-2.5 gap-0.5" aria-hidden>
        <span className="block h-full rounded-l-xs bg-series-1" style={{ width: `${(first ?? 0.5) * 100}%` }} />
        <span className="block h-full flex-1 rounded-r-xs bg-series-3" />
      </div>
      <div className="flex justify-between gap-3 text-[13px] leading-5 text-ink-dim">
        <span className="flex items-center gap-2"><span className="size-2 bg-series-1" />{firstLabel} <b className="text-ink">{format(first)}</b></span>
        <span className="flex items-center gap-2"><b className="text-ink">{format(first === null ? null : 1 - first)}</b> {secondLabel}<span className="size-2 bg-series-3" /></span>
      </div>
    </div>
  </Panel>
)

/** The field as one 100% bar: the six biggest archetypes in color, the rest as `othersLabel`. */
export const ShareStack = ({ title, meta, items, othersLabel, format }: {
  title: string
  meta?: string
  items: { label: string; share: number }[]
  othersLabel: string
  format: (share: number) => string
}) => {
  const top = items.slice(0, SERIES.length)
  const rest = items.slice(SERIES.length).reduce((sum, item) => sum + item.share, 0)
  const parts = [...top.map((item, i) => ({ ...item, color: SERIES[i]! })), ...(rest > 0 ? [{ label: othersLabel, share: rest, color: OTHERS }] : [])]
  return (
    <Panel title={title} meta={meta}>
      <div className="flex flex-col gap-4">
        <div role="img" aria-label={parts.map((p) => `${p.label} ${format(p.share)}`).join(', ')} className="flex h-4 gap-0.5">
          {parts.map((p) => (
            <span key={p.label} className="block h-full first:rounded-l-xs last:rounded-r-xs" style={{ width: `${p.share * 100}%`, background: p.color }} />
          ))}
        </div>
        <ul className="grid grid-cols-1 gap-x-6 gap-y-2 text-[13px] leading-5 text-ink-dim min-[480px]:grid-cols-2">
          {parts.map((p) => (
            <li key={p.label} className="flex min-w-0 items-center gap-2">
              <span aria-hidden className="size-2 shrink-0" style={{ background: p.color }} />
              <span className="truncate">{p.label}</span>
              <span className="ml-auto font-mono text-xs text-ink tabular-nums">{format(p.share)}</span>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  )
}

/** Win rate per archetype as bars off a 50% line: right and cyan won more, left and crimson lost more. */
export const WinRateBars = ({ title, meta, rows, format }: {
  title: string
  meta?: string
  rows: { label: string; winRate: number | null; note: string }[]
  format: (rate: number | null) => string
}) => {
  // The widest gap fills its half; never less than 10 points, so a 51% doesn't look like a blowout.
  const reach = Math.max(0.1, ...rows.map((r) => (r.winRate === null ? 0 : Math.abs(r.winRate - 0.5))))
  return (
    <Panel title={title} meta={meta}>
      <ul className="flex flex-col gap-2.5">
        {rows.map((row) => {
          const gap = row.winRate === null ? 0 : row.winRate - 0.5
          const width = `${(Math.abs(gap) / reach) * 50}%`
          return (
            <li key={row.label} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_4.5rem] items-center gap-3 text-[13px] leading-5">
              <span className="truncate font-bold text-ink">{row.label}</span>
              <span aria-hidden className="relative h-2.5 bg-surface-200">
                <span className="absolute inset-y-0 left-1/2 w-px bg-line-mid" />
                {gap ? (
                  <span
                    className={twMerge('absolute inset-y-0', gap > 0 ? 'left-1/2 rounded-r-xs bg-cyan' : 'right-1/2 rounded-l-xs bg-crimson-lift')}
                    style={{ width }}
                  />
                ) : null}
              </span>
              <span className="text-right">
                <b className="font-mono text-xs text-ink tabular-nums">{format(row.winRate)}</b>
                <span className="block font-mono text-[10px] text-ink-muted tabular-nums">{row.note}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

/** Each archetype's share of the field against its share of the top cut: who went further than its numbers. */
export const Conversion = ({ title, meta, rows, fieldLabel, topLabel, note, format }: {
  title: string
  meta?: string
  rows: { label: string; field: number; top: number }[]
  fieldLabel: string
  topLabel: string
  note: string
  format: (share: number) => string
}) => {
  const max = Math.max(...rows.flatMap((r) => [r.field, r.top]), 0.01)
  return (
    <Panel title={title} meta={meta}>
      <div className="mb-4 flex flex-wrap gap-5 text-[13px] leading-5 text-ink-dim">
        <span className="flex items-center gap-2"><span className="size-2 bg-line-mid" />{fieldLabel}</span>
        <span className="flex items-center gap-2"><span className="size-2 bg-gold" />{topLabel}</span>
      </div>
      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <li key={row.label} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] items-center gap-3">
            <span className="truncate text-[13px] leading-5 font-bold text-ink">{row.label}</span>
            <span className="flex flex-col gap-1">
              {[
                { value: row.field, color: 'bg-line-mid', label: fieldLabel },
                { value: row.top, color: 'bg-gold', label: topLabel },
              ].map((bar) => (
                <span key={bar.label} className="grid grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-2">
                  <span className="block h-2 bg-surface-200" aria-hidden>
                    <span className={twMerge('block h-2 rounded-r-xs', bar.color)} style={{ width: pctOf(bar.value, max) }} />
                  </span>
                  <span className="text-right font-mono text-xs text-ink tabular-nums">
                    <span className="sr-only">{bar.label} </span>{format(bar.value)}
                  </span>
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
      <p className={twMerge(NOTE, 'mt-4')}>{note}</p>
    </Panel>
  )
}

/** A W–D–L record as a split bar with the numbers, for a table cell. */
export const RecordBar = ({ wins, draws, loses }: { wins: number; draws: number; loses: number }) => {
  const total = wins + draws + loses
  return (
    <span className="inline-flex min-w-36 flex-col gap-1">
      <span className="font-mono text-xs tabular-nums">{`${wins}–${loses}–${draws}`}</span>
      <span aria-hidden className="flex h-1.5 gap-px bg-surface-200">
        <span className="block h-full bg-cyan" style={{ width: pctOf(wins, total) }} />
        <span className="block h-full bg-line-mid" style={{ width: pctOf(draws, total) }} />
        <span className="block h-full bg-crimson-lift" style={{ width: pctOf(loses, total) }} />
      </span>
    </span>
  )
}

/** A number with its share as a thin bar under it, for a table cell. */
export const ShareCell = ({ value, max, children }: { value: number; max: number; children: React.ReactNode }) => (
  <span className="inline-flex min-w-20 flex-col items-end gap-1">
    <span className="font-mono text-xs tabular-nums">{children}</span>
    <span aria-hidden className="block h-1.5 w-full bg-surface-200">
      <span className="ml-auto block h-full bg-series-2" style={{ width: pctOf(value, max) }} />
    </span>
  </span>
)
