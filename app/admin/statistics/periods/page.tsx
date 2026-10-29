'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Alert } from '@ui/alert'
import { Button } from '@ui/button'
import { Chip } from '@ui/chip'
import { DataTable } from '@ui/data-table'
import { Dialog } from '@ui/dialog'
import { Field, TextInput } from '@ui/field'
import { PageHeader } from '@ui/page-header'
import { Panel } from '@ui/panel'
import { Segmented } from '@ui/choice'
import { useResource } from '@hooks/index'
import { dayLabel, fromBrt, toBrt } from '@utils/format'
import {
  createPeriod,
  deletePeriod,
  getAnalyticsSweep,
  listPanelPeriods,
  panelErrorText,
  updatePeriod,
  type PanelPeriod,
  type PeriodBackfill,
} from '@utils/panel'
import type { RankedLadderId } from '@utils/types'

/** `<input type="datetime-local">` value read as BRT. */
const brtLocal = (value: string) => fromBrt(value.slice(0, 10), value.slice(11, 16))

type Draft = { id: number | null; code: string; label: string; ladder: RankedLadderId; startsAt: string; endsAt: string }

const BLANK: Draft = { id: null, code: '', label: '', ladder: 'tcg', startsAt: '', endsAt: '' }
const local = (iso: string) => `${toBrt(iso).date}T${toBrt(iso).time}`
const toDraft = (p: PanelPeriod): Draft => ({ id: p.id, code: p.code, label: p.label, ladder: p.ladder, startsAt: local(p.startsAt), endsAt: local(p.endsAt) })

const load = (signal: AbortSignal) =>
  Promise.all([listPanelPeriods(signal), getAnalyticsSweep(signal)]).then(([periods, sweep]) => ({ periods, sweep, readAt: Date.now() }))

