'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'
import { Button, Chip } from '@ui/index'
import { ExplorerEditor } from '@omega/analytics/explorer/builder'
import { GlobalTiles, globalPivot, globalSummary, useGlobalSegments } from '@omega/analytics/explorer/global'
import { ExplorationOutput, SeasonsGate } from '@omega/analytics/explorer/output'
import { configProblem, sourceOf, type Catalog, type ExplorationConfig, type SegmentOption, type Variables } from '@utils/explorer'
import { getGlobalVariables, globalCatalogOf, globalPath, globalValuesOf, type GlobalExploration } from '@utils/global-explorer'
import {
  createPanelExploration, deletePanelExploration, getSettings, listPanelExplorations, listSeasons, updatePanelExploration, updateSettings,
} from '@utils/panel'
import { getPastSeasons } from '@utils/ranked'
import { Empty, errorText, Field, INPUT, Notice, Row, RowButton, Toggle } from './ui'

/* ---------------------------------------------------------------- *
 * Minimum sample (PANEL_API §10)
 * ---------------------------------------------------------------- */

const MIN_KEY = 'analytics.global.minSamples'

const MinSamples = () => {
  const [value, setValue] = useState('')
  const [stored, setStored] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  useEffect(() => {
    const abort = new AbortController()
    getSettings(abort.signal).then(
      (s) => (setStored(s[MIN_KEY]), setValue(String(s[MIN_KEY]))),
      (failure) => !abort.signal.aborted && setError(errorText(failure)),
    )
    return () => abort.abort()
  }, [])

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      const s = await updateSettings({ [MIN_KEY]: Number(value) })
      setStored(s[MIN_KEY])
      setDone(`Cuts under ${s[MIN_KEY]} deck-games are hidden. Pages pick it up within 5 minutes (the season answer's cache).`)
    } catch (failure) {
      setError(errorText(failure))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Row
      index="05"
      title="Global analytics"
      blurb="Explorations over every ranked duel, built here. A draft stays in the panel; a published one is public on /analytics, no link or sign-in needed."
    >
      <form onSubmit={save} className="grid gap-4 border border-line bg-surface-100 px-4 py-4">
        <p className="text-gold signal-lg">Minimum sample</p>
        <p className="text-ink-dim body-sm">
          A row or cell with fewer deck-games than this is hidden (for hand traps, fewer activations). 0 shows everything. It
          keeps a 2–0 archetype from topping a win-rate chart.
        </p>
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field id="min-samples" label="Deck-games" hint={stored === null ? 'Loading…' : `Now ${stored}. 0–1,000,000.`}>
            <input id="min-samples" type="number" min={0} max={1_000_000} required value={value} onChange={(e) => setValue(e.target.value)} className={INPUT} />
          </Field>
          <Button type="submit" size="sm" disabled={busy || stored === null || value === String(stored)}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </div>
        <Notice tone="error">{error}</Notice>
        <Notice tone="ok">{done}</Notice>
      </form>
    </Row>
  )
}

/* ---------------------------------------------------------------- *
 * Explorations (PANEL_API §8.4)
 * ---------------------------------------------------------------- */

/** A stored exploration (`id`), or a new one that lives here until saved. */
type Tab = { key: string; id: string | null; name: string; description: string; published: boolean; config: ExplorationConfig; dirty: boolean }

const tabOf = (e: GlobalExploration): Tab => ({ key: e.id, id: e.id, name: e.name, description: e.description, published: e.published, config: e.config, dirty: false })

/** Each ladder's `current:*` (follows the open season), then every ended season. */
const loadOptions = async (): Promise<SegmentOption[]> => {
  const [open, ...past] = await Promise.all([listSeasons(), ...(['tcg', 'genesys'] as const).map((l) => getPastSeasons(l).catch(() => null))])
  return [
    ...open.map((e) => ({
      id: `current:${e.ladder}`,
      label: `Current ${e.format}`,
      sub: e.season ? `Follows the ladder · now ${e.season.label}` : 'No open season',
      code: e.season?.code ?? null,
    })),
    ...past.flatMap((p) => (p ? p.seasons.map((s) => ({ id: s.code, label: `${p.format} · ${s.label}`, sub: 'Ended', code: s.code })) : [])),
  ]
}

