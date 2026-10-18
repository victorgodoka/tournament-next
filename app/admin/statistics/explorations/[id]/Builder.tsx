'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, Button, Chip, Field, PageHeader, Select, Switch, TextArea } from '@ui/index'
import { ColumnControls, ExplorerEditor, ThresholdControls } from '@omega/analytics/explorer/builder'
import { GlobalTiles, globalPivot, globalSummary, useGlobalSegments } from '@omega/analytics/explorer/global'
import { ExplorationOutput, SeasonsGate } from '@omega/analytics/explorer/output'
import { useLazyText, useResource } from '@hooks/index'
import { configProblem, sourceOf, type ExplorationConfig, type SegmentOption } from '@utils/explorer'
import { getGlobalVariables, globalCatalogOf, globalPath, globalValuesOf } from '@utils/global-explorer'
import { createPanelExploration, listPanelExplorations, listSeasons, panelErrorText, updatePanelExploration } from '@utils/panel'
import { getPastSeasons } from '@utils/ranked'

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

const load = (id: string | null) => () =>
  Promise.all([getGlobalVariables(), loadOptions(), id ? listPanelExplorations() : null]).then(([variables, options, list]) => ({
    variables,
    options,
    stored: list?.find((e) => e.id === id) ?? null,
  }))

type Draft = { name: string; description: string; published: boolean; config: ExplorationConfig }

