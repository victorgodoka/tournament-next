'use client'

import { useState } from 'react'
import { Alert } from '@ui/alert'
import { Button } from '@ui/button'
import { DataTable } from '@ui/data-table'
import { Field, TextInput } from '@ui/field'
import { Lookup } from '@ui/lookup'
import { PageHeader } from '@ui/page-header'
import { Panel } from '@ui/panel'
import { CardArt } from '@omega/card-art'
import { useResource } from '@hooks/index'
import { clearCover, listCovers, panelErrorText, setCover, type ArchetypeCover } from '@utils/panel'
import { findCards } from '../shared'

const Thumb = ({ id }: { id: number }) => (
  <span className="block size-10 flex-none border border-line-mid">
    <CardArt art={{ id, name: null }} alt="" sizes="40px" className="size-full" />
  </span>
)

/** Every setcode that names a deck, and the card its deck shows. One picked here beats the automatic chain. */
const SetcodeCoversPage = () => {
  const { data, error: loadError } = useResource('archetype-covers', listCovers)
  const [rows, setRows] = useState<ArchetypeCover[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [onlyPinned, setOnlyPinned] = useState(false)
  const [picked, setPicked] = useState<number | null>(null)
  const list = rows ?? data ?? []
  const q = query.trim().toLowerCase()
  const shown = list.filter((r) => (!onlyPinned || r.cover) && (!q || r.name.toLowerCase().includes(q) || String(r.code) === q))
  const current = list.find((r) => r.code === picked) ?? null
  const pinned = list.filter((r) => r.cover).length

  const pin = (code: number, card: number) => {
    setError(null)
    setCover(code, card).then(setRows, (e) => setError(panelErrorText(e)))
  }
  const clear = (code: number) => {
    setError(null)
    clearCover(code).then(
      () => setRows(list.map((r) => (r.code === code ? { ...r, cover: null } : r))),
      (e) => setError(panelErrorText(e)),
    )
  }

  return (
    <>
      <PageHeader
        flush
        eyebrow={`Deck classification · ${pinned} of ${list.length} set`}
        title="Setcode covers"
        lead="The card that stands for the deck a setcode leads: its art on the statistics pages, in deck labels and on its sample deck. A setcode without one keeps the automatic pick (a Series' cover, the sample deck's cover, the most included card). Ignored setcodes are left out."
      />
      {loadError ? <Alert tone="negative" title="Couldn't read the list">{panelErrorText(loadError)}</Alert> : null}
      {error ? <Alert tone="negative" title="That didn't go through">{error}</Alert> : null}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <Field label="Find a setcode" htmlFor="covers-q" className="max-w-sm flex-auto">
              <TextInput id="covers-q" type="search" placeholder="Archetype name or setcode" value={query} onChange={(e) => setQuery(e.target.value)} />
            </Field>
            <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm text-ink-dim">
              <input type="checkbox" checked={onlyPinned} onChange={(e) => setOnlyPinned(e.target.checked)} className="size-4 accent-cyan" />
              Only setcodes with a cover
            </label>
          </div>
          <div className="overflow-x-auto">
            <DataTable
              rows={shown}
              rowKey={(r) => r.code}
              empty={data || rows ? 'No setcode matches.' : 'Loading…'}
              columns={[
                { key: 'code', label: 'Setcode', render: (r) => <span className="text-ink data">{r.code}</span> },
                { key: 'name', label: 'Archetype', strong: true, render: (r) => r.name },
                {
                  key: 'cover',
                  label: 'Cover',
                  render: (r) =>
                    r.cover ? (
                      <span className="flex items-center gap-3"><Thumb id={r.cover.id} /><span className="text-ink">{r.cover.name ?? `#${r.cover.id}`}</span></span>
                    ) : (
                      <span className="text-ink-muted">Automatic</span>
                    ),
                },
                {
                  key: 'actions',
                  label: <span className="block text-right">Actions</span>,
                  render: (r) => (
                    <span className="flex justify-end gap-2">
                      <Button variant={picked === r.code ? 'secondary' : 'ghost'} size="mono" onClick={() => setPicked(r.code)}>{r.cover ? 'Change' : 'Pick card'}</Button>
                      {r.cover ? <Button variant="ghost" size="mono" onClick={() => clear(r.code)}>Automatic</Button> : null}
                    </span>
                  ),
                },
              ]}
            />
          </div>
        </div>
        <aside className="flex flex-col gap-4 xl:sticky xl:top-24">
          <Panel title={current ? current.name : 'Pick a setcode'} meta={current ? String(current.code) : undefined}>
            {current ? (
              <div className="flex flex-col gap-4">
                {current.cover ? (
                  <span className="flex items-center gap-3"><Thumb id={current.cover.id} /><span className="text-ink">{current.cover.name ?? `#${current.cover.id}`}</span></span>
                ) : (
                  <p className="text-sm text-ink-dim">Automatic for now.</p>
                )}
                <Lookup label="Cover card" placeholder="Card name or passcode" search={findCards} exclude={current.cover ? [current.cover.id] : []} onPick={(o) => pin(current.code, Number(o.key))} />
                {current.cover ? <Button variant="ghost" size="mono" onClick={() => clear(current.code)} className="self-start">Back to automatic</Button> : null}
              </div>
            ) : (
              <p className="text-sm text-ink-dim">Choose Pick card on a row, then search the card its deck should show.</p>
            )}
          </Panel>
          <p className="text-[13px] leading-5 text-ink-muted">The statistics pages show a new cover within 5 minutes. Deck labels take it on their next read, sample decks on the next build.</p>
        </aside>
      </div>
    </>
  )
}

export default SetcodeCoversPage
