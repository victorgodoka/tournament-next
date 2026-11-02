'use client'

import { useState } from 'react'
import { Alert } from '@ui/alert'
import { Button } from '@ui/button'
import { Chip } from '@ui/chip'
import { Switch } from '@ui/choice'
import { DataTable } from '@ui/data-table'
import { Panel } from '@ui/panel'
import { useResource } from '@hooks/index'
import { count } from '@utils/format'
import { getPanelDeck, ignoreArchetype, panelErrorText, unignoreArchetype, type PanelDeck } from '@utils/panel'
import { percent } from '../shared'

export const deckName = (deck: Pick<PanelDeck, 'key' | 'name'>) => deck.name ?? (deck.key || 'Unknown')

/** How a key is made: a code near 100% with a mean of one or two is a tech that makes a new key. Ignored codes stay out until asked for. */
export const Setcodes = ({ season, deck }: { season: number; deck: PanelDeck }) => {
  const detail = useResource(`${season}:${deck.key}`, (signal) => getPanelDeck(season, deck.key, signal))
  const [error, setError] = useState<string | null>(null)
  const [showIgnored, setShowIgnored] = useState(false)
  const setcodes = detail.data?.setcodes ?? []
  const ignored = setcodes.filter((s) => s.ignored).length
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
            rows={showIgnored ? setcodes : setcodes.filter((s) => !s.ignored)}
            rowKey={(s) => s.code}
            empty={detail.data ? 'No setcode to show here.' : 'Loading…'}
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
        {ignored ? <Switch quiet checked={showIgnored} onChange={setShowIgnored} label={`Show ignored (${ignored})`} /> : null}
        {showIgnored ? <span className="text-ink-muted caption">Stop ignoring only works on a setcode ignored by itself; one ignored through its family is undone on the family, in Ignored setcodes.</span> : null}
      </div>
    </Panel>
  )
}
