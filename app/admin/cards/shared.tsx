'use client'

import { Alert } from '@ui/alert'
import { Select } from '@ui/field'
import type { LookupOption } from '@ui/lookup'
import { useResource } from '@hooks/index'
import { findArchetypes, searchCardArts } from '@utils/cards'
import { getSeasons } from '@utils/statistics'

/** Module-level so `useSearch` sees a stable function. */
export const findCards = (text: string, signal: AbortSignal): Promise<LookupOption[]> =>
  searchCardArts(text, 8, signal).then((cards) => cards.map((c) => ({ key: c.id, label: c.name, meta: c.id })))

export const findSetcodes = (text: string, signal: AbortSignal): Promise<LookupOption[]> =>
  findArchetypes(text, signal).then((list) => list.map((a) => ({ key: a.code, label: a.name, meta: a.code })))

export const percent = (rate: number | null) => (rate === null ? '—' : `${(rate * 100).toFixed(1)}%`)

/** The swept seasons, newest first, and the picked one: the first until someone picks. */
export const useSeason = (picked: number | null) => {
  const seasons = useResource('statistics-seasons', () => getSeasons())
  const swept = (seasons.data ?? []).filter((s) => s.sweptThrough)
  return { swept, season: picked ?? swept[0]?.id ?? null, loading: !seasons.data }
}

export const SeasonSelect = ({ seasons, value, onChange }: { seasons: { id: number; label: string; code: string }[]; value: number | null; onChange: (id: number) => void }) => (
  <Select label="Season" value={value === null ? '' : String(value)} onChange={(e) => onChange(Number(e.target.value))} options={seasons.map((s) => ({ value: String(s.id), label: `${s.label} (${s.code})` }))} />
)

/** Every rule of this section lands in two steps. */
export const NextBuildNote = () => (
  <Alert edged plain={false} tone="warn" title="A change shows in two steps">
    Deck names in profiles, match history and tournament decklists change on their next read. /statistics changes after the next build: the nightly job, or the job page for yesterday.
  </Alert>
)
