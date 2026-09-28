'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'
import { useLazyText } from '@hooks/index'
import { EmptyBox } from '@omega/profile/empty-box'
import { StatTiles } from '@omega/analytics/primitives'
import { createExploration, deleteExploration, sharePath, updateExploration, writeError, type ExplorationList } from '@utils/explorations'
import {
  COLUMN_LIMIT, COLUMN_SORTS, THRESHOLD_OPS, accepts, capOf, catalogOf, configProblem, dimReason, drop, inUse, kpis, metricReason, quickAdd, removeFrom, seasonState, segColor, sourceOf, sourcesOf, summary, valuesOf,
  type Catalog, type ColumnSort, type Exploration, type ExplorationConfig, type FilterValue, type Payload, type SegmentOption, type Source, type Technique, type Variables,
  type Threshold, type ThresholdOp, type Visibility, type Zone,
} from '@utils/explorer'
import { ExplorationOutput, MatchDrawer, SeasonsGate, duelistPivot, segLabelOf, useSegments, useSharedSegments } from './output'

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

/** A tab: a stored exploration (`id`), or a new one that only lives in this browser until saved. */
type Tab = { key: string; id: string | null; name: string; visibility: Visibility; shareToken: string | null; config: ExplorationConfig; dirty: boolean }

const tabOf = (e: Exploration): Tab => ({ key: e.id, id: e.id, name: e.name, visibility: e.visibility, shareToken: e.shareToken, config: e.config, dirty: false })

