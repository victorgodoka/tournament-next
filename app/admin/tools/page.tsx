'use client'

import { useState } from 'react'
import { Alert, Button, Chip, Field, PageHeader, Panel, SectionHead, TextInput } from '@ui/index'
import { useResource } from '@hooks/index'
import { count, dayTime, timeLabel } from '@utils/format'
import { listSeasons, panelErrorText, renameSeason, rolloverSeason, syncRanked, type PanelSeason } from '@utils/panel'
import { refreshLeaderboard } from '@utils/ranked'

type Notice = { tone: 'positive' | 'negative'; title: string; body?: string }

/** One ladder's open season: rename it, or close it and open the next behind a typed confirmation. */
const SeasonCard = ({ entry, onChanged }: { entry: PanelSeason; onChanged: () => void }) => {
  const season = entry.season
  const [code, setCode] = useState(season?.code ?? '')
  const [label, setLabel] = useState(season?.label ?? '')
  const [closing, setClosing] = useState(false)
  const [typed, setTyped] = useState('')
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busy, setBusy] = useState(false)

  const run = (request: Promise<unknown>, done: string) => {
    setBusy(true)
    setNotice(null)
    request
      .then(() => {
        setNotice({ tone: 'positive', title: done })
        setClosing(false)
        setTyped('')
        onChanged()
      })
      .catch((e) => setNotice({ tone: 'negative', title: 'That didn’t go through', body: panelErrorText(e) }))
      .finally(() => setBusy(false))
  }

  return (
    <Panel label={`${entry.format} season`} className={`flex flex-col gap-4.5 ${closing ? '[--edge:var(--color-crimson-lift)]' : '[--edge:var(--color-line-mid)]'}`}>
      <div className="flex items-center gap-3">
        <Chip tone={entry.ladder}>{entry.format}</Chip>
        <h3 className="flex-1 display-3">{season?.label ?? 'No open season'}</h3>
        {season ? <span className="text-ink-muted data">{season.code}</span> : null}
      </div>
      {season ? (
        <>
          <span className="text-ink-muted caption">
            Opened {dayTime(season.startsAt)} · {count(season.standings)} duelists in the snapshot
            {season.syncedAt ? ` · synced ${dayTime(season.syncedAt)}` : ''}
          </span>
          {closing ? (
            <div className="flex flex-col gap-3 bg-surface-200 p-4">
              <span className="body-strong">
                Close {entry.format} {season.label} and open the next one?
              </span>
              <span className="text-ink-dim body-sm">The ladder rolls over for everyone. There&apos;s no undo from the panel.</span>
              <Field label={`Type ${season.code} to confirm`} htmlFor={`confirm-${entry.ladder}`}>
                <TextInput id={`confirm-${entry.ladder}`} mono warn value={typed} onChange={(e) => setTyped(e.target.value)} plateClassName="[--edge:var(--color-crimson-lift)]" />
              </Field>
              <div className="flex justify-end gap-3">
                <Button variant="ghost" size="mono" onClick={() => setClosing(false)}>Cancel</Button>
                <Button
                  variant="danger"
                  size="mono"
                  disabled={busy || typed !== season.code}
                  onClick={() => run(rolloverSeason({ ladder: entry.ladder, season: season.ordinal }), `${entry.format} rolled over`)}
                >
                  Close season
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-3">
                <Field label="Code" htmlFor={`code-${entry.ladder}`}>
                  <TextInput id={`code-${entry.ladder}`} mono value={code} onChange={(e) => setCode(e.target.value)} />
                </Field>
                <Field label="Label" htmlFor={`label-${entry.ladder}`}>
                  <TextInput id={`label-${entry.ladder}`} value={label} onChange={(e) => setLabel(e.target.value)} />
                </Field>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  size="mono"
                  disabled={busy || (code === season.code && label === season.label)}
                  onClick={() =>
                    run(
                      renameSeason(season.code, { ...(code !== season.code ? { code } : {}), ...(label !== season.label ? { label } : {}) }),
                      'Season renamed',
                    )
                  }
                >
                  Rename
                </Button>
                <span className="flex-1" />
                <Button variant="danger-outline" size="mono" onClick={() => setClosing(true)}>Close and open next</Button>
              </div>
            </>
          )}
        </>
      ) : null}
      {notice ? <Alert tone={notice.tone} title={notice.title}>{notice.body}</Alert> : null}
    </Panel>
  )
}

