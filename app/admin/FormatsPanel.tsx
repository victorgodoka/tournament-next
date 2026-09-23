'use client'

import { useEffect, useState } from 'react'
import { Button, Chip } from '@ui/index'
import {
  createFormat,
  deleteFormat,
  listFormats,
  updateFormat,
  type FormatBody,
  type PanelFormat,
} from '@utils/panel'
import type { Banlist } from '@utils/wiki'
import { Empty, errorText, Field, INPUT, List, ListRow, Notice, Row, RowButton, day } from './ui'

type Draft = {
  name: string
  banlistId: string
  description: string
  relFrom: string
  relUntil: string
}

const BLANK: Draft = { name: '', banlistId: '', description: '', relFrom: '', relUntil: '' }

const toDraft = (format: PanelFormat): Draft => ({
  name: format.name,
  banlistId: format.banlist ? String(format.banlist.id) : '',
  description: format.description ?? '',
  relFrom: format.relFrom ?? '',
  relUntil: format.relUntil ?? '',
})

/** Empty text is `null`, not `""`. */
const trimmed = (value: string) => (value.trim() ? value.trim() : null)

const toBody = (draft: Draft): FormatBody => ({
  name: draft.name.trim(),
  banlistId: draft.banlistId ? Number(draft.banlistId) : null,
  description: trimmed(draft.description),
  relFrom: trimmed(draft.relFrom),
  relUntil: trimmed(draft.relUntil),
})

/* ---------------------------------------------------------------- *
 * The form
 * ---------------------------------------------------------------- */

const FormatForm = ({
  format,
  banlists,
  onDone,
  onCancel,
}: {
  format: PanelFormat | null
  banlists: Banlist[]
  onDone: (format: PanelFormat) => void
  onCancel: () => void
}) => {
  const [draft, setDraft] = useState<Draft>(format ? toDraft(format) : BLANK)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const set = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }))

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const body = toBody(draft)
      onDone(format ? await updateFormat(format.id, body) : await createFormat(body))
    } catch (failure) {
      setError(errorText(failure))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="border border-line-strong bg-surface-100 p-5.5 lg:p-7">
      <p className="text-gold signal-lg">{format ? `Edit ${format.name}` : 'New format'}</p>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <Field id="format-name" label="Name" hint="Unique, case-insensitive.">
          <input
            id="format-name"
            value={draft.name}
            onChange={(e) => set({ name: e.target.value })}
            required
            autoComplete="off"
            placeholder="Edison"
            className={INPUT}
          />
        </Field>

        <Field id="format-banlist" label="Banlist (card database)" hint="Goes into the createtourny command. Same name the game writes, so the format finds its tournaments.">
          <select
            id="format-banlist"
            value={draft.banlistId}
            onChange={(e) => set({ banlistId: e.target.value })}
            className={INPUT}
          >
            <option value="">None</option>
            {banlists.map((banlist) => (
              <option key={banlist.id} value={banlist.id}>
                {banlist.name} · {banlist.format}
              </option>
            ))}
          </select>
        </Field>

        <Field id="format-description" label="Description">
          <input
            id="format-description"
            value={draft.description}
            onChange={(e) => set({ description: e.target.value })}
            autoComplete="off"
            placeholder="March 2010 format"
            className={INPUT}
          />
        </Field>

        <Field id="format-rel-from" label="Cards released from" hint="Booster release date. Empty means no lower bound.">
          <input
            id="format-rel-from"
            type="date"
            value={draft.relFrom}
            onChange={(e) => set({ relFrom: e.target.value })}
            className={INPUT}
          />
        </Field>

        <Field id="format-rel-until" label="Cards released until" hint="Empty means no upper bound.">
          <input
            id="format-rel-until"
            type="date"
            value={draft.relUntil}
            onChange={(e) => set({ relUntil: e.target.value })}
            className={INPUT}
          />
        </Field>
      </div>

      {error ? (
        <div className="mt-6">
          <Notice tone="error">{error}</Notice>
        </div>
      ) : null}

      <div className="mt-7 flex flex-wrap gap-3">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? 'Saving…' : format ? 'Save format' : 'Create format'}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