export const Builder = ({ id }: { id: string | null }) => {
  const router = useRouter()
  const { data, error: loadError } = useResource(`builder:${id}`, load(id))
  const [draft, setDraft] = useState<Draft | null>(null)
  const [dirty, setDirty] = useState(false)
  const [flash, setFlash] = useState<{ tone: 'positive' | 'negative'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const cat = useMemo(() => (data ? globalCatalogOf(data.variables) : null), [data])
  const options = data?.options ?? []
  const firstSegment = options.find((o) => o.code)?.id ?? 'current:tcg'
  const d: Draft =
    draft ??
    (data?.stored
      ? { name: data.stored.name, description: data.stored.description, published: data.stored.published, config: data.stored.config }
      : {
          name: 'New exploration',
          description: '',
          published: false,
          config: { v: 1, technique: 'bars', segments: [firstSegment], rows: ['archetype'], columns: null, values: ['metaShare'], filters: [], sort: null, limit: 12, runningTotal: false },
        })
  const cfg = d.config
  const codeOf = (seg: string) => options.find((o) => o.id === seg)?.code ?? (seg.startsWith('current:') ? null : seg)
  const { segments, names, pending, failure } = useGlobalSegments(cfg.segments, codeOf)
  const segLabel = (seg: string) => options.find((o) => o.id === seg)?.label ?? seg
  // The cut runs over whole seasons: keep it off the keystroke path of the name and description.
  const pivot = useMemo(() => (cat ? globalPivot(cat, segments, names, cfg) : null), [cat, segments, names, cfg])

  const set = (patch: Partial<Draft>) => {
    setDraft({ ...d, ...patch })
    setDirty(true)
    setFlash(null)
  }
  const description = useLazyText(d.description, (text) => set({ description: text }))
  const put = (config: ExplorationConfig | null) => (config ? set({ config }) : setFlash(null))
  const edit = (fn: (t: ExplorationConfig) => void) => {
    const t = structuredClone(cfg)
    fn(t)
    put(t)
  }

  const problem = configProblem(cfg)
  const save = () => {
    setBusy(true)
    const body = { name: d.name.trim(), description: d.description.trim(), published: d.published, config: cfg }
    ;(id ? updatePanelExploration(id, body) : createPanelExploration(body))
      .then((stored) => {
        setDirty(false)
        if (!id) router.replace(`/admin/statistics/explorations/${stored.id}`)
        setFlash({ tone: 'positive', text: stored.published ? `Saved and public at ${globalPath(stored.id)}.` : 'Saved as a draft. Only the panel sees it.' })
      })
      .catch((e) => setFlash({ tone: 'negative', text: panelErrorText(e) }))
      .finally(() => setBusy(false))
  }

  if (loadError) return <Alert tone="negative" title="Couldn't open the builder">{panelErrorText(loadError)}</Alert>
  if (!cat || !data) return <p className="text-ink-muted body-sm">Loading the global catalog…</p>
  if (id && !data.stored) return <Alert tone="negative" title={`No exploration ${id}`}>It may have been deleted.</Alert>

  const lead = segments[0]

  return (
    <>
      <PageHeader
        flush
        eyebrow={id ? `Analytics · Exploration ${id}` : 'Analytics · New exploration'}
        title={d.name || 'Untitled'}
        lead={globalSummary(cat, cfg, segments, names) || cfg.segments.map(segLabel).join(' vs ')}
        end={
          <>
            {!id ? <Chip>Not saved</Chip> : dirty ? <Chip tone="gold">Unsaved changes</Chip> : d.published ? <Chip tone="positive">Published</Chip> : <Chip>Draft</Chip>}
            <Button href="/admin/statistics/explorations" variant="secondary" size="mono-md">Back to the list</Button>
            <Button size="mono-md" onClick={save} disabled={busy || !!problem || !d.name.trim() || (!!id && !dirty)} title={problem?.title}>
              {id ? 'Save changes' : 'Save'}
            </Button>
          </>
        }
      />
      {flash ? <Alert tone={flash.tone} title={flash.text} /> : null}
      {lead ? <GlobalTiles seg={lead} names={names} /> : null}

      <div className="grid border border-line lg:grid-cols-[272px_300px_minmax(0,1fr)]">
        <ExplorerEditor
          cat={cat}
          cfg={cfg}
          put={put}
          name={d.name}
          onName={(name) => set({ name })}
          options={options}
          segLabel={segLabel}
          choices={(dim, t) => globalValuesOf(segments, dim, sourceOf(cat, t), names)}
          onError={(text) => setFlash({ tone: 'negative', text })}
        />
        <section aria-label="Output" className="flex min-w-0 flex-col gap-4 px-5 pt-5 pb-10 lg:px-7.5">
          <div className="grid gap-4 min-[720px]:grid-cols-[minmax(0,1fr)_220px] min-[720px]:items-end">
            <Field label="Description" htmlFor="ex-desc" hint="Shown above the chart on the public page. Up to 2000 characters.">
              <TextArea id="ex-desc" rows={2} maxLength={2000} {...description} />
            </Field>
            <Switch checked={d.published} onChange={(published) => set({ published })} label="Published" />
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {!problem && cfg.technique !== 'line' ? (
              <Select
                prefix="Rows"
                value={String(cfg.limit)}
                onChange={(e) => edit((t) => (t.limit = Number(e.target.value)))}
                options={[...new Set([10, 12, 25, 50, cat.limits.rowLimit, cfg.limit])]
                  .sort((a, b) => a - b)
                  .map((n) => ({ value: String(n), label: n === cat.limits.rowLimit ? `All (${n})` : String(n) }))}
                className="h-9 w-36 min-w-0"
              />
            ) : null}
            {!problem && cfg.technique !== 'line' ? <ColumnControls cat={cat} cfg={cfg} edit={edit} /> : null}
            {!problem && cfg.technique !== 'line' ? <ThresholdControls cat={cat} cfg={cfg} edit={edit} /> : null}
            {cfg.technique === 'line' ? (
              <Switch quiet checked={cfg.runningTotal} onChange={() => edit((t) => (t.runningTotal = !t.runningTotal))} label="Running total" />
            ) : null}
          </div>
          {failure || !segments.length || !pivot ? (
            <SeasonsGate pending={pending} failure={failure} empty="None of these seasons has server-wide data yet. Run the season sweep." />
          ) : (
            <ExplorationOutput cat={cat} cfg={cfg} {...pivot} onEdit={edit} />
          )}
        </section>
      </div>
    </>
  )
}
