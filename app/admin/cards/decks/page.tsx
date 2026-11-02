'use client'

import { useState } from 'react'
import { Alert } from '@ui/alert'
import { Button } from '@ui/button'
import { Chip } from '@ui/chip'
import { DataTable } from '@ui/data-table'
import { TextInput } from '@ui/field'
import { PageHeader } from '@ui/page-header'
import { Panel } from '@ui/panel'
import { useResource } from '@hooks/index'
import { count } from '@utils/format'
import { getPanelDeck, ignoreArchetype, listPanelDecks, panelErrorText, unignoreArchetype, type PanelDeck } from '@utils/panel'
import { NextBuildNote, percent, SeasonSelect, useSeason } from '../shared'

const deckName = (deck: Pick<PanelDeck, 'key' | 'name'>) => deck.name ?? (deck.key || 'Unknown')

/** How a key is made: a code near 100% with a mean of one or two is a tech that makes a new key. */
const Setcodes = ({ season, deck }: { season: number; deck: PanelDeck }) => {
  const detail = useResource(`${season}:${deck.key}`, (signal) => getPanelDeck(season, deck.key, signal))
  const [error, setError] = useState<string | null>(null)
  const act = (request: Promise<unknown>) => {
    setError(null)
    request.then(detail.reload, (e) => setError(panelErrorText(e)))
  }
  return (
    <Panel title={deckName(deck)} meta={`${count(deck.decks)} decks`} className="[--edge:var(--color-line-mid)]">
      <div className="flex flex-col gap-3">
        {detail.error ? <Alert tone="negative" title="Couldn't read the deck">{panelErrorText(detail.error)}</Alert> : null}
        {error ? <Alert tone="negative" title="That didn't go through">{error}</Alert> : null}
        <div className="overflow-x-auto">
          <DataTable
            rows={detail.data?.setcodes ?? []}
            rowKey={(s) => s.code}
            empty={detail.data ? 'No named setcode in these decks.' : 'Loading…'}
            columns={[
              { key: 'name', label: 'Setcode', strong: true, render: (s) => <span className="flex items-center gap-2">{s.name ?? 'No name'}{s.ignored ? <Chip tone="gold">Ignored</Chip> : null}</span> },
              { key: 'code', label: 'Code', render: (s) => <span className="data">{s.code}</span> },
              { key: 'share', label: 'In decks', numeric: true, render: (s) => <span className="data">{percent(s.share)}</span> },
              { key: 'mean', label: 'Cards', numeric: true, render: (s) => <span className="data">{s.mean.toFixed(1)} ({s.min}–{s.max})</span> },
              {
                key: 'actions',
                label: <span className="block text-right">Actions</span>,
                render: (s) => (
                  <span className="flex justify-end">
                    {s.ignored ? (
                      <Button variant="ghost" size="mono" onClick={() => act(unignoreArchetype(s.code))}>Stop ignoring</Button>
                    ) : (
                      <Button variant="ghost" size="mono" onClick={() => act(ignoreArchetype(s.code))}>Ignore</Button>
                    )}
                  </span>
                ),
              },
            ]}
          />
        </div>
        <span className="text-ink-muted caption">Stop ignoring only works on a setcode ignored by itself; one ignored through its family is undone on the family, in Ignored setcodes.</span>
      </div>
    </Panel>
  )
}

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
