'use client'

import { useState } from 'react'
import { Alert } from '@ui/alert'
import { Button } from '@ui/button'
import { DataTable } from '@ui/data-table'
import { PageHeader } from '@ui/page-header'
import { useResource } from '@hooks/index'
import { dayLabel } from '@utils/format'
import { createSeries, deleteSeries, listSeries, panelErrorText, updateSeries, type Series } from '@utils/panel'
import { SeriesForm } from './SeriesForm'

/** `null` is the list; `'new'` an empty form; a Series its edit form. */
type Editing = null | 'new' | Series

const SeriesPage = () => {
  const { data, error: loadError, reload } = useResource('series', listSeries)
  const [editing, setEditing] = useState<Editing>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = (request: Promise<unknown>, done?: () => void) => {
    setError(null)
    setSaving(true)
    request.then(
      () => {
        setSaving(false)
        done?.()
        reload()
      },
      (e) => {
        setSaving(false)
        setError(panelErrorText(e))
      },
    )
  }

  return (
    <>
      <PageHeader
        flush
        eyebrow={`Deck classification · ${data?.length ?? 0} series`}
        title="Series"
        lead="An archetype the card database does not have, made of cards: a new archetype, or a setcode that gains cards. A deck's cards decide its name from these."
        end={editing ? undefined : <Button onClick={() => { setError(null); setEditing('new') }}>New Series</Button>}
      />
      {loadError ? <Alert tone="negative" title="Couldn't read the list">{panelErrorText(loadError)}</Alert> : null}

      {editing ? (
        <SeriesForm
          key={editing === 'new' ? 'new' : editing.id}
          series={editing === 'new' ? undefined : editing}
          saving={saving}
          error={error}
          onCancel={() => setEditing(null)}
          onSave={(input) => run(editing === 'new' ? createSeries(input) : updateSeries(editing.id, input), () => setEditing(null))}
        />
      ) : (
        <>
          {error ? <Alert tone="negative" title="That didn't go through">{error}</Alert> : null}
          <div className="overflow-x-auto">
            <DataTable
              rows={data ?? []}
              rowKey={(r) => r.id}
              empty={data ? 'No Series yet.' : 'Loading…'}
              columns={[
                { key: 'name', label: 'Name', strong: true, render: (r) => r.name },
                { key: 'code', label: 'Code', render: (r) => <span className="text-ink data">{r.code}</span> },
                { key: 'kind', label: 'Kind', render: (r) => (r.archetype ? `becomes ${r.archetype.name ?? r.archetype.code}` : 'new') },
                { key: 'setcodes', label: 'Setcodes', numeric: true, render: (r) => <span className="data">{r.archetypes.length}</span> },
                { key: 'cards', label: 'Cards', numeric: true, render: (r) => <span className="data">{r.cards.length}</span> },
                { key: 'mentions', label: 'Mentions', numeric: true, render: (r) => <span className="data">{r.mentions.length}</span> },
                { key: 'when', label: 'Updated', render: (r) => dayLabel(r.updatedAt) },
                {
                  key: 'actions',
                  label: <span className="block text-right">Actions</span>,
                  render: (r) => (
                    <span className="flex justify-end gap-2">
                      <Button variant="ghost" size="mono" onClick={() => { setError(null); setEditing(r) }}>Edit</Button>
                      <Button variant="ghost" size="mono" onClick={() => { if (window.confirm(`Delete the Series "${r.name}"?`)) run(deleteSeries(r.id)) }}>Delete</Button>
                    </span>
                  ),
                },
              ]}
            />
          </div>
        </>
      )}
    </>
  )
}

export default SeriesPage
