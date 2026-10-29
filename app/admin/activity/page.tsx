'use client'

import { useState } from 'react'
import { Alert } from '@ui/alert'
import { Button } from '@ui/button'
import { Chip, type ChipTone } from '@ui/chip'
import { DataTable } from '@ui/data-table'
import { Field, Select, TextInput } from '@ui/field'
import { PageHeader } from '@ui/page-header'
import { Panel } from '@ui/panel'
import { Segmented } from '@ui/choice'
import { useResource } from '@hooks/index'
import { dayLabel, timeLabel } from '@utils/format'
import { getAuditEntry, listAudit, listAuditActions, panelErrorText, type AuditEntry, type AuditOutcome, type AuditQuery } from '@utils/panel'

const OUTCOME: Record<AuditOutcome, { label: string; tone: ChipTone }> = {
  success: { label: 'Success', tone: 'positive' },
  rejected: { label: 'Rejected', tone: 'gold' },
  denied: { label: 'Denied', tone: 'indigo' },
  error: { label: 'Error', tone: 'negative' },
}

const ROLE: Record<string, string> = { ADMIN: 'Admin', EDITOR: 'Editor', ANALYST: 'Analyst', USER: 'Duelist' }

const SNOWFLAKE = /^\d{15,20}$/
const short = (id: string) => (id.length > 12 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id)

/** `body` is what someone with an admin session sent: shown as text, never as HTML. */
const bodyText = (body: unknown) => {
  if (body === null || body === undefined) return 'No body.'
  if (typeof body === 'string') return body
  const big = body as { truncated?: boolean; bytes?: number; sha256?: string }
  if (big.truncated) return `Too large to keep (${big.bytes} bytes). SHA-256 ${big.sha256}`
  return JSON.stringify(body, null, 2)
}

type Page = { entries: AuditEntry[]; nextCursor: string | null }