export const VISIBILITY: Record<Visibility, { label: string; hint: string; tone: string }> = {
  private: { label: 'Private', hint: 'Only you', tone: 'border-ink-muted text-ink-muted' },
  link: { label: 'Link only', hint: 'Anyone with the link', tone: 'border-cyan text-cyan' },
  public: { label: 'Public', hint: 'On your profile and the public feed', tone: 'border-cyan text-cyan' },
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

type BuilderProps = {
  playerId: string
  name: string
  list: ExplorationList
  variables: Variables
  /** Seasons the Segments panel offers: the ladders' current seasons first. */
  options: SegmentOption[]
  /** What a new exploration compares. */
  defaultSegment: string
}

export const ExplorationBuilder = ({ playerId, name, list, variables, options, defaultSegment }: BuilderProps) => {
  const cat = useMemo(() => catalogOf(variables), [variables])
  const owner = list.editable
  const [tabs, setTabs] = useState<Tab[]>(() => list.explorations.map(tabOf))
  const [active, setActive] = useState(list.explorations[0]?.id)
  const tab = tabs.find((t) => t.key === active) ?? tabs[0]

  const newTab = () => {
    const key = crypto.randomUUID()
    const config: ExplorationConfig = { v: 1, technique: 'table', segments: [defaultSegment], rows: [], columns: null, values: [], filters: [], sort: null, limit: 12, runningTotal: false }
    setTabs((all) => [...all, { key, id: null, name: `Exploration ${all.length + 1}`, visibility: 'private', shareToken: null, config, dirty: true }])
    setActive(key)
  }

  /**
   * Swaps the tab with its neighbour, then one `PATCH { position }` per stored tab whose index moved.
   * ponytail: a failed PATCH leaves the local order ahead of the server's; the next load shows the stored one.
   */
  const move = async (key: string, by: -1 | 1) => {
    const from = tabs.findIndex((t) => t.key === key)
    const to = from + by
    if (from < 0 || to < 0 || to >= tabs.length) return
    const next = [...tabs]
    ;[next[from], next[to]] = [next[to]!, next[from]!]
    setTabs(next)
    await Promise.all(
      next.flatMap((t, position) => (t.id && tabs[position]?.key !== t.key ? [updateExploration(t.id, { position })] : [])),
    )
  }

  if (!tab) {
    return owner ? (
      <EmptyBox title="No explorations yet" className="mt-6">
        Build a pivot over your ranked games and save it to this page.
        <button type="button" onClick={newTab} className="mx-auto mt-4 flex min-h-11 items-center border border-cyan px-4 text-cyan signal-chip">+ New exploration</button>
      </EmptyBox>
    ) : (
      <EmptyBox title="Nothing shared yet" className="mt-6">{name} hasn&apos;t made an exploration public yet.</EmptyBox>
    )
  }

  return (
    <Workspace
      cat={cat}
      playerId={playerId}
      owner={owner}
      limit={list.limit}
      tabs={tabs}
      tab={tab}
      options={options}
      onSelect={setActive}
      onNew={newTab}
      onMove={move}
      onChange={(t) => setTabs((all) => all.map((x) => (x.key === t.key ? t : x)))}
      onRemove={(key) => {
        const rest = tabs.filter((t) => t.key !== key)
        setTabs(rest)
        setActive(rest[0]?.key)
      }}
    />
  )
}

type WorkspaceProps = {
  cat: Catalog
  playerId: string
  owner: boolean
  limit: number
  tabs: Tab[]
  tab: Tab
  options: SegmentOption[]
  onSelect: (key: string) => void
  onNew: () => void
  onMove: (key: string, by: -1 | 1) => Promise<void>
  onChange: (t: Tab) => void
  onRemove: (key: string) => void
}

/** Stays mounted across tabs, so the season responses already fetched are reused. */
const Workspace = ({ cat, playerId, owner, limit, tabs, tab, options, onSelect, onNew, onMove, onChange, onRemove }: WorkspaceProps) => {
  const [match, setMatch] = useState<string | null>(null)
  const [flash, setFlash] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  /** Below lg the editor panels fold away over the output. */
  const [editing, setEditing] = useState(false)

  const cfg = tab.config
  // The owner cuts live from §3 while editing; everyone else reads the tab's shared response,
  // which also works when the profile is private.
  const live = useSegments(playerId, options, owner ? cfg.segments : [])
  const shared = useSharedSegments(owner ? null : tab.shareToken, cfg.segments)
  const { segments, names, pending, failure } = owner ? live : shared
  const segLabel = (id: string) => options.find((o) => o.id === id)?.label ?? segLabelOf(segments)(id)
  // The cut runs over whole seasons: keep it off the keystroke path of the name.
  const pivot = useMemo(() => duelistPivot(cat, segments, names, cfg), [cat, segments, names, cfg])

  const put = (config: ExplorationConfig | null) => {
    if (config) onChange({ ...tab, config, dirty: true })
    setFlash(null)
  }
  const edit = (fn: (t: ExplorationConfig) => void) => {
    const t = structuredClone(cfg)
    fn(t)
    put(t)
  }

  const problem = configProblem(cfg)
  const save = async () => {
    setBusy(true)
    try {
      const stored = tab.id
        ? await updateExploration(tab.id, { name: tab.name.trim(), config: cfg })
        : await createExploration({ name: tab.name.trim(), visibility: tab.visibility, config: cfg, ownerId: playerId })
      onChange({ ...tabOf(stored), key: tab.key })
      setFlash({ tone: 'ok', text: `Saved. ${VISIBILITY[stored.visibility].hint} can see “${stored.name}”.` })
    } catch (error) {
      setFlash({ tone: 'error', text: writeError(error) })
    } finally {
      setBusy(false)
    }
  }
  /** The share menu: stored tabs PATCH right away, a new tab keeps it for its first save. */
  const share = async (visibility: Visibility) => {
    if (!tab.id) return onChange({ ...tab, visibility })
    setBusy(true)
    try {
      const stored = await updateExploration(tab.id, { visibility })
      onChange({ ...tab, visibility: stored.visibility, shareToken: stored.shareToken })
      setFlash({ tone: 'ok', text: `${VISIBILITY[stored.visibility].hint} can now open “${tab.name}”.` })
    } catch (error) {
      setFlash({ tone: 'error', text: writeError(error) })
    } finally {
      setBusy(false)
    }
  }
  const copyLink = async () => {
    if (!tab.shareToken) return
    try {
      await navigator.clipboard.writeText(new URL(sharePath(tab.shareToken), window.location.origin).href)
      setFlash({ tone: 'ok', text: 'Link copied.' })
    } catch {
      setFlash({ tone: 'error', text: 'Couldn’t copy. Open the link and copy it from the address bar.' })
    }
  }
  const remove = async () => {
    if (!window.confirm(`Delete “${tab.name}”? Visitors stop seeing it.`)) return
    setBusy(true)
    try {
      if (tab.id) await deleteExploration(tab.id)
      onRemove(tab.key)
    } catch (error) {
      setFlash({ tone: 'error', text: writeError(error) })
      setBusy(false)
    }
  }

  const lead = segments[0]
  const editor = (
    <ExplorerEditor
      cat={cat}
      cfg={cfg}
      put={put}
      name={tab.name}
      onName={(name) => {
        onChange({ ...tab, name, dirty: true })
        setFlash(null)
      }}
      options={options}
      segLabel={segLabel}
      choices={(dim, t) => valuesOf(cat, segments, dim, sourceOf(cat, t), names)}
      onError={(text) => setFlash({ tone: 'error', text })}
    />
  )

  const status =!tab.id ? { label: 'Not saved yet', tone: 'border-ink-muted text-ink-muted' }
    : tab.dirty ? { label: 'Unsaved changes', tone: 'border-cyan text-cyan' }
    : { label: `Saved · ${VISIBILITY[tab.visibility].label}`, tone: VISIBILITY[tab.visibility].tone }
  const canSave = owner && tab.dirty && !problem && !!tab.name.trim() && !busy
  const at = tabs.findIndex((t) => t.key === tab.key)
  const standing = lead?.season.standing

  return (
    <>
      {lead ? (
        <StatTiles
          className="mt-5"
          items={[
            { label: 'Primary segment', value: <span className="body-strong normal-case">{lead.label}</span>, note: [standing ? `${standing.elo} Elo · #${standing.rank}` : null, seasonState(lead.season.season)].filter(Boolean).join(' · ') },
            ...kpis(lead).map((k) => ({ label: k.label, value: <span className="block truncate">{k.value}</span>, tone: k.tone, note: k.sub })),
          ]}
        />
      ) : null}

      <div className="mt-6 flex items-stretch overflow-x-auto border-y border-line">
        <div role="tablist" aria-label="Explorations" className="flex">
          {tabs.map((t) => {
            const on = t.key === tab.key
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => (onSelect(t.key), setFlash(null))}
                className={twMerge('flex min-h-12 shrink-0 items-center gap-2 border-r border-line px-5 signal-tab', on ? 'bg-surface-100 text-ink shadow-tab-active' : 'text-ink-muted hover:text-ink')}
              >
                {t.name || 'Untitled'}
                {owner && t.id && t.dirty ? <span title="Unsaved changes" className="size-1.75 bg-cyan" /> : null}
                {owner && t.visibility !== 'public' ? <span className="text-ink-muted signal-sm">{t.id ? VISIBILITY[t.visibility].label : 'New'}</span> : null}
              </button>
            )
          })}
        </div>
        {owner && tabs.length < limit ? (
          <button type="button" onClick={onNew} className="shrink-0 border-r border-line px-4.5 text-cyan signal-tab hover:bg-surface-300">+ New exploration</button>
        ) : null}
        <span className="flex-1" />
        {owner && tabs.length > 1 ? (
          <span className="flex shrink-0 items-center gap-1 px-2">
            <button type="button" onClick={() => onMove(tab.key, -1)} disabled={at <= 0} aria-label={`Move “${tab.name}” left`} className="size-9 border border-line text-ink-dim hover:text-ink disabled:opacity-35">←</button>
            <button type="button" onClick={() => onMove(tab.key, 1)} disabled={at >= tabs.length - 1} aria-label={`Move “${tab.name}” right`} className="size-9 border border-line text-ink-dim hover:text-ink disabled:opacity-35">→</button>
          </span>
        ) : null}
        <span className="hidden shrink-0 self-center px-2 text-ink-muted signal-sm sm:block">
          {owner ? `${tabs.length} / ${limit} explorations · ${tabs.filter((t) => t.visibility === 'public').length} public` : `${tabs.length} public explorations`}
        </span>
      </div>

      <div className={twMerge('grid', owner && 'lg:grid-cols-[272px_300px_minmax(0,1fr)]')}>
        {owner ? (
          <>
            <button
              type="button"
              aria-expanded={editing}
              onClick={() => setEditing(!editing)}
              className="flex min-h-12 items-center justify-between border-b border-line px-4.5 text-cyan signal-tab lg:hidden"
            >
              {editing ? 'Close editor' : 'Edit exploration'} <span aria-hidden>{editing ? '▴' : '▾'}</span>
            </button>
            <div className={twMerge('contents', !editing && 'max-lg:hidden')}>{editor}</div>
          </>
        ) : null}

        <section aria-label="Output" className={twMerge('min-w-0 pt-5 pb-10', owner && 'lg:pl-7.5')}>
          <div className="flex flex-wrap items-start gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-ink display-4">{tab.name || 'Untitled'}</h2>
                {owner ? <span className={twMerge('border px-2 py-1 signal-chip', status.tone)}>{status.label}</span> : null}
              </div>
              <p className="mt-2 text-ink-muted mono-note">{summary(cat, cfg, segLabel, names)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              {owner && !problem && cfg.technique !== 'line' ? (
                <label className="flex items-center gap-2 text-ink-muted signal-sm">
                  Rows
                  <select
                    value={cfg.limit}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      edit((t) => (t.limit = v))
                    }}
                    className="h-9 border border-line bg-surface-200 px-2 text-ink mono-data"
                  >
                    {[...new Set([10, 12, 25, 50, cat.limits.rowLimit, cfg.limit])].sort((a, b) => a - b).map((n) => (
                      <option key={n} value={n}>{n === cat.limits.rowLimit ? `All (${n})` : n}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              {owner && !problem && cfg.technique !== 'line' ? <ColumnControls cat={cat} cfg={cfg} edit={edit} /> : null}
              {owner && !problem && cfg.technique !== 'line' ? <ThresholdControls cat={cat} cfg={cfg} edit={edit} /> : null}
              {owner && cfg.technique === 'line' ? (
                <label className="flex h-9 cursor-pointer items-center gap-2 border border-line px-3 text-ink-dim signal-sm">
                  <input type="checkbox" checked={cfg.runningTotal} onChange={() => edit((t) => (t.runningTotal = !t.runningTotal))} className="size-4 accent-cyan" />
                  Running total
                </label>
              ) : null}
              {owner ? (
                <label className="flex items-center gap-2 text-ink-muted signal-sm">
                  Who sees it
                  <select
                    value={tab.visibility}
                    disabled={busy}
                    onChange={(e) => share(e.target.value as Visibility)}
                    className="h-9 border border-line bg-surface-200 px-2 text-ink mono-data"
                  >
                    {(Object.keys(VISIBILITY) as Visibility[]).map((v) => (
                      <option key={v} value={v}>{VISIBILITY[v].label} · {VISIBILITY[v].hint}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              {tab.shareToken && tab.visibility !== 'private' ? (
                <>
                  <Link href={sharePath(tab.shareToken)} className="flex min-h-11 items-center border border-line-strong px-4 text-ink signal-chip hover:bg-ink hover:text-space-000">
                    Open link
                  </Link>
                  <button type="button" onClick={copyLink} className="min-h-11 border border-line px-4 text-ink-dim signal-chip hover:border-ink hover:text-ink">
                    Copy link
                  </button>
                </>
              ) : null}
              {owner ? (
                <button type="button" onClick={remove} disabled={busy} className="min-h-11 border border-line px-4 text-ink-muted signal-chip hover:border-loss hover:text-loss disabled:opacity-60">
                  Delete
                </button>
              ) : null}
              {owner && tab.dirty ? (
                <button
                  type="button"
                  onClick={save}
                  disabled={!canSave}
                  title={problem?.title}
                  className="min-h-11 bg-cyan px-5 text-cyan-on uppercase shadow-offset-azure signal-chip transition-transform enabled:hover:translate-1 enabled:hover:bg-cyan enabled:hover:shadow-offset-azure-press disabled:opacity-50"
                >
                  {busy ? 'Saving…' : tab.id ? 'Save changes' : 'Save'}
                </button>
              ) : null}
            </div>
          </div>

          {flash ? (
            <p role="status" className={twMerge('mt-3.5 flex items-center gap-2.5 border px-3.5 py-2.5 text-ink body-sm', flash.tone === 'ok' ? 'border-cyan bg-ground-cyan' : 'border-loss bg-ground-loss')}>
              <span aria-hidden className={twMerge('size-2', flash.tone === 'ok' ? 'bg-cyan' : 'bg-loss')} />
              {flash.text}
            </p>
          ) : null}

          {failure || !segments.length ? (
            <SeasonsGate pending={pending} failure={failure} />
          ) : (
            <ExplorationOutput cat={cat} cfg={cfg} {...pivot} onEdit={owner ? edit : undefined} onOpenMatch={setMatch} />
          )}
        </section>
      </div>

      <MatchDrawer matchId={match} onClose={() => setMatch(null)} />
    </>
  )
}

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

/** The Variables panel and the zones: drag, drop and "+" over any catalog. Shared by the duelist page and the admin panel. */
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
