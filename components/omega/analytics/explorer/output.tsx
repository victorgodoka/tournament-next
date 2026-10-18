'use client'

import { twMerge } from 'tailwind-merge'
import { EmptyBox } from '@omega/profile/empty-box'
import { Skeleton } from '@omega/analytics/primitives'
import {
  SOURCE_NAME, WIN_LOSS, blocker, dimNatural, fixFor, fmt,
  type Catalog, type ExplorationConfig, type GroupSegment, type LineData, type PivotResult,
} from '@utils/explorer'

/** Why seasons couldn't load, or the skeleton while they do. */
export const SeasonsGate = ({ pending, failure, empty }: { pending: boolean; failure?: 'error'; empty: string }) =>
  failure === 'error' ? (
    <EmptyBox title="Analytics unavailable" className="mt-6">Couldn&apos;t load the season. Try again in a moment.</EmptyBox>
  ) : pending ? (
    <div className="mt-6"><Skeleton rows={8} label="Reading the ranked season…" /></div>
  ) : (
    <EmptyBox title="No season to compare" className="mt-6">{empty}</EmptyBox>
  )

const cellText = (v: number | null) => (v === null ? 'text-ink-muted' : 'text-ink-dim')

/** Win/loss rates tint around 50%, everything else scales with the grid's maximum. Under 3 games fades. */
const heat = (v: number | null, wl: boolean, max: number, n: number) => {
  if (v === null) return undefined
  let a = wl ? Math.min(0.62, Math.abs(v - 0.5) * 1.5 + 0.05) : max ? 0.06 + (v / max) * 0.5 : 0
  if (n < 3) a *= 0.35
  const color = wl ? (v >= 0.5 ? 'var(--color-win)' : 'var(--color-loss)') : 'var(--color-cyan)'
  return `color-mix(in srgb, ${color} ${(a * 100).toFixed(1)}%, transparent)`
}

type Edit = (fn: (t: ExplorationConfig) => void) => void
type ViewProps = { cat: Catalog; res: PivotResult; cfg: ExplorationConfig }