const ToolsPage = () => {
  const seasons = useResource('ranked-seasons', listSeasons)
  const [job, setJob] = useState<Notice | null>(null)
  const [busy, setBusy] = useState<'sync' | 'refresh' | null>(null)

  const runJob = (which: 'sync' | 'refresh') => {
    setBusy(which)
    setJob(null)
    const request =
      which === 'sync'
        ? syncRanked().then((r) =>
            r.status === 'busy'
              ? { tone: 'negative' as const, title: 'Already running', body: 'Another update holds the lock. Try again when it ends.' }
              : { tone: 'positive' as const, title: `Ranked data updated for ${r.day}`, body: `${count(r.duelists)} duelists · ${count(r.standings)} standings · ${(r.ms / 1000).toFixed(1)} s` },
          )
        : refreshLeaderboard().then((r) => ({ tone: 'positive' as const, title: `Leaderboard rebuilt at ${timeLabel(r.readAt)}`, body: `${count(r.tcg)} TCG · ${count(r.genesys)} Genesys` }))
    request
      .then(setJob)
      .catch((e) => setJob({ tone: 'negative', title: 'That didn’t go through', body: panelErrorText(e) }))
      .finally(() => setBusy(null))
  }

  return (
    <>
      <PageHeader
        flush
        eyebrow="Other tools"
        title="Ranked"
        lead="Run the ranked jobs by hand and manage the open season of each ladder."
      />

      <section className="flex flex-col gap-5">
        <SectionHead compact num="01" end="The nightly job runs at 01:00">Ranked data</SectionHead>
        <div className="grid grid-cols-1 gap-px bg-line min-[720px]:grid-cols-2">
          <div className="flex items-center gap-5 bg-surface-100 px-6 py-5.5">
            <div className="flex flex-1 flex-col gap-1.5">
              <span className="text-base font-bold">Update ranked data</span>
              <span className="text-ink-dim body-sm">Does now what the nightly job does.</span>
            </div>
            <Button variant="secondary" size="mono-md" disabled={busy !== null} onClick={() => runJob('sync')}>
              {busy === 'sync' ? 'Running…' : 'Run update'}
            </Button>
          </div>
          <div className="flex items-center gap-5 bg-surface-100 px-6 py-5.5">
            <div className="flex flex-1 flex-col gap-1.5">
              <span className="text-base font-bold">Refresh the leaderboard</span>
              <span className="text-ink-dim body-sm">Rebuilds the cached board now instead of at the next 30-minute read.</span>
            </div>
            <Button variant="secondary" size="mono-md" disabled={busy !== null} onClick={() => runJob('refresh')}>
              {busy === 'refresh' ? 'Refreshing…' : 'Refresh now'}
            </Button>
          </div>
        </div>
        {job ? <Alert tone={job.tone} title={job.title}>{job.body}</Alert> : null}
      </section>

      <section className="flex flex-col gap-5">
        <SectionHead compact num="02" end="One per ladder">Open seasons</SectionHead>
        {seasons.error ? <Alert tone="negative" title="Couldn't read the seasons">{panelErrorText(seasons.error)}</Alert> : null}
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
          {(seasons.data ?? []).map((entry) => (
            <SeasonCard key={`${entry.ladder}:${entry.season?.code}`} entry={entry} onChanged={seasons.reload} />
          ))}
        </div>
      </section>
    </>
  )
}

export default ToolsPage
