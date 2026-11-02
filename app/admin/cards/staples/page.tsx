'use client'

import { useState } from 'react'
import { Alert } from '@ui/alert'
import { Button } from '@ui/button'
import { Chip } from '@ui/chip'
import { DataTable } from '@ui/data-table'
import { Lookup } from '@ui/lookup'
import { PageHeader } from '@ui/page-header'
import { useResource } from '@hooks/index'
import { count } from '@utils/format'
import { listStaples, panelErrorText, resetStaple, setStaple } from '@utils/panel'
import { findCards, NextBuildNote, percent, SeasonSelect, useSeason } from '../shared'

const StaplesPage = () => {
  const [picked, setPicked] = useState<number | null>(null)
  const { swept, season } = useSeason(picked)
  const staples = useResource(season === null ? null : `staples:${season}`, (signal) => listStaples(season!, signal))
  const [error, setError] = useState<string | null>(null)
  const act = (request: Promise<unknown>) => {
    setError(null)
    request.then(staples.reload, (e) => setError(panelErrorText(e)))
  }
  const enabled = staples.data?.filter((s) => s.enabled).length ?? 0

  return (
    <>
      <PageHeader
        flush
        eyebrow={`Deck classification · ${count(enabled)} staples`}
        title="Staples"
        lead="Cards that don't name a deck. The build finds them every night; a decision here overrides it for that card until it's reset."
      />
      {staples.error ? <Alert tone="negative" title="Couldn't read the staples">{panelErrorText(staples.error)}</Alert> : null}
      {error ? <Alert tone="negative" title="That didn't go through">{error}</Alert> : null}

      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-60"><SeasonSelect seasons={swept} value={season} onChange={setPicked} /></div>
        <Lookup label="Card to make a staple" placeholder="Card name — pick one to make it a staple" search={findCards} exclude={(staples.data ?? []).filter((s) => s.enabled).map((s) => s.card)} onPick={(o) => act(setStaple(Number(o.key), true))} className="min-w-80 flex-1" />
      </div>

      <div className="overflow-x-auto">
        <DataTable
          rows={staples.data ?? []}
          rowKey={(s) => s.card}
          empty={staples.data ? 'No staple yet: the build finds them.' : 'Loading…'}
          columns={[
            { key: 'name', label: 'Card', strong: true, render: (s) => s.name ?? 'Left the card database' },
            { key: 'id', label: 'Passcode', render: (s) => <span className="data">{s.card}</span> },
            { key: 'source', label: 'Decided by', render: (s) => <Chip tone={s.source === 'manual' ? 'gold' : 'neutral'}>{s.source === 'manual' ? 'Staff' : 'Build'}</Chip> },
            { key: 'state', label: 'Staple', render: (s) => (s.enabled ? 'Yes' : 'No') },
            { key: 'share', label: 'In decks', numeric: true, render: (s) => <span className="data">{percent(s.share)}</span> },
            { key: 'foreign', label: 'Foreign', numeric: true, render: (s) => <span className="data">{percent(s.foreignShare)}</span> },
            {
              key: 'actions',
              label: <span className="block text-right">Actions</span>,
              render: (s) => (
                <span className="flex justify-end gap-2">
                  <Button variant="ghost" size="mono" onClick={() => act(setStaple(s.card, !s.enabled))}>{s.enabled ? 'Disable' : 'Enable'}</Button>
                  {s.source === 'manual' ? <Button variant="ghost" size="mono" onClick={() => act(resetStaple(s.card))}>Reset</Button> : null}
                </span>
              ),
            },
          ]}
        />
      </div>
      <span className="text-ink-muted caption">Foreign: of the decks holding the card, those where no other card shares a setcode with it. The detection cut-offs are in Settings.</span>
      <NextBuildNote />
    </>
  )
}

export default StaplesPage