const Table = ({ cat, res, cfg, onEdit }: ViewProps & { onEdit?: Edit }) => {
  const heatmap = cfg.technique === 'heatmap'
  const multi = res.segs.length > 1
  const metric = (i: number) => cat.metrics.get(res.values[i]!)!
  const M0 = metric(0)
  const wl0 = WIN_LOSS.has(M0.id)
  const labelHead = res.rowDims.length ? res.rowDims.map((d) => cat.dimensions.get(d)?.label).join(' / ') : res.source
  const natural = res.rowDims[0] && dimNatural(res.rowDims[0])
  const max = Math.max(0, ...res.groups.flatMap((g) => g.seg.flatMap((s) => s.cells.map((c) => c.value ?? 0))))
  const span = 1 + (res.colDim ? res.colList.length : res.values.length)

  const cells = (s: GroupSegment) =>
    res.colDim
      ? s.cells.map((c, i) => (
        <td key={i} className="border-l border-space-000 px-3.5 py-2 text-right" style={{ background: heatmap ? heat(c.value, wl0, max, c.n) : undefined }}>
          <span className={twMerge('block mono-data tabular-nums', heatmap && c.n >= 3 ? 'text-ink' : cellText(c.value))}>{fmt(c.value, M0.format)}</span>
          {heatmap && c.n ? <span className="block text-ink-muted mono-note">n {c.n}</span> : null}
        </td>
      ))
      : s.vals.map((v, i) => {
        const M = metric(i)
        const tone = WIN_LOSS.has(M.id) && v !== null && s.n >= 3 ? (v >= 0.5 ? 'text-win' : 'text-loss') : cellText(v)
        return <td key={i} className={twMerge('px-3.5 py-2 text-right mono-data tabular-nums', tone)}>{fmt(v, M.format)}</td>
      })

  const label = (g: PivotResult['groups'][number]) => (
    <>
      <span className="block truncate text-ink body-strong">{g.labels[0]}</span>
      {g.labels[1] ? <span className="block truncate text-ink-muted mono-note">{g.labels[1]}</span> : null}
    </>
  )

  return (
    <>
      <div className="mt-4 overflow-x-auto border border-line">
        <table className="w-full min-w-[560px] border-collapse">
          <thead className="bg-surface-200">
            <tr className="border-b border-line">
              <th scope="col" className="w-[36%] px-4 py-3 text-left font-normal text-ink-muted signal-sm">{labelHead}</th>
              {res.colDim
                ? res.colList.map((c) => <th key={JSON.stringify(c.v)} scope="col" className="px-3.5 py-3 text-right font-normal text-ink-muted signal-sm">{c.label}</th>)
                : res.values.map((m, i) => {
                  const M = metric(i)
                  const on = cfg.sort ? cfg.sort.value === i : !natural && i === 0
                  const dir = cfg.sort?.direction ?? 'desc'
                  const text = <>{M.label} {on ? (dir === 'asc' ? '↑' : '↓') : ''}</>
                  return (
                    <th key={m} scope="col" aria-sort={on ? (dir === 'asc' ? 'ascending' : 'descending') : undefined} className="p-0 text-right font-normal">
                      {onEdit ? (
                        <button
                          type="button"
                          title={M.description || undefined}
                          onClick={() => onEdit((t) => (t.sort = { value: i, direction: on && dir === 'desc' ? 'asc' : 'desc' }))}
                          className={twMerge('min-h-11 w-full px-3.5 text-right signal-sm hover:text-ink', on ? 'text-ink' : 'text-ink-muted')}
                        >
                          {text}
                        </button>
                      ) : (
                        <span title={M.description || undefined} className={twMerge('block px-3.5 py-3 signal-sm', on ? 'text-ink' : 'text-ink-muted')}>{text}</span>
                      )}
                    </th>
                  )
                })}
            </tr>
          </thead>
          <tbody>
            {res.totals && !res.colDim
              ? res.segs.map((sg, si) => (
                <tr key={`total-${sg.id}`} className="border-b border-line bg-ground-soft">
                  <th scope="row" className="px-4 py-2.5 text-left font-normal">
                    <span className="flex items-center gap-2">
                      {multi ? <span aria-hidden className="size-2 shrink-0" style={{ background: sg.color }} /> : null}
                      <span className="text-ink signal-sm">{multi ? sg.label : 'Totals'}</span>
                      {multi ? null : <span className="text-ink-muted mono-note">{fmt(res.totals![si]!.count, 'count')} {res.unit}</span>}
                    </span>
                  </th>
                  {res.totals![si]!.vals.map((v, i) => (
                    <td key={i} className="px-3.5 py-2.5 text-right font-bold text-ink mono-data tabular-nums">{fmt(v, metric(i).format)}</td>
                  ))}
                </tr>
              ))
              : null}
            {res.groups.map((g) =>
              multi ? (
                [
                  <tr key={g.key} className="border-b border-line bg-ground-subtle">
                    <th scope="rowgroup" colSpan={span} className="px-4 py-2 text-left font-normal">{label(g)}</th>
                  </tr>,
                  ...g.seg.map((s, si) => (
                    <tr key={`${g.key}-${si}`} className="border-b border-line hover:bg-surface-100">
                      <th scope="row" className="py-2 pr-3 pl-7.5 text-left font-normal">
                        <span className="flex items-center gap-2">
                          <span aria-hidden className="size-2 shrink-0" style={{ background: res.segs[si]!.color }} />
                          <span className="text-ink-dim signal-sm">{res.segs[si]!.label}</span>
                          {s.n ? null : <span className="text-ink-muted mono-note">No {res.unit}</span>}
                        </span>
                      </th>
                      {cells(s)}
                    </tr>
                  )),
                ]
              ) : (
                <tr key={g.key} className="border-b border-line hover:bg-surface-100">
                  <th scope="row" className="max-w-0 px-4 py-2 text-left font-normal">{label(g)}</th>
                  {cells(g.seg[0]!)}
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-2.5 flex flex-wrap justify-between gap-3 text-ink-muted signal-sm">
        <span>{res.totalGroups > res.groups.length ? `Showing ${res.groups.length} of ${res.totalGroups} rows` : `${res.totalGroups} rows`}</span>
        {res.colDim ? (
          <span>
            {M0.label} by {cat.dimensions.get(res.colDim)?.label.toLowerCase()}
            {res.hiddenCols ? ` · ${res.hiddenCols} more columns hidden` : ''}
          </span>
        ) : null}
      </div>
      {heatmap ? (
        <div className="mt-3 flex flex-wrap items-center gap-3.5 text-ink-muted signal-sm">
          {wl0 ? (
            <>
              <span className="flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-3.5 bg-loss/50" />Below 50%</span>
              <span className="flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-3.5 bg-win/50" />Above 50%</span>
            </>
          ) : null}
          <span>Faded cells: fewer than 3 {res.unit}</span>
        </div>
      ) : null}
    </>
  )
}

const Bars = ({ cat, res, cfg }: ViewProps) => {
  const M = cat.metrics.get(res.values[0]!)!
  const wl = WIN_LOSS.has(M.id)
  const top = Math.max(0, ...res.groups.flatMap((g) => g.seg.map((s) => s.vals[0] ?? 0)))
  const max = wl ? 1 : top
  return (
    <>
      <div className="mt-4 border border-line">
        <div className="grid grid-cols-[minmax(110px,230px)_minmax(0,1fr)] border-b border-line bg-surface-200">
          <span className="px-4 py-3 text-ink-muted signal-sm">{res.rowDims.map((d) => cat.dimensions.get(d)?.label).join(' / ')}</span>
          <span className="flex justify-between py-3 pr-18 text-ink-muted signal-sm">
            {M.label}
            <span className="mono-note normal-case">0 · {fmt(max / 2, M.format)} · {fmt(max, M.format)}</span>
          </span>
        </div>
        {res.groups.map((g) => (
          <div key={g.key} className="grid grid-cols-[minmax(110px,230px)_minmax(0,1fr)] items-center border-b border-line last:border-b-0">
            <span className="truncate px-4 py-2.5 text-ink body-strong" title={g.labels.join(' / ')}>{g.labels.join(' / ')}</span>
            <div className="grid gap-1 py-2 pr-2">
              {g.seg.map((s, si) => (
                <div key={si} className="flex items-center gap-2.5">
                  <div className="relative h-3 flex-1 bg-surface-200">
                    <div className="absolute inset-y-0 left-0" style={{ width: `${s.vals[0] && max ? (s.vals[0] / max) * 100 : 0}%`, background: res.segs[si]!.color }} />
                    {wl ? <div aria-hidden className="absolute -inset-y-0.75 left-1/2 w-px bg-line-strong" /> : null}
                  </div>
                  <span className="w-15 text-right text-ink-dim mono-data tabular-nums">{fmt(s.vals[0], M.format)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2.5 text-ink-muted signal-sm">{cfg.columns ? 'Bars use the first metric; Columns are ignored here' : 'Bars show the first metric in Values'}</p>
    </>
  )
}

const Line = ({ cat, res, cfg, line }: ViewProps & { line: LineData }) => {
  const M = cat.metrics.get(res.values[0]!)!
  const { maxDay, series } = line
  const all = series.flatMap((s) => s.points.flatMap((p) => (p.value === null ? [] : [p.value])))
  const hi = M.format === 'rate' ? 1 : Math.max(1, ...all) * 1.15
  const y = (v: number) => (1 - v / hi) * 100
  const x = (d: number) => (maxDay === 1 ? 50 : ((d - 1) / (maxDay - 1)) * 100)
  const step = maxDay > 24 ? 5 : 3
  return (
    <>
      <div className="mt-4 border border-line py-5 pr-5 pb-9 pl-16">
        <p className="-ml-11 mb-3.5 text-ink-muted signal-sm">{M.label} · {cfg.runningTotal ? 'running total from day 1' : 'per day'}</p>
        <div className="relative h-[clamp(220px,30vw,340px)]">
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <div key={t} aria-hidden>
              <div className={twMerge('absolute inset-x-0 h-px', WIN_LOSS.has(M.id) && t === 0.5 ? 'bg-ink-muted' : 'bg-line')} style={{ top: `${y(hi * t)}%` }} />
              <span className="absolute -left-14.5 w-12 -translate-y-1/2 text-right text-ink-muted mono-note" style={{ top: `${y(hi * t)}%` }}>{fmt(hi * t, M.format)}</span>
            </div>
          ))}
          <svg viewBox="0 0 1000 300" preserveAspectRatio="none" aria-hidden className="absolute inset-0 size-full overflow-visible">
            {series.map((s) => (
              <polyline
                key={s.label}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                points={s.points.flatMap((p) => (p.value === null ? [] : [`${(x(p.day) * 10).toFixed(1)},${(y(p.value) * 3).toFixed(1)}`])).join(' ')}
              />
            ))}
          </svg>
          {series.flatMap((s) =>
            s.points.map((p) =>
              p.value === null ? null : (
                <span
                  key={`${s.label}-${p.day}`}
                  title={`${s.label} · Day ${p.day} · ${fmt(p.value, M.format)}`}
                  className="absolute -mt-0.75 -ml-0.75 size-1.75"
                  style={{ left: `${x(p.day)}%`, top: `${y(p.value)}%`, background: s.color }}
                />
              ),
            ),
          )}
          {Array.from({ length: Math.ceil(maxDay / step) }, (_, i) => 1 + i * step).map((d) => (
            <span key={d} aria-hidden className="absolute top-full mt-2.5 -translate-x-1/2 text-ink-muted mono-note" style={{ left: `${x(d)}%` }}>
              D{String(d).padStart(2, '0')}
            </span>
          ))}
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-px border border-t-0 border-line bg-line md:grid-cols-4">
        {series.map((s) => {
          const last = s.points.findLast((p) => p.value !== null)
          return (
            <div key={s.label} className="bg-space-000 px-4 py-3">
              <dt className="flex items-center gap-2 text-ink-muted signal-sm"><span aria-hidden className="size-2.25" style={{ background: s.color }} />{s.label}</dt>
              <dd className="mt-2 text-ink display-5 tabular-nums">{fmt(last?.value, M.format)}</dd>
              <dd className="mt-0.5 text-ink-muted mono-note">{cfg.runningTotal ? 'Season to date' : 'Last day played'}</dd>
            </div>
          )
        })}
      </dl>
    </>
  )
}

type OutputProps = {
  cat: Catalog
  cfg: ExplorationConfig
  /** The cut (`runGlobal`). */
  res: PivotResult
  /** The line technique's series, over the same segments. */
  line: (res: PivotResult) => LineData
  /** Owner controls: sort headers and the blocker's fix. Read-only when absent. */
  onEdit?: Edit
}

/** Legend, then the chosen technique, or why it can't draw this configuration. */
export const ExplorationOutput = ({ cat, cfg, res, line, onEdit }: OutputProps) => {
  const block = blocker(cfg, res)
  const fix = block && onEdit ? fixFor(cat, cfg) : null
  const series = cfg.technique === 'line' && !block ? line(res) : null
  const legend = series ? series.series : res.segs.length > 1 ? res.segs : []

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-line py-2.5">
        <span className="flex-1 text-ink-muted signal-sm">
          Source · {SOURCE_NAME[res.source]}
          {res.note ? ` · ${res.note}` : ''}
        </span>
        {legend.map((l) => (
          <span key={l.label} className="flex items-center gap-1.75 text-ink-dim signal-sm">
            <span aria-hidden className="size-2.25" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
      </div>

      {block ? (
        <EmptyBox title={block.title} className="mt-6">
          {block.body}
          {fix ? (
            <button type="button" onClick={() => onEdit!(fix.apply)} className="mx-auto mt-4 flex min-h-11 items-center border border-cyan px-4 text-cyan signal-chip hover:bg-ground-cyan">
              {fix.label}
            </button>
          ) : null}
        </EmptyBox>
      ) : cfg.technique === 'bars' ? (
        <Bars cat={cat} res={res} cfg={cfg} />
      ) : series ? (
        <Line cat={cat} res={res} cfg={cfg} line={series} />
      ) : (
        <Table cat={cat} res={res} cfg={cfg} onEdit={onEdit} />
      )}
    </>
  )
}