const ActivityPage = () => {
  const [actor, setActor] = useState('')
  const [action, setAction] = useState('')
  const [target, setTarget] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [outcome, setOutcome] = useState<'all' | AuditOutcome>('all')
  const [picked, setPicked] = useState<string | null>(null)
  const [more, setMore] = useState<{ key: string; pages: Page[] } | null>(null)

  const actions = useResource('audit-actions', listAuditActions)
  const query: AuditQuery = {
    actor: SNOWFLAKE.test(actor.trim()) ? actor.trim() : undefined,
    action: action || undefined,
    target: target.trim() || undefined,
    from: from ? `${from}T00:00:00-03:00` : undefined,
    to: to ? `${to}T00:00:00-03:00` : undefined,
    outcome: outcome === 'all' ? undefined : outcome,
  }
  const key = JSON.stringify(query)
  const first = useResource(key, (signal) => listAudit(query, signal).then((page) => ({ ...page, readAt: Date.now() })))
  const detail = useResource(picked, (signal) => getAuditEntry(picked!, signal))

  const extra = more?.key === key ? more.pages : []
  const entries = [...(first.data?.entries ?? []), ...extra.flatMap((p) => p.entries)]
  const cursor = extra.length ? extra.at(-1)!.nextCursor : (first.data?.nextCursor ?? null)

  const loadMore = () => {
    if (!cursor) return
    listAudit({ ...query, cursor }).then(
      (page) => setMore({ key, pages: [...extra, page] }),
      () => undefined,
    )
  }

  // Actions grouped by their first two segments, which the API accepts as a prefix.
  const prefixes = [...new Set((actions.data ?? []).map((a) => a.action.split('.').slice(0, 2).join('.')))]
  const actionOptions = [
    { value: '', label: 'Any action' },
    ...prefixes.flatMap((prefix) => [
      { value: prefix, label: `${prefix}.*` },
      ...(actions.data ?? []).filter((a) => a.action.startsWith(`${prefix}.`)).map((a) => ({ value: a.action, label: `  ${a.action}` })),
    ]),
  ]

  const e = detail.data

  return (
    <>
      <PageHeader
        flush
        eyebrow={first.data ? `Staff · Read ${timeLabel(new Date(first.data.readAt))} · newest first` : 'Staff'}
        title="Activity log"
        lead="Every admin change, recorded by the server with who made it, what was sent and how it ended. Refused and failed attempts too."
      />

      <div className="grid grid-cols-1 items-end gap-3 min-[720px]:grid-cols-3 xl:grid-cols-[1fr_1.2fr_1fr_0.8fr_0.8fr]">
        <Field label="Who" htmlFor="au-actor">
          <TextInput id="au-actor" mono placeholder="Duelist ID" value={actor} onChange={(ev) => setActor(ev.target.value)} />
        </Field>
        <Field label="Action">
          <Select block aria-label="Action" value={action} onChange={(ev) => setAction(ev.target.value)} options={actionOptions} />
        </Field>
        <Field label="Target" htmlFor="au-target">
          <TextInput id="au-target" placeholder="ID, code or name" value={target} onChange={(ev) => setTarget(ev.target.value)} />
        </Field>
        <Field label="From" htmlFor="au-from">
          <TextInput id="au-from" type="date" value={from} onChange={(ev) => setFrom(ev.target.value)} />
        </Field>
        <Field label="To" htmlFor="au-to">
          <TextInput id="au-to" type="date" value={to} onChange={(ev) => setTo(ev.target.value)} />
        </Field>
        <div className="flex flex-wrap items-center gap-3.5 min-[720px]:col-span-full">
          <span className="text-ink-muted signal">Outcome</span>
          <Segmented
            label="Outcome"
            value={outcome}
            onChange={setOutcome}
            options={[
              { value: 'all', label: 'All' },
              { value: 'success', label: 'Success' },
              { value: 'rejected', label: 'Rejected' },
              { value: 'denied', label: 'Denied' },
              { value: 'error', label: 'Error' },
            ]}
          />
        </div>
      </div>

      {first.error ? <Alert tone="negative" title="Couldn't read the log">{panelErrorText(first.error)}</Alert> : null}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="overflow-x-auto">
            <DataTable
              rows={entries}
              rowKey={(r) => r.id}
              isSelected={(r) => r.id === picked}
              empty={first.data ? 'Nothing matches these filters.' : 'Loading…'}
              columns={[
                {
                  key: 'when',
                  label: 'When',
                  render: (r) => (
                    <button type="button" onClick={() => setPicked(r.id)} className="cursor-pointer text-left whitespace-nowrap hover:text-cyan">
                      <span className="font-bold text-ink">{dayLabel(r.at)}</span> · {timeLabel(r.at)}
                    </button>
                  ),
                },
                {
                  key: 'who',
                  label: 'Who',
                  render: (r) => (
                    <span className="flex flex-col">
                      <span className="text-ink">{r.actor.username ?? short(r.actor.id)}</span>
                      <span className="text-ink-muted signal-sm">{ROLE[r.actor.role] ?? r.actor.role}</span>
                    </span>
                  ),
                },
                { key: 'action', label: 'Action', render: (r) => <span className="text-ink data">{r.action}</span> },
                { key: 'target', label: 'Target', render: (r) => <span className="data">{r.target ? short(r.target) : '—'}</span> },
                { key: 'status', label: 'Status', numeric: true, render: (r) => <span className="data">{r.status}</span> },
                { key: 'outcome', label: 'Outcome', render: (r) => <Chip tone={OUTCOME[r.outcome].tone}>{OUTCOME[r.outcome].label}</Chip> },
              ]}
            />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {cursor ? <Button variant="secondary" size="mono-md" onClick={loadMore}>Load more</Button> : null}
            <span className="text-ink-muted caption">The log keeps what was sent, not the value before. An object&apos;s history is its entries read in order.</span>
          </div>
        </div>

        {picked ? (
          <Panel label="Entry" className="flex flex-col gap-4.5 [--edge:var(--color-line-mid)]">
            {e ? (
              <>
                <div className="flex flex-col gap-1.5">
                  <span className="text-ink-muted data">Entry #{e.id}</span>
                  <h2 className="display-3 break-all">{e.action}</h2>
                </div>
                <Chip tone={OUTCOME[e.outcome].tone} className="self-start">
                  {OUTCOME[e.outcome].label} · {e.status}
                  {e.error ? ` · ${e.error}` : ''}
                </Chip>
                <dl className="flex flex-col">
                  {[
                    ['When', `${dayLabel(e.at)} · ${timeLabel(e.at, true)}`],
                    ['Who', `${e.actor.username ?? e.actor.id} · ${ROLE[e.actor.role] ?? e.actor.role}`],
                    ['Route', `${e.method} ${e.route}`],
                    ['Target', e.target ?? '—'],
                    ['Took', `${e.durationMs} ms`],
                  ].map(([label, value]) => (
                    <div key={label} className="grid grid-cols-[90px_minmax(0,1fr)] items-baseline gap-3 border-t border-line py-2.25">
                      <dt className="text-ink-muted signal-sm">{label}</dt>
                      <dd className={label === 'Route' || label === 'Target' ? 'text-ink data break-all' : 'text-sm'}>{value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="flex flex-col gap-2">
                  <span className="text-ink-muted signal-sm">Body sent</span>
                  <pre className="max-h-80 overflow-auto border border-line bg-space-000 px-4 py-3.5 whitespace-pre-wrap text-ink data">{bodyText(e.body)}</pre>
                </div>
                {e.target ? (
                  <Button
                    variant="ghost"
                    size="mono"
                    className="self-start"
                    onClick={() => {
                      setTarget(e.target ?? '')
                      setAction(e.action.split('.').slice(0, 2).join('.'))
                    }}
                  >
                    Filter by this target
                  </Button>
                ) : null}
              </>
            ) : detail.error ? (
              <Alert tone="negative" title="Couldn't read the entry">{panelErrorText(detail.error)}</Alert>
            ) : (
              <p className="text-ink-muted body-sm">Loading…</p>
            )}
          </Panel>
        ) : null}
      </div>
    </>
  )
}

export default ActivityPage
