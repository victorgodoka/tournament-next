'use client'

import { useState } from 'react'
import { Alert } from '@ui/alert'
import { Button } from '@ui/button'
import { Chip } from '@ui/chip'
import { DataTable } from '@ui/data-table'
import { Field, Select, TextArea, TextInput } from '@ui/field'
import { PageHeader } from '@ui/page-header'
import { Panel } from '@ui/panel'
import { useResource } from '@hooks/index'
import { createFormat, deleteFormat, getOptions, listFormats, panelErrorText, updateFormat, type PanelFormat } from '@utils/panel'

type Draft = { id: number | null; name: string; banlistId: string; relFrom: string; relUntil: string; description: string }

const toDraft = (f: PanelFormat): Draft => ({
  id: f.id,
  name: f.name,
  banlistId: String(f.banlist?.id ?? ''),
  relFrom: f.relFrom ?? '',
  relUntil: f.relUntil ?? '',
  description: f.description ?? '',
})

const load = (signal: AbortSignal) =>
  Promise.all([listFormats(signal), getOptions(signal)]).then(([formats, options]) => ({ formats, options }))

const FormatsPage = () => {
  const { data, error: loadError, reload } = useResource('formats', load)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const formats = data?.formats ?? []
  const banlists = data?.options.banlists ?? []
  const d = draft ?? (formats[0] ? toDraft(formats[0]) : null)
  const editing = formats.find((f) => f.id === d?.id)
  const set = (patch: Partial<Draft>) => d && setDraft({ ...d, ...patch })

  const act = (request: Promise<unknown>, after?: (result: unknown) => void) => {
    setBusy(true)
    setError(null)
    request
      .then((result) => {
        after?.(result)
        reload()
      })
      .catch((e) => setError(panelErrorText(e)))
      .finally(() => setBusy(false))
  }

  const save = () => {
    if (!d) return
    const body = {
      name: d.name.trim(),
      banlistId: d.banlistId ? Number(d.banlistId) : null,
      description: d.description.trim() || null,
      relFrom: d.relFrom || null,
      relUntil: d.relUntil || null,
    }
    act(d.id === null ? createFormat(body) : updateFormat(d.id, body), (saved) => setDraft(toDraft(saved as PanelFormat)))
  }

  return (
    <>
      <PageHeader
        flush
        eyebrow={`Schedule · ${formats.length} formats`}
        title="Formats"
        lead="Save a banlist and card window once, then pick it when you schedule. Formats are added as tournaments get made."
        end={
          <Button size="mono-md" onClick={() => setDraft({ id: null, name: '', banlistId: String(banlists[0]?.id ?? ''), relFrom: '', relUntil: '', description: '' })}>
            New format
          </Button>
        }
      />
      {loadError ? <Alert tone="negative" title="Couldn't read the formats">{panelErrorText(loadError)}</Alert> : null}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          <div className="overflow-x-auto">
            <DataTable
              rows={formats}
              rowKey={(f) => f.id}
              isSelected={(f) => f.id === d?.id}
              empty={data ? 'No formats yet.' : 'Loading…'}
              columns={[
                {
                  key: 'name',
                  label: 'Name',
                  render: (f) => (
                    <button type="button" className="cursor-pointer text-left font-bold text-ink hover:text-cyan" onClick={() => setDraft(toDraft(f))}>
                      {f.name}
                    </button>
                  ),
                },
                {
                  key: 'banlist',
                  label: 'Banlist',
                  render: (f) => (
                    <span className="inline-flex items-center gap-2">
                      {f.banlist?.name ?? '—'}
                      {f.banlist && banlists.some((b) => b.id === f.banlist?.id) ? <span className="text-ink-muted data">#{f.banlist.id}</span> : null}
                      {f.banlist && !banlists.some((b) => b.id === f.banlist?.id) ? <Chip tone="gold">Rotated out</Chip> : null}
                    </span>
                  ),
                },
                { key: 'window', label: 'Card window', render: (f) => <span className="data">{f.relFrom ?? 'Any'} → {f.relUntil ?? 'Any'}</span> },
                { key: 'desc', label: 'Description', render: (f) => f.description || '—' },
                { key: 'count', label: 'Scheduled', numeric: true, render: (f) => <span className="text-ink display-3">{f.tournaments ?? 0}</span> },
              ]}
            />
          </div>

          {data?.options.banlistsNotInCardDb.length ? (
            <Panel title="Banlists outside the card database" meta="From /panel/options" className="[--edge:var(--color-line-mid)]">
              <p className="mb-4.5 max-w-160 text-sm leading-5.5 text-ink-dim">
                The card database is replaced every day and dated lists rotate out. Omega still has tournaments on them, and a format keeps the name it was saved
                with, so its search keeps working.
              </p>
              <ul className="grid grid-cols-1 gap-px bg-line min-[720px]:grid-cols-3">
                {data.options.banlistsNotInCardDb.map((b) => (
                  <li key={b.name} className="flex flex-col gap-1.5 bg-surface-200 px-4 py-3.5">
                    <span className="text-sm font-bold">{b.name}</span>
                    <span className="text-ink-muted signal-sm">{b.tournaments} tournaments</span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>

        {d ? (
          <Panel label="Format editor" className="flex flex-col gap-4.5 [--edge:var(--color-line-mid)]">
            <div className="flex flex-col gap-1.5">
              <span className="text-ink-muted data">{d.id === null ? 'New format' : `Format #${d.id}`}</span>
              <h2 className="display-3">{d.name || 'Untitled'}</h2>
            </div>
            <Field label="Name" htmlFor="fmt-name" hint="Unique, ignoring case">
              <TextInput id="fmt-name" value={d.name} onChange={(e) => set({ name: e.target.value })} />
            </Field>
            <Field label="Banlist" hint="From the card database. The name is what the game writes, so tournament search needs no mapping.">
              <Select
                block
                aria-label="Banlist"
                value={d.banlistId}
                onChange={(e) => set({ banlistId: e.target.value })}
                options={[
                  ...banlists.map((b) => ({ value: String(b.id), label: `${b.name} · #${b.id}` })),
                  ...(editing?.banlist && !banlists.some((b) => b.id === editing.banlist?.id)
                    ? [{ value: String(editing.banlist.id), label: `${editing.banlist.name} · rotated out` }]
                    : []),
                ]}
              />
            </Field>
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Released from" htmlFor="fmt-from">
                  <TextInput id="fmt-from" type="date" value={d.relFrom} onChange={(e) => set({ relFrom: e.target.value })} />
                </Field>
                <Field label="Released until" htmlFor="fmt-until">
                  <TextInput id="fmt-until" type="date" value={d.relUntil} onChange={(e) => set({ relUntil: e.target.value })} />
                </Field>
              </div>
              <span className="text-ink-muted caption">Booster release dates, not card dates</span>
            </div>
            <Field label="Description" htmlFor="fmt-desc">
              <TextArea id="fmt-desc" rows={2} value={d.description} onChange={(e) => set({ description: e.target.value })} />
            </Field>
            {editing ? (
              <Alert plain title={`${editing.tournaments ?? 0} scheduled tournaments came from ${editing.name}`}>
                Deleting the format keeps them and their settings. They just stop showing {editing.name} as their format.
              </Alert>
            ) : null}
            {error ? <Alert tone="negative" title="Not saved">{error}</Alert> : null}
            <div className="flex gap-3">
              <Button size="mono-md" className="flex-1" disabled={busy || !d.name.trim()} onClick={save}>
                Save format
              </Button>
              {d.id !== null ? (
                <Button
                  variant="danger-outline"
                  size="mono-md"
                  disabled={busy}
                  onClick={() => d.id !== null && act(deleteFormat(d.id), () => setDraft(null))}
                >
                  Delete
                </Button>
              ) : null}
            </div>
            <span className="text-ink-muted caption">Editing a format doesn&apos;t change tournaments already scheduled from it.</span>
          </Panel>
        ) : null}
      </div>
    </>
  )
}

export default FormatsPage