const Explorations = () => {
  const [variables, setVariables] = useState<Variables | null>(null)
  const [options, setOptions] = useState<SegmentOption[]>([])
  const [tabs, setTabs] = useState<Tab[] | null>(null)
  const [active, setActive] = useState<string | undefined>()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getGlobalVariables(), listPanelExplorations(), loadOptions()]).then(
      ([vars, list, opts]) => {
        setVariables(vars)
        setOptions(opts)
        setTabs(list.map(tabOf))
        setActive(list[0]?.id)
      },
      (failure) => setError(errorText(failure)),
    )
  }, [])

  const cat = useMemo(() => (variables ? globalCatalogOf(variables) : null), [variables])

  if (error) return <div className="px-5.5 py-8 lg:px-11"><Notice tone="error">{error}</Notice></div>
  if (!tabs || !cat) return <div className="px-5.5 py-8 lg:px-11"><Empty>Loading the global catalog…</Empty></div>

  const newTab = () => {
    const key = crypto.randomUUID()
    const segment = options.find((o) => o.code)?.id ?? 'current:tcg'
    const config: ExplorationConfig = { v: 1, technique: 'bars', segments: [segment], rows: ['archetype'], columns: null, values: ['metaShare'], filters: [], sort: null, limit: 12, runningTotal: false }
    setTabs([...tabs, { key, id: null, name: `Exploration ${tabs.length + 1}`, description: '', published: false, config, dirty: true }])
    setActive(key)
  }

  /** Swaps with the neighbour, then one `PATCH { position }` per stored tab whose index moved. */
  const move = async (key: string, by: -1 | 1) => {
    const from = tabs.findIndex((t) => t.key === key)
    const to = from + by
    if (from < 0 || to < 0 || to >= tabs.length) return
    const next = [...tabs]
    ;[next[from], next[to]] = [next[to]!, next[from]!]
    setTabs(next)
    try {
      await Promise.all(next.flatMap((t, position) => (t.id && tabs[position]?.key !== t.key ? [updatePanelExploration(t.id, { position })] : [])))
    } catch (failure) {
      setError(errorText(failure))
    }
  }

  const tab = tabs.find((t) => t.key === active) ?? tabs[0]

  return (
    <section aria-label="Global explorations" className="border-b border-line">
      <div className="flex items-stretch overflow-x-auto border-b border-line">
        <div role="tablist" aria-label="Global explorations" className="flex">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={t.key === tab?.key}
              onClick={() => setActive(t.key)}
              className={twMerge('flex min-h-12 shrink-0 items-center gap-2 border-r border-line px-5 signal-tab', t.key === tab?.key ? 'bg-surface-100 text-ink shadow-tab-active' : 'text-ink-muted hover:text-ink')}
            >
              {t.name || 'Untitled'}
              {t.id && t.dirty ? <span title="Unsaved changes" className="size-1.75 bg-gold" /> : null}
              <span className={twMerge('signal-sm', t.published ? 'text-cyan' : 'text-ink-muted')}>{!t.id ? 'New' : t.published ? 'Public' : 'Draft'}</span>
            </button>
          ))}
        </div>
        <button type="button" onClick={newTab} className="shrink-0 border-r border-line px-4.5 text-gold signal-tab hover:bg-surface-300">+ New exploration</button>
        <span className="flex-1" />
        {tab && tabs.length > 1 ? (
          <span className="flex shrink-0 items-center gap-1 px-2">
            <button type="button" onClick={() => move(tab.key, -1)} disabled={tabs.indexOf(tab) <= 0} aria-label={`Move “${tab.name}” earlier`} className="size-9 border border-line text-ink-dim hover:text-ink disabled:opacity-35">←</button>
            <button type="button" onClick={() => move(tab.key, 1)} disabled={tabs.indexOf(tab) >= tabs.length - 1} aria-label={`Move “${tab.name}” later`} className="size-9 border border-line text-ink-dim hover:text-ink disabled:opacity-35">→</button>
          </span>
        ) : null}
        <span className="hidden shrink-0 self-center px-3 text-ink-muted signal-sm sm:block">
          {tabs.length} explorations · {tabs.filter((t) => t.published).length} public · order = public order
        </span>
      </div>

      {tab ? (
        <Workspace
          key={tab.key}
          cat={cat}
          tab={tab}
          options={options}
          onChange={(t) => setTabs(tabs.map((x) => (x.key === t.key ? t : x)))}
          onRemove={() => {
            const rest = tabs.filter((t) => t.key !== tab.key)
            setTabs(rest)
            setActive(rest[0]?.key)
          }}
        />
      ) : (
        <div className="px-5.5 py-8 lg:px-11">
          <Empty>No global exploration yet. Start one with “+ New exploration”: it stays a draft until you publish it.</Empty>
        </div>
      )}
    </section>
  )
}

type WorkspaceProps = { cat: Catalog; tab: Tab; options: SegmentOption[]; onChange: (t: Tab) => void; onRemove: () => void }

