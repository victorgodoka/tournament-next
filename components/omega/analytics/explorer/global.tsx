'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { StatTiles } from '@omega/analytics/primitives'
import type { Catalog, ExplorationConfig, Variables } from '@utils/explorer'
import {
  buildGlobalSegment, getGlobalSeason, globalCatalogOf, globalDimLabel, globalKpis, globalLineSeries, globalNamesOf, runGlobal,
  type GlobalExploration, type GlobalNames, type GlobalSeason, type GlobalSegment,
} from '@utils/global-explorer'
import { ExplorationOutput, SeasonsGate } from './output'

type Load = GlobalSeason | 'missing' | 'error'

/**
 * One `GET /analytics/global/seasons/:code` per compared season, once each. `codeOf` resolves a
 * segment id (`current:tcg` or a code) to a season code, `null` when it has none.
 */
export const useGlobalSegments = (ids: string[], codeOf: (id: string) => string | null) => {
  const [loaded, setLoaded] = useState<Record<string, Load>>({})
  const asked = useRef(new Set<string>())
  const codes = ids.map(codeOf)
  const key = [...new Set(codes.filter((c): c is string => !!c))].join(',')

  useEffect(() => {
    for (const code of key.split(',').filter(Boolean)) {
      if (asked.current.has(code)) continue
      asked.current.add(code)
      getGlobalSeason(code).then(
        (data) => setLoaded((all) => ({ ...all, [code]: data ?? 'missing' })),
        () => {
          asked.current.delete(code)
          setLoaded((all) => ({ ...all, [code]: 'error' }))
        },
      )
    }
  }, [key])

  const pairs = ids.map((id, i) => [id, codes[i]] as const)
  const pairsKey = JSON.stringify(pairs)
  const segments = useMemo(
    () =>
      (JSON.parse(pairsKey) as [string, string | null][]).flatMap(([id, code]) => {
        const data = code ? loaded[code] : undefined
        return typeof data === 'object' ? [buildGlobalSegment(id, data)] : []
      }),
    [pairsKey, loaded],
  )
  const names = useMemo(() => globalNamesOf(segments), [segments])
  const states = key.split(',').filter(Boolean).map((c) => loaded[c])
  return {
    segments,
    names,
    pending: states.some((s) => s === undefined),
    failure: states.includes('error') ? ('error' as const) : undefined,
  }
}

/** The global cut of these seasons, ready for `ExplorationOutput`. */
export const globalPivot = (cat: Catalog, segs: GlobalSegment[], names: GlobalNames, cfg: ExplorationConfig) => ({
  res: runGlobal(cat, segs, cfg, names),
  line: (res: ReturnType<typeof runGlobal>) => globalLineSeries(segs, res, cfg),
})

/** One line saying what an exploration compares and cuts. */
export const globalSummary = (cat: Catalog, cfg: ExplorationConfig, segs: GlobalSegment[], names: GlobalNames) =>
  [
    cfg.segments.map((id) => segs.find((s) => s.id === id)?.label ?? id).join(' vs '),
    cfg.rows.length ? `rows: ${cfg.rows.map((d) => cat.dimensions.get(d)?.label ?? d).join(', ')}` : '',
    cfg.columns ? `columns: ${cat.dimensions.get(cfg.columns)?.label ?? cfg.columns}` : '',
    cfg.values.map((m) => cat.metrics.get(m)?.label ?? m).join(', '),
    ...cfg.filters.map((f) => `${cat.dimensions.get(f.dimension)?.label ?? f.dimension} = ${globalDimLabel(f.dimension, f.value, names)}`),
  ]
    .filter(Boolean)
    .join(' · ')

/** Header numbers of the first compared season. */
export const GlobalTiles = ({ seg, names }: { seg: GlobalSegment; names: GlobalNames }) => (
  <StatTiles
    className="mt-5"
    items={[
      { label: 'Primary segment', value: <span className="body-strong normal-case">{seg.label}</span>, note: seg.season.season.endsAt ? 'Ended' : 'Open' },
      ...globalKpis(seg, names).map((k) => ({ label: k.label, value: <span className="block truncate">{k.value}</span>, tone: k.tone, note: k.note })),
    ]}
  />
)

type ViewProps = {
  exploration: GlobalExploration
  /** Season code per segment, `null` = the season was deleted. */
  seasons: Record<string, string | null>
  variables: Variables
}

/** A published global exploration, read-only. The seasons load in the browser: they're large and cached by the API. */
export const GlobalExplorationView = ({ exploration, seasons, variables }: ViewProps) => {
  const cat = useMemo(() => globalCatalogOf(variables), [variables])
  const { config } = exploration
  const { segments, names, pending, failure } = useGlobalSegments(config.segments, (id) => seasons[id] ?? null)
  const gone = config.segments.filter((id) => !seasons[id])
  const lead = segments[0]

  return (
    <section aria-label={exploration.name} className="mt-6">
      {exploration.description ? <p className="max-w-[72ch] text-ink-dim body">{exploration.description}</p> : null}
      {lead ? <GlobalTiles seg={lead} names={names} /> : null}
      {gone.length ? <p className="mt-3 text-amber mono-note">Unavailable: {gone.join(', ')} (the season was deleted).</p> : null}
      {failure || !segments.length ? (
        <SeasonsGate pending={pending} failure={failure} empty="None of these seasons has server-wide data yet." />
      ) : (
        <>
          <p className="mt-5 text-ink-muted mono-note">{globalSummary(cat, config, segments, names)}</p>
          <ExplorationOutput cat={cat} cfg={config} {...globalPivot(cat, segments, names, config)} />
        </>
      )}
    </section>
  )
}
