'use client'

import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { useLazyText } from '@hooks/index'
import {
  COLUMN_LIMIT, COLUMN_SORTS, THRESHOLD_OPS, accepts, capOf, dimReason, drop, inUse, metricReason, quickAdd, removeFrom, segColor, sourcesOf,
  type Catalog, type ColumnSort, type ExplorationConfig, type FilterValue, type Payload, type SegmentOption, type Source, type Technique,
  type Threshold, type ThresholdOp, type Zone,
} from '@utils/explorer'

const SELECT = 'h-9 border border-line bg-surface-200 px-2 text-ink mono-data'

/** How many columns a cross-tab shows, and in what order. Nothing when Columns is empty. */
export const ColumnControls = ({ cat, cfg, edit }: { cat: Catalog; cfg: ExplorationConfig; edit: (fn: (t: ExplorationConfig) => void) => void }) => {
  if (!cfg.columns) return null
  const limit = cfg.columnLimit ?? COLUMN_LIMIT
  return (
    <>
      <label className="flex items-center gap-2 text-ink-muted signal-sm">
        Columns
        <select value={limit} onChange={(e) => { const v = Number(e.target.value); edit((t) => (t.columnLimit = v)) }} className={SELECT}>
          {[...new Set([4, 6, 8, 12, 20, cat.limits.rowLimit, limit])].sort((a, b) => a - b).map((n) => (
            <option key={n} value={n}>{n === cat.limits.rowLimit ? `All (${n})` : n}</option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-ink-muted signal-sm">
        Column order
        <select value={cfg.columnSort ?? ''} onChange={(e) => { const v = (e.target.value || null) as ColumnSort | null; edit((t) => (t.columnSort = v)) }} className={SELECT}>
          <option value="">Default</option>
          {COLUMN_SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </label>
    </>
  )
}

/** Row filters on a metric (`HAVING`). A rate is typed in percent and stored 0..1. */
export const ThresholdControls = ({ cat, cfg, edit }: { cat: Catalog; cfg: ExplorationConfig; edit: (fn: (t: ExplorationConfig) => void) => void }) => {
  if (!cfg.values.length) return null
  const list = cfg.thresholds ?? []
  const rate = (i: number) => cat.metrics.get(cfg.values[i] ?? '')?.format === 'rate'
  const set = (i: number, patch: Partial<Threshold>) => edit((t) => (t.thresholds![i] = { ...t.thresholds![i]!, ...patch }))
  const taken = (value: number, op: ThresholdOp, skip: number) => list.some((h, j) => j !== skip && h.value === value && h.op === op)
  return (
    <>
      {list.map((h, i) => (
        <span key={i} className="flex items-center gap-1 text-ink-muted signal-sm">
          Keep
          <select value={h.value} onChange={(e) => set(i, { value: Number(e.target.value), target: 0 })} className={SELECT} aria-label="Metric">
            {cfg.values.map((m, j) => <option key={m} value={j} disabled={taken(j, h.op, i)}>{cat.metrics.get(m)?.label ?? m}</option>)}
          </select>
          <select value={h.op} onChange={(e) => set(i, { op: e.target.value as ThresholdOp })} className={SELECT} aria-label="Comparison">
            {THRESHOLD_OPS.map((o) => <option key={o.id} value={o.id} disabled={taken(h.value, o.id, i)}>{o.label}</option>)}
          </select>
          <input
            type="number"
            min={0}
            max={rate(h.value) ? 100 : undefined}
            step="any"
            value={rate(h.value) ? +(h.target * 100).toFixed(4) : h.target}
            onChange={(e) => {
              const n = Math.max(0, Number(e.target.value) || 0)
              set(i, { target: rate(h.value) ? Math.min(n, 100) / 100 : n })
            }}
            aria-label="Threshold"
            className={twMerge(SELECT, 'w-20')}
          />
          {rate(h.value) ? '%' : null}
          <button type="button" onClick={() => edit((t) => t.thresholds!.splice(i, 1))} aria-label="Remove threshold" className="h-9 px-2 text-ink-dim hover:text-ink">×</button>
        </span>
      ))}
      {list.length < cat.limits.filters ? (
        <button
          type="button"
          onClick={() => {
            const op = THRESHOLD_OPS.find((o) => !taken(0, o.id, -1))?.id
            if (op) edit((t) => (t.thresholds = [...(t.thresholds ?? []), { value: 0, op, target: 0 }]))
          }}
          className="h-9 border border-line px-3 text-ink-dim signal-sm hover:border-ink hover:text-ink"
        >
          + Threshold
        </button>
      ) : null}
    </>
  )
}

const TECHNIQUE_LABEL: Record<Technique, string> = { table: 'Table', heatmap: 'Heatmap', bars: 'Bars', line: 'Line' }
const SOURCE_LABEL: Record<Source, string> = { games: 'Games', cards: 'Cards', handTraps: 'Hand traps', rating: 'Rating', days: 'Over time', groups: 'Engines & techs' }
/** Panel groups: the catalog doesn't group dimensions, so the client does. */
const DIM_GROUP: Record<string, string> = {
  archetype: 'Deck', archetypePart: 'Deck', card: 'Deck', engine: 'Deck', tech: 'Deck', opponentArchetype: 'Opponent', opponentArchetypePart: 'Opponent', opponent: 'Opponent', turnOrder: 'Game', gameNumber: 'Game',
  result: 'Game', match: 'Game', seasonDay: 'Time', handTrap: 'Hand traps', activatedBy: 'Hand traps',
}
const ZONE_LABEL: Record<Zone, string> = { segments: 'Segments', rows: 'Rows', columns: 'Columns', values: 'Values', filters: 'Filters' }

const Rule = ({ tone, children, meta }: { tone: string; children: React.ReactNode; meta: string }) => (
  <div className="flex items-center gap-2.5 px-4.5 pt-5 pb-1.5">
    <span className={twMerge('signal-sm', tone)}>{children}</span>
    <span aria-hidden className="h-px flex-1 bg-line" />
    <span className="text-ink-muted signal-sm">{meta}</span>
  </div>
)

type VarRowProps = {
  label: string
  sub?: string
  title?: string
  marker: string
  /** It can't be added right now. */
  off: boolean
  /** The zone it already sits in. */
  zone?: Zone
  /** Segments: "+" adds, "−" removes. */
  toggle?: boolean
  onAdd: () => void
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: () => void
}

const VarRow = ({ label, sub, title, marker, off, zone, toggle, onAdd, onDragStart, onDragEnd }: VarRowProps) => (
  <li
    draggable={!off && !zone}
    onDragStart={onDragStart}
    onDragEnd={onDragEnd}
    title={title}
    className={twMerge(
      'flex min-h-9 items-center gap-2.5 border-t border-line pr-2 pl-4.5 hover:bg-surface-300',
      zone && 'bg-surface-100',
      off ? 'cursor-not-allowed opacity-45' : !zone && 'cursor-grab',
    )}
  >
    <span aria-hidden className="size-2 shrink-0" style={{ background: off ? 'var(--color-surface-400)' : marker }} />
    <span className="min-w-0 flex-1">
      <span className={twMerge('block truncate body-sm', off ? 'text-ink-muted' : 'text-ink')}>{label}</span>
      {sub ? <span className="block text-ink-muted mono-note">{sub}</span> : null}
    </span>
    {zone && !toggle ? <span className="text-cyan signal-sm">In {ZONE_LABEL[zone]}</span> : off ? <span className="text-ink-muted signal-sm">N/A</span> : null}
    <button
      type="button"
      onClick={onAdd}
      disabled={!toggle && (off || !!zone)}
      aria-label={`${toggle && zone ? 'Remove' : 'Add'} ${label}`}
      aria-pressed={toggle ? !!zone : undefined}
      className={twMerge('size-8 shrink-0 border border-line font-mono text-sm font-bold disabled:text-ink-muted', toggle && zone ? 'border-line-strong text-ink' : 'text-cyan')}
    >
      {toggle && zone ? '−' : '+'}
    </button>
  </li>
)

type EditorProps = {
  cat: Catalog
  cfg: ExplorationConfig
  /** A new config, or `null` for a refused drop (clears the flash either way). */
  put: (config: ExplorationConfig | null) => void
  name: string
  onName: (name: string) => void
  /** Seasons the Segments panel offers. */
  options: SegmentOption[]
  segLabel: (id: string) => string
  /** Values a filter on `dim` can take, first one seeds a new filter. */
  choices: (dim: string, cfg: ExplorationConfig) => { v: FilterValue; label: string }[]
  onError: (text: string) => void
}

/** The Variables panel and the zones: drag, drop and "+" over any catalog. */
export const ExplorerEditor = ({ cat, cfg, put, name, onName, options, segLabel, choices: choicesOf, onError }: EditorProps) => {
  const [drag, setDrag] = useState<Payload | null>(null)
  const [over, setOver] = useState<Zone | null>(null)
  const [q, setQ] = useState('')
  const nameField = useLazyText(name, onName)
  const edit = (fn: (t: ExplorationConfig) => void) => {
    const t = structuredClone(cfg)
    fn(t)
    put(t)
  }
  const firstValue = (dim: string, t: ExplorationConfig): FilterValue | undefined => choicesOf(dim, t)[0]?.v

  const startDrag = (e: React.DragEvent, p: Payload) => {
    e.dataTransfer.setData('text/plain', p.id)
    e.dataTransfer.effectAllowed = 'copyMove'
    setDrag(p)
  }
  const endDrag = () => (setDrag(null), setOver(null))
  const canDrop = (z: Zone) => !!drag && (drag.from ? !!drop(cat, cfg, z, drag, firstValue) : accepts(cat, z, drag, cfg))
  const add = (p: Payload) => {
    const t = quickAdd(cat, cfg, p, firstValue)
    if (t) put(t)
    else if (p.kind === 'seg') onError('An exploration compares at least one season or period.')
  }

  const used = inUse(cfg)
  const query = q.trim().toLowerCase()
  const dims = [...cat.dimensions.values()]
  const metrics = [...cat.metrics.values()]

  const chip = (zone: Zone, i: number, p: Payload, label: string, color: string, extra?: React.ReactNode) => (
    <li key={`${zone}-${p.id}`}>
      <div
        draggable
        onDragStart={(e) => startDrag(e, { ...p, from: zone, i })}
        onDragEnd={endDrag}
        className="flex min-h-9 cursor-grab items-center gap-2 border border-line bg-surface-200 pr-1 pl-2.5"
      >
        <span aria-hidden className="size-2 shrink-0" style={{ background: color }} />
        <span className="min-w-0 flex-1 truncate text-ink body-sm">{label}</span>
        {zone === 'segments' && cfg.segments.length === 1 ? null : (
          <button type="button" onClick={() => edit((t) => removeFrom(t, zone, i))} aria-label={`Remove ${label}`} className="size-8 text-ink-muted hover:text-ink">×</button>
        )}
      </div>
      {extra}
    </li>
  )

  const dimLabelOf = (d: string) => cat.dimensions.get(d)?.label ?? d
  const zones: { id: Zone; marker: string; hint: string; chips: React.ReactNode[] }[] = [
    { id: 'segments', marker: 'bg-cyan', hint: 'Drop up to 4 seasons or periods to compare.', chips: cfg.segments.map((s, i) => chip('segments', i, { kind: 'seg', id: s }, segLabel(s), segColor(i))) },
    { id: 'rows', marker: 'bg-cyan', hint: 'Drop a dimension', chips: cfg.rows.map((d, i) => chip('rows', i, { kind: 'dim', id: d }, dimLabelOf(d), 'var(--color-cyan)')) },
    { id: 'columns', marker: 'bg-cyan', hint: 'Drop a dimension to cross-tab', chips: cfg.columns ? [chip('columns', 0, { kind: 'dim', id: cfg.columns }, dimLabelOf(cfg.columns), 'var(--color-cyan)')] : [] },
    { id: 'values', marker: 'bg-cyan', hint: 'Drop a metric', chips: cfg.values.map((m, i) => chip('values', i, { kind: 'metric', id: m }, cat.metrics.get(m)?.label ?? m, 'var(--color-cyan)')) },
    {
      id: 'filters', marker: 'bg-ink-dim', hint: 'Drop a dimension to filter by it',
      chips: cfg.filters.map((f, i) => {
        const choices = choicesOf(f.dimension, cfg)
        return chip('filters', i, { kind: 'dim', id: f.dimension }, dimLabelOf(f.dimension), 'var(--color-ink-dim)', (
          <div className="border border-t-0 border-line bg-surface-200 py-1.5 pr-2 pl-7">
            <label htmlFor={`flt-${i}`} className="block text-ink-muted signal-sm">Equals</label>
            <select
              id={`flt-${i}`}
              value={JSON.stringify(f.value)}
              onChange={(e) => {
                const v = JSON.parse(e.target.value) as FilterValue
                edit((t) => (t.filters[i]!.value = v))
              }}
              className="mt-1 h-8 w-full border border-line bg-space-000 px-2 text-ink body-sm"
            >
              {choices.some((c) => JSON.stringify(c.v) === JSON.stringify(f.value)) ? null : <option value={JSON.stringify(f.value)}>{String(f.value)}</option>}
              {choices.map((c) => <option key={JSON.stringify(c.v)} value={JSON.stringify(c.v)}>{c.label}</option>)}
            </select>
          </div>
        ))
      }),
    },
  ]

  const dimGroups = [...new Set(dims.map((d) => DIM_GROUP[d.id] ?? 'Other'))]
  const matching = (label: string) => !query || label.toLowerCase().includes(query)

  return (
    <>
      <aside aria-label="Variables" className="border-line lg:sticky lg:top-16 lg:max-h-[calc(100dvh-4rem)] lg:overflow-y-auto lg:border-r">
        <div className="sticky top-0 z-2 border-b border-line bg-space-000 px-4.5 pt-4.5 pb-3">
          <p className="text-ink-dim signal">Variables</p>
          <label htmlFor="var-search" className="mt-3 block text-ink-muted signal-sm">Search</label>
          <input id="var-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Card, win rate, turn…" className="mt-1.5 h-10 w-full border border-line bg-surface-200 px-3 text-ink body-sm" />
        </div>
        <Rule tone="text-cyan" meta="Seasons · periods">Segments</Rule>
        <ul>
          {options.map((s) => {
            const at = cfg.segments.indexOf(s.id)
            const p: Payload = { kind: 'seg', id: s.id }
            return (
              <VarRow
                key={s.id}
                label={s.label}
                sub={s.sub}
                title={at >= 0 ? 'In the comparison' : 'Drag into Segments to compare'}
                marker={at >= 0 ? segColor(at) : 'var(--color-surface-400)'}
                off={!s.code}
                zone={at >= 0 ? 'segments' : undefined}
                toggle
                onAdd={() => add(p)}
                onDragStart={(e) => startDrag(e, p)}
                onDragEnd={endDrag}
              />
            )
          })}
        </ul>
        <Rule tone="text-cyan" meta="Split by">Dimensions</Rule>
        {dimGroups.map((g) => {
          const items = dims.filter((d) => (DIM_GROUP[d.id] ?? 'Other') === g && matching(d.label))
          return items.length ? (
            <div key={g}>
              <p className="px-4.5 pt-2.5 pb-1.5 text-ink-muted signal-sm">{g}</p>
              <ul>
                {items.map((d) => {
                  const reason = used[d.id] ? null : dimReason(cat, d.id, cfg)
                  const p: Payload = { kind: 'dim', id: d.id }
                  return (
                    <VarRow key={d.id} label={d.label} title={reason ?? d.description} marker="var(--color-cyan)" off={!!reason} zone={used[d.id]}
                      onAdd={() => add(p)} onDragStart={(e) => startDrag(e, p)} onDragEnd={endDrag} />
                  )
                })}
              </ul>
            </div>
          ) : null
        })}
        <Rule tone="text-cyan" meta="Counted">Metrics</Rule>
        {sourcesOf(cat).map((s) => {
          const items = metrics.filter((m) => m.source === s && matching(m.label))
          return items.length ? (
            <div key={s}>
              <p className="px-4.5 pt-2.5 pb-1.5 text-ink-muted signal-sm">{SOURCE_LABEL[s]}</p>
              <ul>
                {items.map((m) => {
                  const reason = used[m.id] ? null : metricReason(cat, m.id, cfg)
                  const p: Payload = { kind: 'metric', id: m.id }
                  return (
                    <VarRow key={m.id} label={m.label} title={reason ?? (m.description || m.label)} marker="var(--color-cyan)" off={!!reason} zone={used[m.id]}
                      onAdd={() => add(p)} onDragStart={(e) => startDrag(e, p)} onDragEnd={endDrag} />
                  )
                })}
              </ul>
            </div>
          ) : null
        })}
        <p className="px-4.5 pt-4.5 pb-7 text-ink-muted caption">
          Dimmed variables cannot be split that way. The play log only has summons and activations, so nothing here measures LP, damage or attacks.
        </p>
      </aside>

      <section aria-label="Exploration settings" className="bg-surface-100 px-4.5 pt-4.5 pb-7 lg:sticky lg:top-16 lg:max-h-[calc(100dvh-4rem)] lg:overflow-y-auto lg:border-r lg:border-line">
        <p className="text-ink-dim signal">Exploration settings</p>
        <label htmlFor="exp-name" className="mt-4 block text-ink-muted signal-sm">Name</label>
        <input
          id="exp-name"
          type="text"
          maxLength={cat.limits.name}
          {...nameField}
          className="mt-1.5 h-10 w-full border border-line bg-surface-200 px-3 text-ink body-strong"
        />
        <p id="tech-label" className="mt-4.5 text-ink-muted signal-sm">Technique</p>
        <div role="radiogroup" aria-labelledby="tech-label" className="mt-1.5 grid grid-cols-4 gap-px border border-line bg-line">
          {cat.techniques.map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={v === cfg.technique}
              onClick={() => edit((t) => (t.technique = v))}
              className={twMerge('h-10 signal-chip', v === cfg.technique ? 'bg-cyan text-cyan-on' : 'bg-space-000 text-ink-dim hover:bg-surface-300')}
            >
              {TECHNIQUE_LABEL[v] ?? v}
            </button>
          ))}
        </div>

        {zones.map((z) => {
          const ok = canDrop(z.id)
          return (
            <div
              key={z.id}
              onDragOver={(e) => {
                if (!ok) return
                e.preventDefault()
                if (over !== z.id) setOver(z.id)
              }}
              onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && over === z.id && setOver(null)}
              onDrop={(e) => {
                e.preventDefault()
                put(drag ? drop(cat, cfg, z.id, drag, firstValue) : null)
                endDrag()
              }}
              className={twMerge(
                'mt-4 border',
                over === z.id ? 'border-cyan bg-ground-cyan' : ok ? 'border-line-strong bg-space-000' : 'border-line bg-space-000',
                drag && !ok && 'opacity-45',
              )}
            >
              <div className="flex items-center gap-2 border-b border-line px-3 py-2.25">
                <span aria-hidden className={twMerge('size-2', z.marker)} />
                <span className="flex-1 text-ink signal-sm">{ZONE_LABEL[z.id]}</span>
                <span className="text-ink-muted signal-sm">{z.chips.length} / {capOf(cat, z.id)}</span>
              </div>
              <ul className="grid min-h-12 gap-1.5 p-2">
                {z.chips.length ? z.chips : <li className="flex min-h-8.5 items-center justify-center text-center text-ink-muted caption">{z.hint}</li>}
              </ul>
            </div>
          )
        })}
        <p className="mt-4 text-ink-muted caption">Drag a variable into a zone, or press + to drop it where it fits. Drag a chip to move it between zones.</p>
      </section>
    </>
  )
}