const Workspace = ({ cat, tab, options, onChange, onRemove }: WorkspaceProps) => {
  const [flash, setFlash] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const cfg = tab.config
  const codeOf = (id: string) => options.find((o) => o.id === id)?.code ?? (id.startsWith('current:') ? null : id)
  const { segments, names, pending, failure } = useGlobalSegments(cfg.segments, codeOf)
  const segLabel = (id: string) => options.find((o) => o.id === id)?.label ?? id

  const set = (patch: Partial<Tab>) => {
    onChange({ ...tab, ...patch, dirty: true })
    setFlash(null)
  }
  const put = (config: ExplorationConfig | null) => (config ? set({ config }) : setFlash(null))
  const edit = (fn: (t: ExplorationConfig) => void) => {
    const t = structuredClone(cfg)
    fn(t)
    put(t)
  }

  const problem = configProblem(cfg)
  const save = async () => {
    setBusy(true)
    try {
      const body = { name: tab.name.trim(), description: tab.description.trim(), published: tab.published, config: cfg }
      const stored = tab.id ? await updatePanelExploration(tab.id, body) : await createPanelExploration(body)
      onChange({ ...tabOf(stored), key: tab.key })
      setFlash({ tone: 'ok', text: stored.published ? `Saved and public at ${globalPath(stored.id)}.` : 'Saved as a draft. Only the panel sees it.' })
    } catch (failure) {
      setFlash({ tone: 'error', text: errorText(failure) })
    } finally {
      setBusy(false)
    }
  }
  const remove = async () => {
    if (!window.confirm(`Delete “${tab.name}”?${tab.published ? ' It leaves the public page too.' : ''}`)) return
    setBusy(true)
    try {
      if (tab.id) await deletePanelExploration(tab.id)
      onRemove()
    } catch (failure) {
      setFlash({ tone: 'error', text: errorText(failure) })
      setBusy(false)
    }
  }

  const lead = segments[0]
  const canSave = tab.dirty && !problem && !!tab.name.trim() && !busy

  return (
    <>
      <div className="px-5.5 lg:px-11">{lead ? <GlobalTiles seg={lead} names={names} /> : null}</div>
      <div className="mt-5 grid border-t border-line lg:grid-cols-[272px_300px_minmax(0,1fr)]">
        <ExplorerEditor
          cat={cat}
          cfg={cfg}
          put={put}
          name={tab.name}
          onName={(name) => set({ name })}
          options={options}
          segLabel={segLabel}
          choices={(dim, t) => globalValuesOf(segments, dim, sourceOf(cat, t), names)}
          onError={(text) => setFlash({ tone: 'error', text })}
        />

        <section aria-label="Output" className="min-w-0 px-5.5 pt-5 pb-10 lg:px-7.5">
          <div className="flex flex-wrap items-start gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-ink display-4">{tab.name || 'Untitled'}</h2>
                {!tab.id ? <Chip>not saved</Chip> : tab.dirty ? <Chip tone="gold">unsaved changes</Chip> : tab.published ? <Chip tone="cyan">public</Chip> : <Chip>draft</Chip>}
              </div>
              <p className="mt-2 text-ink-muted mono-note">{globalSummary(cat, cfg, segments, names) || cfg.segments.map(segLabel).join(' vs ')}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              {!problem && cfg.technique !== 'line' ? (
                <label className="flex items-center gap-2 text-ink-muted signal-sm">
                  Rows
                  <select value={cfg.limit} onChange={(e) => edit((t) => (t.limit = Number(e.target.value)))} className="h-9 border border-line bg-surface-200 px-2 text-ink mono-data">
                    {[...new Set([10, 12, 25, 50, cat.limits.rowLimit, cfg.limit])].sort((a, b) => a - b).map((n) => (
                      <option key={n} value={n}>{n === cat.limits.rowLimit ? `All (${n})` : n}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              {cfg.technique === 'line' ? (
                <label className="flex h-9 cursor-pointer items-center gap-2 border border-line px-3 text-ink-dim signal-sm">
                  <input type="checkbox" checked={cfg.runningTotal} onChange={() => edit((t) => (t.runningTotal = !t.runningTotal))} className="size-4 accent-gold" />
                  Running total
                </label>
              ) : null}
              {tab.id && tab.published && !tab.dirty ? (
                <Link href={globalPath(tab.id)} className="flex min-h-11 items-center border border-line-strong px-4 text-ink signal-chip hover:bg-ink hover:text-ink-on">Open public page</Link>
              ) : null}
              <RowButton tone="danger" onClick={remove} disabled={busy} className="min-h-11 px-4">Delete</RowButton>
              <Button size="sm" onClick={save} disabled={!canSave} title={problem?.title}>
                {busy ? 'Saving…' : tab.id ? 'Save changes' : 'Save'}
              </Button>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-end">
            <Field id={`desc-${tab.key}`} label="Description" hint="Shown above the chart on the public page. Up to 2000 characters.">
              <textarea id={`desc-${tab.key}`} rows={2} maxLength={2000} value={tab.description} onChange={(e) => set({ description: e.target.value })} className={INPUT} />
            </Field>
            <Toggle label={tab.published ? 'Published' : 'Draft'} checked={tab.published} onChange={(published) => set({ published })} />
          </div>

          {flash ? (
            <div className="mt-3.5">
              <Notice tone={flash.tone}>{flash.text}</Notice>
            </div>
          ) : null}

          {failure || !segments.length ? (
            <SeasonsGate pending={pending} failure={failure} empty="None of these seasons has server-wide data yet. Run the analytics sweep in Ranked ops." />
          ) : (
            <ExplorationOutput cat={cat} cfg={cfg} {...globalPivot(cat, segments, names, cfg)} onEdit={edit} />
          )}
        </section>
      </div>
    </>
  )
}

export const GlobalAnalyticsPanel = () => (
  <>
    <MinSamples />
    <Explorations />
  </>
)