/* ---------------------------------------------------------------- *
 * The list
 * ---------------------------------------------------------------- */

const FormatRow = ({
  format,
  onEdit,
  onDelete,
}: {
  format: PanelFormat
  onEdit: () => void
  onDelete: () => Promise<void>
}) => {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const used = format.tournaments ?? 0

  return (
    <ListRow>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-ink display-5">{format.name}</p>
          <p className="mt-1.5 text-ink-muted mono-data">
            {format.banlist ? format.banlist.name : 'no banlist'} · cards {day(format.relFrom)} → {day(format.relUntil)}
          </p>
          {format.description ? <p className="mt-1.5 text-ink-dim body-sm">{format.description}</p> : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {format.banlist ? null : (
            <Chip tone="amber" title="Searching Omega tournaments by this format will answer 400.">
              no banlist
            </Chip>
          )}
          <Chip tone="neutral">{used} scheduled</Chip>
          <RowButton onClick={onEdit}>Edit</RowButton>
          <RowButton tone="danger" onClick={() => setConfirming(true)}>
            Delete
          </RowButton>
        </div>
      </div>

      {confirming ? (
        <div className="mt-3.75 border border-negative bg-ground-negative px-4 py-3.5">
          <p className="text-ink body-sm">
            Delete <strong>{format.name}</strong>?{' '}
            {used > 0
              ? `${used} scheduled tournament${used === 1 ? '' : 's'} keep their parameters but lose their provenance.`
              : 'No scheduled tournament came from it.'}
          </p>
          <div className="mt-3 flex gap-2">
            <RowButton
              tone="danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                await onDelete().finally(() => setBusy(false))
              }}
            >
              {busy ? 'Deleting…' : 'Delete it'}
            </RowButton>
            <RowButton onClick={() => setConfirming(false)} disabled={busy}>
              Keep
            </RowButton>
          </div>
        </div>
      ) : null}
    </ListRow>
  )
}

export const FormatsPanel = ({ banlists }: { banlists: Banlist[] }) => {
  const [formats, setFormats] = useState<PanelFormat[] | null>(null)
  const [editing, setEditing] = useState<PanelFormat | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)

  /** Re-read after a save: the list response carries `tournaments`, a save doesn't. */
  const reload = () => listFormats().then(setFormats).catch((failure) => setError(errorText(failure)))

  useEffect(() => {
    const abort = new AbortController()
    listFormats(abort.signal)
      .then(setFormats)
      .catch((failure) => !abort.signal.aborted && setError(errorText(failure)))
    return () => abort.abort()
  }, [])

  const remove = async (id: number) => {
    try {
      await deleteFormat(id)
      setFormats((current) => current?.filter((format) => format.id !== id) ?? null)
    } catch (failure) {
      setError(errorText(failure))
    }
  }

  return (
    <Row
      index="01"
      title="Formats"
      blurb="A catalog so the same banlist and card window aren't retyped for every tournament. Add one as tournaments need it, not upfront."
      action={
        editing === null ? (
          <Button size="sm" onClick={() => setEditing('new')}>
            New format
          </Button>
        ) : null
      }
    >
      <div className="grid gap-6">
        {editing !== null ? (
          <FormatForm
            format={editing === 'new' ? null : editing}
            banlists={banlists}
            onCancel={() => setEditing(null)}
            onDone={() => {
              setEditing(null)
              setError(null)
              reload()
            }}
          />
        ) : null}

        <Notice tone="error">{error}</Notice>

        {formats === null ? (
          <Empty>Loading formats…</Empty>
        ) : formats.length === 0 ? (
          <Empty>No format registered yet.</Empty>
        ) : (
          <List>
            {formats.map((format) => (
              <FormatRow
                key={format.id}
                format={format}
                onEdit={() => setEditing(format)}
                onDelete={() => remove(format.id)}
              />
            ))}
          </List>
        )}
      </div>
    </Row>
  )
}
