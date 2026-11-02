'use client'

import { useState } from 'react'
import { Alert } from '@ui/alert'
import { DataTable } from '@ui/data-table'
import { TextInput } from '@ui/field'
import { PageHeader } from '@ui/page-header'
import { useResource } from '@hooks/index'
import { count } from '@utils/format'
import { listPanelDecks, panelErrorText } from '@utils/panel'
import { NextBuildNote, percent, SeasonSelect, useSeason } from '../shared'
import { deckName, Setcodes } from './Setcodes'

const DecksPage = () => {
  const [picked, setPicked] = useState<number | null>(null)
  const { swept, season, loading } = useSeason(picked)
  const decks = useResource(season === null ? null : `decks:${season}`, (signal) => listPanelDecks(season!, signal))
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const q = query.trim().toLowerCase()
  const rows = (decks.data ?? []).filter((d) => deckName(d).toLowerCase().includes(q) || d.key.includes(q))
  const deck = decks.data?.find((d) => d.key === open)

  return (
    <>
      <PageHeader
        flush
        eyebrow={`Deck classification · ${count(decks.data?.length ?? 0)} decks`}
        title="Decks"
        lead="The decks a season's build found. Open one to see which setcodes make its key, and ignore the noise."
      />
      {decks.error ? <Alert tone="negative" title="Couldn't read the decks">{panelErrorText(decks.error)}</Alert> : null}
      {!loading && !swept.length ? <Alert title="No season has statistics yet">Run the job first: the list comes from its build.</Alert> : null}

      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-60"><SeasonSelect seasons={swept} value={season} onChange={(id) => { setPicked(id); setOpen(null) }} /></div>
        <TextInput aria-label="Filter decks" placeholder="Filter by name or key" value={query} onChange={(e) => setQuery(e.target.value)} plateClassName="min-w-60" />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        <div className="overflow-x-auto">
          <DataTable
            rows={rows}
            rowKey={(d) => d.key}
            isSelected={(d) => d.key === open}
            empty={decks.data ? 'No deck here.' : 'Loading…'}
            columns={[
              {
                key: 'name',
                label: 'Deck',
                strong: true,
                render: (d) => (
                  <button type="button" aria-pressed={d.key === open} onClick={() => setOpen(d.key === open ? null : d.key)} className="cursor-pointer text-left hover:text-cyan">
                    {deckName(d)}
                  </button>
                ),
              },
              { key: 'decks', label: 'Decks', numeric: true, render: (d) => <span className="data">{count(d.decks)}</span> },
              { key: 'share', label: 'Share', numeric: true, render: (d) => <span className="data">{percent(d.share)}</span> },
              { key: 'players', label: 'Duelists', numeric: true, render: (d) => <span className="data">{count(d.players)}</span> },
            ]}
          />
        </div>
        <div className="flex flex-col gap-4">
          {deck && season !== null ? <Setcodes key={deck.key} season={season} deck={deck} /> : <Alert plain title="Pick a deck">Its setcodes show here.</Alert>}
          <NextBuildNote />
        </div>
      </div>
    </>
  )
}

export default DecksPage
