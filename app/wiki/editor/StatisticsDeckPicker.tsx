'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import { Lookup } from '@ui/lookup'
import { StatisticsDeckArt } from '@omega/wiki/statistics-deck'
import { API_URL } from '@utils/auth'
import type { Meta } from '@utils/statistics'
import type { WikiStatisticsDeck } from '@utils/wiki-doc'
import { statisticsDeckOf } from '@utils/wiki-statistics-deck'
import { FIELD, LABEL } from '../ArticleForm'

const fold = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export const StatisticsDeckPicker = ({ value, onChange }: { value?: WikiStatisticsDeck; onChange: (deck: WikiStatisticsDeck | undefined) => void }) => {
  const id = useId()
  const [chosenLadder, setLadder] = useState<WikiStatisticsDeck['ladder']>(value?.ladder ?? 'tcg')
  const ladder = value?.key ? value.ladder : chosenLadder
  const [answer, setAnswer] = useState<{ ladder: string; meta?: Meta; error?: boolean } | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    fetch(`${API_URL}/statistics/meta?ladder=${ladder}&band=all`, { signal: controller.signal })
      .then(async (res) => { if (!res.ok) throw new Error(String(res.status)); return await res.json() as Meta })
      .then((meta) => setAnswer({ ladder, meta }))
      .catch((error: Error) => { if (error.name !== 'AbortError') setAnswer({ ladder, error: true }) })
    return () => controller.abort()
  }, [ladder])
  const meta = answer?.ladder === ladder ? answer.meta : undefined
  const search = useCallback(async (query: string) => (meta?.decks ?? [])
    .filter((deck) => deck.key && (fold(deck.name ?? '').includes(fold(query)) || deck.key === query))
    .sort((a, b) => (a.name ?? a.key).localeCompare(b.name ?? b.key))
    .slice(0, 30)
    .map((deck) => ({ key: deck.key, label: deck.name ?? `Archetype ${deck.key}`, meta: deck.key.endsWith('*') ? 'Archetype family' : 'Deck build' })), [meta])
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div>
        <label htmlFor={id} className={LABEL}>Statistics ladder</label>
        <select id={id} value={ladder} className={FIELD} onChange={(event) => { setLadder(event.target.value as WikiStatisticsDeck['ladder']); onChange(undefined) }}>
          <option value="tcg">TCG</option><option value="genesys">Genesys</option>
        </select>
      </div>
      {meta ? <Lookup label="Search statistics decks" placeholder="Search an archetype or deck" search={search} onPick={(option) => {
        const deck = meta.decks.find((d) => d.key === option.key)
        if (deck) onChange(statisticsDeckOf(deck, meta, ladder))
      }} /> : <p role="status" className="text-ink-muted body-sm">{answer?.ladder === ladder && answer.error ? 'Could not load statistics. Change the ladder to retry.' : 'Loading statistics decks…'}</p>}
      {value?.key ? (
        <div className="flex items-center gap-3 border border-line bg-surface-200 p-3">
          <StatisticsDeckArt deck={value} className="w-20 shrink-0" />
          <span className="min-w-0 flex-1 text-ink body-strong">{value.name}</span>
          <button type="button" onClick={() => onChange(undefined)} aria-label="Clear statistics deck" className="cursor-pointer p-2 text-ink-muted hover:text-loss">×</button>
        </div>
      ) : null}
    </div>
  )
}
