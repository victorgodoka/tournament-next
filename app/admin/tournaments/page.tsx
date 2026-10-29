'use client'

import { useState } from 'react'
import { Alert } from '@ui/alert'
import { Button } from '@ui/button'
import { Chip } from '@ui/chip'
import { DataTable } from '@ui/data-table'
import { Dialog } from '@ui/dialog'
import { FactGrid } from '@ui/fact-grid'
import { Icon } from '@ui/icon'
import { PageHeader } from '@ui/page-header'
import { SectionHead } from '@ui/section-head'
import { Segmented } from '@ui/choice'
import { Select } from '@ui/field'
import { StatGrid } from '@ui/stat-grid'
import { useResource } from '@hooks/index'
import { dayLabel, dayTime, daysUntil, reais, timeLabel, count } from '@utils/format'
import { deleteTournament, listTournaments, panelErrorText, unlinkOmega, type ScheduledTournament } from '@utils/panel'
import { LinkDialog } from './LinkDialog'
import { MODES, SYSTEMS_SHORT, paramFacts, poolLabel, rulesLabel } from './params'

const LIMITS = ['50', '100', '200']

const load = (all: boolean, limit: number) => (signal: AbortSignal) =>
  Promise.all([
    listTournaments({ upcoming: !all, limit }, signal),
    // What ran: everything, newest first, then only the ones that already started.
    listTournaments({ upcoming: false, limit: 200 }, signal),
  ]).then(([list, everything]) => ({ list, everything, readAt: Date.now() }))

/** Copies the server's command as-is. Never rebuilt here: the 16-argument order is the contract. */
const CopyCommand = ({ command, size = 'mono' }: { command: string; size?: 'mono' | 'mono-md' }) => {
  const [copied, setCopied] = useState(false)
  const copy = () =>
    navigator.clipboard.writeText(command).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  return (
    <Button variant="secondary" size={size} onClick={copy}>
      {size === 'mono-md' ? <Icon name="copy" size={16} /> : null}
      {copied ? 'Copied' : 'Copy command'}
    </Button>
  )
}