const PeriodsPage = () => {
  const { data, error: loadError, reload } = useResource('periods', load)
  const [draft, setDraft] = useState<Draft>(BLANK)
  const [backfill, setBackfill] = useState<{ label: string; backfill: PeriodBackfill } | null>(null)
  const [deleting, setDeleting] = useState<PanelPeriod | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch })

  const now = data?.readAt ?? 0
  const running = data?.sweep.running
  const state = (p: PanelPeriod) => {
    if (Date.parse(p.startsAt) > now) return { label: 'Starts in the future', color: 'text-ink-muted' }
    const [from] = [p.startsAt.slice(0, 10)]
    if (running && running.from <= p.endsAt.slice(0, 10) && running.to >= from) return { label: 'Backfilling', color: 'text-azure-lift' }
    return { label: 'Filled', color: 'text-win' }
  }

  const save = () => {
    const startsAt = brtLocal(draft.startsAt)
    const endsAt = brtLocal(draft.endsAt)
    if (!startsAt || !endsAt) return setError('Pick when the period starts and ends.')
    setBusy(true)
    setError(null)
    const body = { code: draft.code.trim(), label: draft.label.trim(), ladder: draft.ladder, startsAt, endsAt }
    ;(draft.id === null ? createPeriod(body) : updatePeriod(draft.id, body))
      .then((saved) => {
        setBackfill({ label: saved.label, backfill: saved.backfill })
        setDraft(BLANK)
        reload()
      })
      .catch((e) => setError(panelErrorText(e)))
      .finally(() => setBusy(false))
  }

  const remove = () => {
    if (!deleting) return
    const id = deleting.id
    setDeleting(null)
    deletePeriod(id).then(reload, (e) => setError(panelErrorText(e)))
  }

  return (
    <>
      <PageHeader
        flush
        eyebrow={`Analytics · ${data?.periods.length ?? 0} periods · newest first`}
        title="Periods"
        lead="A named window of one ladder, offered in Segments next to the seasons on duelist and global analytics. Any dates, overlaps allowed. No leaderboard, Elo or rank."
      />
      {loadError ? <Alert tone="negative" title="Couldn't read the periods">{panelErrorText(loadError)}</Alert> : null}

      {backfill?.backfill ? (
        <Alert
          edged
          tone="info"
          badge={<Chip tone="indigo">{backfill.backfill.status === 'started' ? 'Backfill started' : 'Sweep busy'}</Chip>}
          action={<Link href="/admin/statistics/sweep" className="signal-strong">See progress</Link>}
          className="items-center"
        >
          <span className="text-sm text-ink">
            {backfill.backfill.status === 'started'
              ? `${backfill.label} saved. The global sweep is filling ${backfill.backfill.from} → ${backfill.backfill.to}. Duelist pages read periods live and need nothing.`
              : `${backfill.label} saved, but another sweep was running. Start one for ${backfill.backfill.from} → ${backfill.backfill.to} when it ends.`}
          </span>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="overflow-x-auto">
            <DataTable
              rows={data?.periods ?? []}
              rowKey={(p) => p.id}
              isSelected={(p) => p.id === draft.id}
              empty={data ? 'No periods yet.' : 'Loading…'}
              columns={[
                { key: 'code', label: 'Code', render: (p) => <span className="text-ink data">{p.code}</span> },
                { key: 'label', label: 'Label', strong: true, render: (p) => p.label },
                { key: 'ladder', label: 'Ladder', render: (p) => <Chip tone={p.ladder}>{p.ladder === 'tcg' ? 'TCG' : 'Genesys'}</Chip> },
                {
                  key: 'window',
                  label: 'Window (BRT)',
                  render: (p) => {
                    const s = state(p)
                    return (
                      <span className="flex flex-col">
                        <span>
                          {dayLabel(p.startsAt)} → {dayLabel(new Date(Date.parse(p.endsAt) - 1))}
                        </span>
                        <span className={`signal-sm ${s.color}`}>{s.label}</span>
                      </span>
                    )
                  },
                },
                { key: 'by', label: 'Created', render: (p) => <span className="data">{p.createdBy ?? '—'}</span> },
                {
                  key: 'actions',
                  label: <span className="block text-right">Actions</span>,
                  render: (p) => (
                    <span className="flex justify-end gap-2">
                      <Button variant="ghost" size="mono" onClick={() => setDraft(toDraft(p))}>Edit</Button>
                      <Button variant="ghost" size="mono" className="text-crimson-lift" onClick={() => setDeleting(p)}>Delete</Button>
                    </span>
                  ),
                },
              ]}
            />
          </div>
          <span className="text-ink-muted caption">
            Deleting a period drops its global data too. Changing its ladder or dates drops the days already written and sweeps again.
          </span>
        </div>

        <Panel label={draft.id === null ? 'New period' : 'Edit period'} className="flex flex-col gap-4.5 [--edge:var(--color-line-mid)]">
          <h2 className="display-3">{draft.id === null ? 'New period' : `Edit ${draft.label}`}</h2>
          <Field
            label="Code"
            htmlFor="pe-code"
            hint={
              draft.id === null
                ? 'Lowercase letters, digits and dashes, up to 40, with at least one letter. Unique across seasons and periods.'
                : 'Explorations store the code: changing it breaks the ones that compare this period.'
            }
          >
            <TextInput id="pe-code" mono maxLength={40} value={draft.code} onChange={(e) => set({ code: e.target.value.toLowerCase() })} />
          </Field>
          <Field label="Label" htmlFor="pe-label">
            <TextInput id="pe-label" maxLength={60} value={draft.label} onChange={(e) => set({ label: e.target.value })} />
          </Field>
          <Field label="Ladder">
            <Segmented
              label="Ladder"
              value={draft.ladder}
              onChange={(ladder) => set({ ladder })}
              options={[
                { value: 'tcg', label: 'TCG' },
                { value: 'genesys', label: 'Genesys' },
              ]}
            />
          </Field>
          <div className="flex flex-col gap-1.5">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Starts" htmlFor="pe-start">
                <TextInput id="pe-start" type="datetime-local" value={draft.startsAt} onChange={(e) => set({ startsAt: e.target.value })} />
              </Field>
              <Field label="Ends" htmlFor="pe-end">
                <TextInput id="pe-end" type="datetime-local" value={draft.endsAt} onChange={(e) => set({ endsAt: e.target.value })} aria-label="Ends at, exclusive" />
              </Field>
            </div>
            <span className="text-ink-muted caption">BRT. The end isn&apos;t included. A period that starts in the future is covered by the nightly sweep.</span>
          </div>
          {error ? <Alert tone="negative" title="Not saved">{error}</Alert> : null}
          <div className="flex gap-3">
            <Button size="mono-md" className="flex-1" disabled={busy || !draft.code.trim() || !draft.label.trim()} onClick={save}>
              {draft.id === null ? 'Create period' : 'Save period'}
            </Button>
            {draft.id !== null ? <Button variant="ghost" size="mono-md" onClick={() => setDraft(BLANK)}>Cancel</Button> : null}
          </div>
        </Panel>
      </div>

      <Dialog
        size="sm"
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={<>Delete <span className="text-ink">{deleting?.label}</span></>}
        footer={
          <>
            <Button variant="ghost" size="mono-md" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="danger" size="mono-md" onClick={remove}>Delete period</Button>
          </>
        }
      >
        <p className="text-ink-dim body">Drops the period and its global analytics. Explorations comparing it lose that segment.</p>
      </Dialog>
    </>
  )
}

export default PeriodsPage
