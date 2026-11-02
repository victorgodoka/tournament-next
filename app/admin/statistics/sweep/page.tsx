'use client'

import { useEffect, useState } from 'react'
import { Alert } from '@ui/alert'
import { Button } from '@ui/button'
import { Chip } from '@ui/chip'
import { DataTable } from '@ui/data-table'
import { Field, TextInput } from '@ui/field'
import { PageHeader } from '@ui/page-header'
import { Panel } from '@ui/panel'
import { SectionHead } from '@ui/section-head'
import { Segmented } from '@ui/choice'
import { useResource } from '@hooks/index'
import { count, dayTime, timeLabel } from '@utils/format'
import { getAnalyticsSync, panelErrorText, rebuildOpenSeasons, startAnalyticsSync, type AnalyticsRun, type Dispatch } from '@utils/panel'
import { LADDERS } from '@utils/ranked'
import type { RankedLadderId } from '@utils/types'

const POLL_MS = 5000
/** A dispatched runner takes 1-2 minutes to show up in `running`. */
const WATCH_MS = 5 * 60_000

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`
const FORMATS = [{ value: '' as const, label: 'Both' }, ...LADDERS.map((l) => ({ value: l.id, label: l.format }))]
const formatName = (ladder: RankedLadderId | null) => LADDERS.find((l) => l.id === ladder)?.format ?? 'Both formats'

const DoneTable = ({ run }: { run: AnalyticsRun }) => (
  <div className="overflow-x-auto">
    <DataTable
      rows={run.done}
      rowKey={(d) => d.day}
      empty="No day finished."
      columns={[
        { key: 'day', label: 'Day', render: (d) => <span className="text-ink data">{d.day}</span> },
        { key: 'matches', label: 'Ranked matches', numeric: true, render: (d) => <span className="data">{count(d.matches)}</span> },
        { key: 'rows', label: 'Rows written', numeric: true, render: (d) => <span className="data">{count(d.rows)}</span> },
        { key: 'ms', label: 'Took', numeric: true, render: (d) => <span className="data">{seconds(d.ms)}</span> },
      ]}
    />
  </div>
)

const JobPage = () => {
  const sync = useResource('sync', getAnalyticsSync)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [ladder, setLadder] = useState<RankedLadderId | ''>('')
  const [notice, setNotice] = useState<{ status: Dispatch; from: string; to: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [watching, setWatching] = useState(false)

  const running = sync.data?.running ?? null
  const last = sync.data?.last ?? null
  const reload = sync.reload
  const live = running !== null || watching

  useEffect(() => {
    if (!live) return
    const timer = setInterval(reload, POLL_MS)
    return () => clearInterval(timer)
  }, [live, reload])

  useEffect(() => {
    if (!watching) return
    const timer = setTimeout(() => setWatching(false), WATCH_MS)
    return () => clearTimeout(timer)
  }, [watching])

  const start = (request: Promise<{ status: Dispatch; from: string; to: string }>) => {
    setError(null)
    setNotice(null)
    request.then(
      (answer) => {
        setNotice(answer)
        if (answer.status === 'dispatched') setWatching(true)
      },
      (e) => setError(panelErrorText(e)),
    )
  }

  return (
    <>
      <PageHeader
        flush
        eyebrow="Statistics · Nightly at 01:00 for the day before"
        title="Statistics job"
        lead="A GitHub Actions job sweeps the ranked games and refits the answers /statistics reads. Dispatch it here for a range of days, or to rebuild the open seasons."
      />
      {sync.error ? <Alert tone="negative" title="Couldn't read the job">{panelErrorText(sync.error)}</Alert> : null}
      {error ? <Alert tone="negative" title="Not started">{error}</Alert> : null}
      {notice?.status === 'dispatched' ? (
        <Alert tone="positive" title={`Dispatched ${notice.from} → ${notice.to}`}>The runner takes 1 to 2 minutes to start; runs queue one at a time.</Alert>
      ) : null}
      {notice?.status === 'unavailable' ? (
        <Alert tone="negative" title="Nothing started">The API has no dispatch token, so only the nightly run covers yesterday.</Alert>
      ) : null}

      {running ? (
        <section aria-labelledby="job-run" className="cut notch flex flex-col gap-3 p-5 [--cut:var(--cut-lg)] [--fill:var(--color-steel)] min-[720px]:p-7">
          <div className="flex flex-wrap items-center gap-3.5">
            <span aria-hidden className="size-2 rounded-round bg-cyan shadow-glow-live motion-safe:animate-blink" />
            <h2 id="job-run" className="flex-1 display-2">Running</h2>
            <span className="text-ink-dim signal-sm">Started {timeLabel(running.startedAt)} · checking every 5 s</span>
          </div>
          <span className="text-ink data">{running.from} → {running.to} · {formatName(running.ladder)}</span>
          <span className="text-ink-dim caption">The job reports when it starts and when it ends, so nothing moves here mid-run.</span>
        </section>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        <Panel label="A range of days" className="flex flex-col gap-4.5 [--edge:var(--color-line-mid)]">
          <SectionHead compact num="01">A range of days</SectionHead>
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-3">
              <Field label="From" htmlFor="job-from">
                <TextInput id="job-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </Field>
              <Field label="To" htmlFor="job-to">
                <TextInput id="job-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </Field>
            </div>
            <span className="text-ink-muted caption">
              Days in the ranked job&apos;s time zone. Leave both empty for yesterday, only From for that one day. Up to 366 days, ending today at the latest. Each day is rewritten whole.
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3.5">
              <span className="text-ink-muted signal">Format</span>
              <Segmented label="Format" value={ladder} onChange={setLadder} options={FORMATS} />
            </div>
            <span className="text-ink-muted caption">One format rewrites only its own games; the other keeps what it had.</span>
          </div>
          <div>
            <Button size="mono-md" onClick={() => start(startAnalyticsSync({ from: from || undefined, to: to || undefined, ladder: ladder || undefined }))}>Dispatch job</Button>
          </div>
          <Alert plain title="Backfilling a season">Dispatch once per season: From its first day, To its last (yesterday for the open one).</Alert>
        </Panel>

        <Panel label="Rebuild the open seasons" className="flex flex-col gap-4.5 [--edge:var(--color-line-mid)]">
          <SectionHead compact num="02">Rebuild the open seasons</SectionHead>
          <p className="text-sm leading-5.5 text-ink-dim">Sweeps every open season from its first day to yesterday, both formats. A closed season is only refitted when a range covers its last day.</p>
          <div>
            <Button variant="secondary" size="mono-md" onClick={() => start(rebuildOpenSeasons())}>Rebuild open seasons</Button>
          </div>
        </Panel>
      </div>

      {last && !running ? (
        <Panel label="Last run" className={`flex flex-col gap-3 ${last.error ? '[--edge:var(--color-crimson-lift)] [--fill:var(--color-surface-200)]' : '[--edge:var(--color-line-mid)]'}`}>
          <div className="flex items-center gap-2.5">
            <Chip tone={last.error ? 'negative' : 'positive'}>{last.error ? 'Last run stopped' : 'Last run finished'}</Chip>
            <h2 className="flex-1 text-ink-dim signal">{dayTime(last.startedAt)}</h2>
          </div>
          <span className="text-sm leading-5.5">
            {last.from} → {last.to} · {formatName(last.ladder)}
            {last.error
              ? ` stopped on ${last.current ?? '?'} after ${last.done.length} days.`
              : ` · ${last.done.length} days in ${last.finishedAt ? seconds(Date.parse(last.finishedAt) - Date.parse(last.startedAt)) : '?'}.`}
          </span>
          {last.error ? (
            <>
              <pre className="border border-line bg-space-000 px-3.5 py-3 whitespace-pre-wrap text-loss data">{last.error}</pre>
              {last.current ? (
                <div>
                  <Button variant="secondary" size="mono" onClick={() => start(startAnalyticsSync({ from: last.current!, to: last.to, ladder: last.ladder ?? undefined }))}>Re-run from {last.current}</Button>
                </div>
              ) : null}
            </>
          ) : (
            <DoneTable run={last} />
          )}
        </Panel>
      ) : null}
    </>
  )
}

export default JobPage