const TournamentsPage = () => {
  const [all, setAll] = useState(false)
  const [limit, setLimit] = useState(50)
  const [linking, setLinking] = useState<ScheduledTournament | null>(null)
  const [deleting, setDeleting] = useState<ScheduledTournament | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { data, error: loadError, reload } = useResource(`${all}:${limit}`, load(all, limit))

  const now = data?.readAt ?? 0
  const upcoming = data?.everything.filter((t) => Date.parse(t.startsAt) > now).sort((a, b) => a.startsAt.localeCompare(b.startsAt)) ?? []
  const past = data?.everything.filter((t) => Date.parse(t.startsAt) <= now) ?? []
  const next = upcoming[0]
  const waiting = past.filter((t) => t.omegaTournamentId === null)
  const broken = past.filter((t) => t.omegaTournamentId !== null && t.omega === null)

  const run = (action: Promise<unknown>) => {
    setError(null)
    action.then(reload, (e) => setError(panelErrorText(e)))
  }

  const remove = () => {
    if (!deleting) return
    const id = deleting.id
    setDeleting(null)
    run(deleteTournament(id))
  }

  return (
    <>
      <PageHeader
        flush
        eyebrow={data ? `Schedule · Read ${timeLabel(new Date(now))}` : 'Schedule'}
        title="Scheduled tournaments"
        lead="Schedule a tournament here, paste its command into the client, then link the tournament that actually ran."
        end={
          <>
            <Button href="/admin/formats" variant="secondary" size="mono-md">Formats</Button>
            <Button href="/admin/tournaments/new" size="mono-md">New tournament</Button>
          </>
        }
      />

      {loadError ? <Alert tone="negative" title="Couldn't read the schedule">{panelErrorText(loadError)}</Alert> : null}
      {error ? <Alert tone="negative" title="That didn't go through">{error}</Alert> : null}

      <StatGrid
        items={[
          { label: 'Upcoming', value: data ? upcoming.length : '—', hint: 'Scheduled, not started' },
          {
            label: 'Next start',
            value: next ? dayLabel(next.startsAt) : '—',
            hint: next ? `${timeLabel(next.startsAt)} BRT · ${next.banlistName ?? `#${next.banlistId}`}` : 'Nothing scheduled',
          },
          { label: 'Waiting for a link', value: data ? waiting.length : '—', tone: 'gold', hint: 'Ran, no Omega tournament linked' },
          { label: 'Broken links', value: data ? broken.length : '—', tone: 'negative', hint: 'Linked id missing from Omega' },
        ]}
      />

      {next ? (
        <section className="flex flex-col gap-5">
          <SectionHead compact num="01" end={`Starts in ${daysUntil(next.startsAt, now)} days`}>Next up</SectionHead>
          <div className="cut notch flex flex-col gap-6 p-5 [--cut:var(--cut-lg)] [--fill:var(--color-steel)] min-[720px]:p-7">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-ink-dim data">#{next.id}</span>
              <h3 className="display-2">
                {next.format?.name ?? next.banlistName} · {dayTime(next.startsAt)}
              </h3>
              {next.format ? <Chip>Format: {next.format.name}</Chip> : null}
              <Chip>Not linked yet</Chip>
              <span className="flex-1" />
              <Button href={`/admin/tournaments/${next.id}`} variant="ghost" size="mono">Edit</Button>
              <Button variant="ghost" size="mono" className="text-crimson-lift" onClick={() => setDeleting(next)}>Delete</Button>
            </div>
            <FactGrid tone="steel" columns={8} items={paramFacts(next)} />
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-ink-dim signal">Command</span>
                <span className="text-ink-dim signal-sm">Built by the server · paste it into the client as-is</span>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <code className="cut min-w-0 flex-1 px-4.5 py-3.5 text-sm break-all text-ink data [--fill:var(--color-space-000)]">{next.command}</code>
                <CopyCommand command={next.command} size="mono-md" />
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-5">
        <SectionHead
          compact
          num="02"
          end={
            <span className="flex items-center gap-3.5">
              <Segmented
                size="sm"
                label="Which tournaments"
                value={all ? 'all' : 'upcoming'}
                onChange={(v) => setAll(v === 'all')}
                options={[
                  { value: 'upcoming', label: 'Upcoming' },
                  { value: 'all', label: 'All' },
                ]}
              />
              <Select prefix="Limit" options={LIMITS} value={String(limit)} onChange={(e) => setLimit(Number(e.target.value))} className="h-9 w-33 min-w-0" />
            </span>
          }
        >
          {all ? 'All tournaments' : 'Upcoming'}
        </SectionHead>
        <div className="overflow-x-auto">
          <DataTable
            rows={data?.list ?? []}
            rowKey={(t) => t.id}
            empty={data ? 'Nothing scheduled.' : 'Loading…'}
            columns={[
              { key: 'id', label: 'ID', render: (t) => <span className="text-ink-muted data">#{t.id}</span> },
              {
                key: 'starts',
                label: 'Starts (BRT)',
                render: (t) => (
                  <span className="whitespace-nowrap">
                    <span className="font-bold text-ink">{dayLabel(t.startsAt)}</span> · {timeLabel(t.startsAt)}
                  </span>
                ),
              },
              { key: 'format', label: 'Format', render: (t) => t.format?.name ?? '—' },
              { key: 'banlist', label: 'Banlist', render: (t) => t.banlistName ?? `#${t.banlistId}` },
              { key: 'mode', label: 'Mode', render: (t) => MODES[t.mode] },
              { key: 'timer', label: 'Timer', render: (t) => `${t.timer} s` },
              { key: 'lp', label: 'Start LP', render: (t) => count(t.startLp) },
              { key: 'pool', label: 'Card pool', render: (t) => poolLabel(t.relFrom, t.relUntil) },
              { key: 'budget', label: 'Budget', render: (t) => <span className="text-gold">{reais(t.budgetCents)}</span> },
              { key: 'rules', label: 'Rules', render: (t) => <span className="text-ink-dim signal-sm">{rulesLabel(t)}</span> },
              { key: 'sys', label: 'System', render: (t) => SYSTEMS_SHORT[t.tournyMode] },
              {
                key: 'actions',
                label: <span className="block text-right">Actions</span>,
                render: (t) => (
                  <span className="flex justify-end gap-2">
                    <CopyCommand command={t.command} />
                    <Button href={`/admin/tournaments/${t.id}`} variant="ghost" size="mono">Edit</Button>
                  </span>
                ),
              },
            ]}
          />
        </div>
      </section>

      <section className="flex flex-col gap-5">
        <SectionHead compact num="03" end="Linking is manual: two tournaments of one format can run the same day">
          Link what ran
        </SectionHead>
        <div className="overflow-x-auto">
          <DataTable
            rows={past}
            rowKey={(t) => t.id}
            empty={data ? 'Nothing has run yet.' : 'Loading…'}
            columns={[
              { key: 'id', label: 'ID', render: (t) => <span className="text-ink-muted data">#{t.id}</span> },
              {
                key: 'when',
                label: 'Scheduled (BRT)',
                render: (t) => (
                  <span className="whitespace-nowrap">
                    <span className="font-bold text-ink">{dayLabel(t.startsAt)}</span> · {timeLabel(t.startsAt)}
                  </span>
                ),
              },
              { key: 'format', label: 'Format', render: (t) => t.format?.name ?? t.banlistName ?? '—' },
              {
                key: 'omega',
                label: 'Omega tournament',
                render: (t) =>
                  t.omegaTournamentId === null ? (
                    <Chip tone="gold">Not linked</Chip>
                  ) : (
                    <span className="inline-flex items-center gap-2.5">
                      <span className="text-ink data">#{t.omegaTournamentId}</span>
                      {t.omega ? null : <Chip tone="negative">Missing in Omega</Chip>}
                    </span>
                  ),
              },
              {
                key: 'status',
                label: 'Status',
                render: (t) => (t.omega ? (t.omega.status === 'live' ? 'Live' : 'Finished') : t.omegaTournamentId ? 'Not found' : '—'),
              },
              { key: 'players', label: 'Players', render: (t) => t.omega?.players ?? '—' },
              {
                key: 'actions',
                label: <span className="block text-right">Actions</span>,
                render: (t) => (
                  <span className="flex justify-end gap-2">
                    {t.omegaTournamentId !== null ? (
                      <Button variant="ghost" size="mono" onClick={() => run(unlinkOmega(t.id))}>Unlink</Button>
                    ) : null}
                    {t.omegaTournamentId === null || t.omega === null ? (
                      <Button variant="secondary" size="mono" onClick={() => setLinking(t)}>
                        {t.omegaTournamentId === null ? 'Link tournament' : 'Relink'}
                      </Button>
                    ) : null}
                  </span>
                ),
              },
            ]}
          />
        </div>
      </section>

      {linking ? (
        <LinkDialog
          schedule={linking}
          onClose={() => setLinking(null)}
          onLinked={() => {
            setLinking(null)
            reload()
          }}
        />
      ) : null}

      <Dialog
        size="sm"
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={<>Delete <span className="text-ink">schedule #{deleting?.id}</span></>}
        footer={
          <>
            <Button variant="ghost" size="mono-md" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="danger" size="mono-md" onClick={remove}>Delete schedule</Button>
          </>
        }
      >
        <p className="text-ink-dim body">
          Deletes the schedule, not the Omega tournament. Its command stops being listed here.
        </p>
      </Dialog>
    </>
  )
}

export default TournamentsPage
