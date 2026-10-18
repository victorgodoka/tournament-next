'use client'

import { useEffect, useState } from 'react'
import { Alert, Button, Chip, DataTable, FactGrid, Field, PageHeader, Panel, SectionHead, Segmented, Select, TextInput } from '@ui/index'
import { useResource } from '@hooks/index'
import { RulesRebuildNotice } from '@omega/analytics/rules-rebuild-notice'
import { count, dayTime, timeLabel } from '@utils/format'
import { getAnalyticsSweep, listSeasons, listStatisticsSeasons, panelErrorText, startAnalyticsSweep, syncPlayerAnalytics, type AnalyticsSweep } from '@utils/panel'
import { LADDERS } from '@utils/ranked'
import type { RankedLadderId } from '@utils/types'

const SNOWFLAKE = /^\d{15,20}$/
const POLL_MS = 5000

const daysIn = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1
const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`
const FORMATS = [{ value: '' as const, label: 'Both' }, ...LADDERS.map((l) => ({ value: l.id, label: l.format }))]
/** `null` (or an older server that doesn't say) = both formats. */
const formatName = (ladder: RankedLadderId | null) => LADDERS.find((l) => l.id === ladder)?.format ?? 'Both formats'
/**
 * ponytail: days cut in UTC, the job's zone isn't known here. Yesterday in UTC is never past
 * the job's today; a season opening late at night may sweep one extra day before it, which is harmless.
 */
const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10)

const DoneTable = ({ run }: { run: AnalyticsSweep }) => (
  <div className="overflow-x-auto">
    <DataTable
      rows={run.done}
      rowKey={(d) => d.day}
      empty="No day finished yet."
      columns={[
        { key: 'day', label: 'Day', render: (d) => <span className="text-ink data">{d.day}</span> },
        { key: 'matches', label: 'Ranked matches', numeric: true, render: (d) => <span className="data">{count(d.matches)}</span> },
        { key: 'rows', label: 'Rows written', numeric: true, render: (d) => <span className="data">{count(d.rows)}</span> },
        { key: 'ms', label: 'Took', numeric: true, render: (d) => <span className="data">{seconds(d.ms)}</span> },
      ]}
    />
  </div>
)

const SweepPage = () => {
  const sweep = useResource('sweep', getAnalyticsSweep)
  const seasons = useResource('ranked-seasons', listSeasons)
  const statSeasons = useResource('statistics-seasons', listStatisticsSeasons)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [ladder, setLadder] = useState<RankedLadderId | ''>('')
  const [startError, setStartError] = useState<string | null>(null)
  const [player, setPlayer] = useState('')
  const [season, setSeason] = useState('')
  const [result, setResult] = useState<Awaited<ReturnType<typeof syncPlayerAnalytics>> | null>(null)
  const [playerError, setPlayerError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [rebuild, setRebuild] = useState('')

  const running = sweep.data?.running ?? null
  const last = sweep.data?.last ?? null
  const reloadSweep = sweep.reload
  const reloadStatSeasons = statSeasons.reload
  const sweeping = running !== null

  // Poll while a sweep runs; stop as soon as it's idle. A sweep's end may freeze a closed season: read the list again.
  useEffect(() => {
    if (!sweeping) return
    const timer = setInterval(reloadSweep, POLL_MS)
    return () => {
      clearInterval(timer)
      reloadStatSeasons()
    }
  }, [sweeping, reloadSweep, reloadStatSeasons])

  const start = (range: Parameters<typeof startAnalyticsSweep>[0]) => {
    setStartError(null)
    startAnalyticsSweep(range).then(reloadSweep, (e) => setStartError(panelErrorText(e)))
  }

  const recompute = () => {
    setBusy(true)
    setPlayerError(null)
    setResult(null)
    syncPlayerAnalytics(player.trim(), season || undefined)
      .then(setResult)
      .catch((e) => setPlayerError(panelErrorText(e)))
      .finally(() => setBusy(false))
  }

  const total = running ? daysIn(running.from, running.to) : 0
  // Frozen seasons are final: only open ones and closed ones still live can be rebuilt.
  const rebuildable = (statSeasons.data ?? []).filter((s) => !s.frozenAt)
  const toRebuild = rebuildable.find((s) => s.code === rebuild) ?? rebuildable[0]
  const rebuildSeason = (now: number) => {
    if (!toRebuild) return
    const yesterday = utcDay(now - 86_400_000)
    const last = toRebuild.lastDay && toRebuild.lastDay < yesterday ? toRebuild.lastDay : yesterday
    start({ from: utcDay(Date.parse(toRebuild.startsAt)), to: last, ladder: toRebuild.ladder })
  }

  return (
    <>
      <PageHeader
        flush
        eyebrow="Analytics · Nightly at 01:00 for the day before"
        title="Season sweep"
        lead="Season analytics are worked out once a day. Force the sweep here for a range of days, or recompute one duelist right now."
      />
      {sweep.error ? <Alert tone="negative" title="Couldn't read the sweep">{panelErrorText(sweep.error)}</Alert> : null}
      {/* The run panel below already follows a running sweep. */}
      {running ? null : <RulesRebuildNotice />}

      {running ? (
        <section aria-labelledby="sweep-run" className="cut notch flex flex-col gap-5.5 p-5 [--cut:var(--cut-lg)] [--fill:var(--color-steel)] min-[720px]:p-7">
          <div className="flex flex-wrap items-center gap-3.5">
            <span aria-hidden className="size-2 rounded-round bg-cyan shadow-glow-live motion-safe:animate-blink" />
            <h2 id="sweep-run" className="flex-1 display-2">Sweeping {running.current ?? running.from}</h2>
            <span className="text-ink-dim signal-sm">Started {timeLabel(running.startedAt)} · checking every 5 s</span>
          </div>
          <div className="flex flex-col gap-2.5">
            <div className="flex items-baseline gap-3">
              <span className="text-ink data">{running.from} → {running.to} · {formatName(running.ladder)}</span>
              <span className="flex-1" />
              <span className="stat">{running.done.length}</span>
              <span className="text-ink-dim signal-sm">of {total} days done</span>
            </div>
            <div role="progressbar" aria-label="Sweep progress" aria-valuemin={0} aria-valuemax={total} aria-valuenow={running.done.length} className="h-2.5 overflow-hidden rounded-xs bg-surface-100">
              <div className="h-full rounded-xs bg-cyan" style={{ width: `${(running.done.length / Math.max(total, 1)) * 100}%` }} />
            </div>
          </div>
          <DoneTable run={running} />
          <span className="text-ink-dim caption">One row per duelist and season that played ranked that day. Duelists who didn&apos;t play are skipped.</span>
        </section>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Panel label="Every duelist" className="flex flex-col gap-4.5 [--edge:var(--color-line-mid)]">
            <SectionHead compact num="01">Every duelist</SectionHead>
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-3">
                <Field label="From" htmlFor="sw-from">
                  <TextInput id="sw-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                </Field>
                <Field label="To" htmlFor="sw-to">
                  <TextInput id="sw-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                </Field>
              </div>
              <span className="text-ink-muted caption">
                Days in the ranked job&apos;s time zone. Leave both empty for yesterday, only From for that one day. Up to 366 days, ending today at the latest.
                Each day is rewritten whole.
              </span>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-3.5">
                <span className="text-ink-muted signal">Format</span>
                <Segmented label="Format" value={ladder} onChange={setLadder} options={FORMATS} />
              </div>
              <span className="text-ink-muted caption">One format rewrites only its own seasons and periods; the other keeps what it had.</span>
            </div>
            <div className="flex flex-wrap items-center gap-3.5">
              <Button size="mono-md" disabled={running !== null} onClick={() => start({ from: from || undefined, to: to || undefined, ladder: ladder || undefined })}>
                Start sweep
              </Button>
              {running ? <span className="text-[13px] leading-5 text-gold">A sweep is already running. Start another when it ends.</span> : null}
            </div>
            {startError ? <Alert tone="negative" title="Not started">{startError}</Alert> : null}
            <Alert plain title="First deploy?">The table starts empty. Run it once from the open season’s start to yesterday.</Alert>
          </Panel>

          <Panel label="Rebuild a season" className="flex flex-col gap-4.5 [--edge:var(--color-line-mid)]">
            <SectionHead compact num="03">Rebuild a season</SectionHead>
            <p className="text-sm leading-5.5 text-ink-dim">
              Sweeps a season from its first day to its last (yesterday, while open), in its format only. Run it after changing archetypes, series or card groups:
              swept days keep the archetypes they were sorted with until they are swept again. /statistics shows the new numbers when it ends.
            </p>
            {statSeasons.error ? <Alert tone="negative" title="Couldn't read the seasons">{panelErrorText(statSeasons.error)}</Alert> : null}
            <Field label="Season">
              <Select
                block
                aria-label="Season to rebuild"
                value={toRebuild?.code ?? ''}
                onChange={(e) => setRebuild(e.target.value)}
                options={rebuildable.map((s) => ({
                  value: s.code,
                  label: `${s.code} · ${s.label} · ${s.lastDay ? `closed, freezes after this rebuild` : `open since ${utcDay(Date.parse(s.startsAt))}`}`,
                }))}
              />
            </Field>
            <div>
              <Button size="mono-md" disabled={running !== null || !toRebuild} onClick={() => rebuildSeason(Date.now())}>
                Rebuild season
              </Button>
            </div>
            <Alert plain title="Closed seasons freeze">
              A closed season&apos;s /statistics is fixed for good once a sweep covers its last day, and it leaves this list.
              To unfreeze one, a developer deletes its row in statistics_snapshots.
            </Alert>
          </Panel>

          {last && !running ? (
            <Panel
              label="Last run"
              className={`flex flex-col gap-3 ${last.error ? '[--edge:var(--color-crimson-lift)] [--fill:var(--color-surface-200)]' : '[--edge:var(--color-line-mid)]'}`}
            >
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
                      <Button variant="secondary" size="mono" onClick={() => start({ from: last.current!, to: last.to, ladder: last.ladder ?? undefined })}>Re-run from {last.current}</Button>
                    </div>
                  ) : null}
                </>
              ) : (
                <DoneTable run={last} />
              )}
            </Panel>
          ) : null}
        </div>

        <Panel label="One duelist, now" className="flex flex-col gap-4.5 [--edge:var(--color-line-mid)]">
          <SectionHead compact num="02">One duelist, now</SectionHead>
          <p className="text-sm leading-5.5 text-ink-dim">Recomputes the whole season for one duelist, today included, and waits for the result.</p>
          <Field label="Duelist ID" htmlFor="sw-player">
            <TextInput id="sw-player" mono value={player} onChange={(e) => setPlayer(e.target.value)} />
          </Field>
          <Field label="Season">
            <Select
              block
              aria-label="Season"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              options={[
                { value: '', label: 'Every open season' },
                ...(seasons.data ?? []).flatMap((s) => (s.season ? [{ value: s.season.code, label: `${s.season.code} · ${s.format} ${s.season.label}` }] : [])),
              ]}
            />
          </Field>
          <div>
            <Button variant="secondary" size="mono-md" disabled={busy || !SNOWFLAKE.test(player.trim())} onClick={recompute}>
              {busy ? 'Recomputing…' : 'Recompute'}
            </Button>
          </div>
          {playerError ? <Alert tone="negative" title="Not recomputed">{playerError}</Alert> : null}
          {result ? (
            <div className="flex flex-col gap-2.5 pt-1">
              <div className="flex items-center gap-2.5">
                <span className="flex-1 text-ink-muted signal">Result</span>
                <span className="text-ink-muted signal-sm">Took {seconds(result.ms)}</span>
              </div>
              {result.seasons.map((s) => (
                <FactGrid
                  key={s.code}
                  columns={3}
                  items={[
                    { label: 'Season', value: <span className="data">{s.code}</span> },
                    { label: 'Matches', value: count(s.matches) },
                    { label: 'Days', value: count(s.days) },
                  ]}
                />
              ))}
              <span className="text-ink-muted caption">A duelist with no matches comes back with 0 and whatever was stored is cleared.</span>
            </div>
          ) : null}
        </Panel>
      </div>
    </>
  )
}

export default SweepPage
