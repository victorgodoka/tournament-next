'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@ui/button'
import { Chip, type ChipTone } from '@ui/chip'
import { useResource } from '@hooks/index'
import { dayLabel, dayTime, timeLabel } from '@utils/format'
import { buildOpenSeasons, getAnalyticsSync, listAudit, listDecks, listSeasons, listTournaments, panelErrorText, type AuditOutcome, type IdentifiedDeck } from '@utils/panel'
import { count, Cover, Failure, Head, hex, kindLabel, Rail } from './shared'

const OUTCOME: Record<AuditOutcome, { label: string; tone: ChipTone }> = {
  success: { label: 'Success', tone: 'positive' },
  rejected: { label: 'Rejected', tone: 'amber' },
  denied: { label: 'Denied', tone: 'negative' },
  error: { label: 'Error', tone: 'negative' },
}
const SITE = [
  ['Statistics', '/statistics'],
  ['Tournaments', '/tournaments'],
  ['Leaderboard', '/leaderboard'],
  ['Wiki', '/wiki'],
] as const
const seconds = (ms: number) => (ms >= 60_000 ? `${Math.round(ms / 60_000)} min` : `${Math.round(ms / 1000)} s`)

/** What there is to decide on a deck, in words. */
const what = (d: IdentifiedDeck) =>
  [d.variations.candidates ? `${d.variations.candidates} candidate ${d.variations.candidates === 1 ? 'variation' : 'variations'}` : null, d.cover?.pinned ? null : 'no cover pinned'].filter(Boolean).join(' · ')

/** Every block reads on its own and fails on its own. */
const OverviewPage = () => {
  const decks = useResource('decks::', (signal) => listDecks({}, signal).then((list) => ({ ...list, readAt: Date.now() })))
  const audit = useResource('audit-latest', (signal) => listAudit({ limit: 5 }, signal))
  const sync = useResource('analytics-sync', getAnalyticsSync)
  const seasons = useResource('ranked-seasons', listSeasons)
  const tournaments = useResource('tournaments-all', (signal) => listTournaments({ limit: 200 }, signal).then((all) => ({ all, at: Date.now() })))
  const [dispatch, setDispatch] = useState<{ ok: boolean; text: string } | null>(null)

  const review = (decks.data?.decks ?? []).filter((d) => d.review && d.ignore !== 'full')
  const candidates = review.reduce((n, d) => n + d.variations.candidates, 0)
  const at = tournaments.data?.at ?? 0
  const upcoming = (tournaments.data?.all ?? []).filter((t) => Date.parse(t.startsAt) > at)
  const waiting = (tournaments.data?.all ?? []).filter((t) => Date.parse(t.startsAt) <= at && t.omegaTournamentId === null)
  const { running, last } = sync.data ?? { running: null, last: null }
  const job: { label: string; tone: ChipTone; line: string } = running
    ? { label: 'Running', tone: 'cyan', line: `${running.from} → ${running.to}, started ${timeLabel(running.startedAt)}` }
    : last?.error
      ? { label: 'Failed', tone: 'negative', line: last.error }
      : last
        ? { label: 'Finished', tone: 'positive', line: `${last.finishedAt ? dayTime(last.finishedAt) : dayTime(last.startedAt)} · ${last.done.length} days${last.finishedAt ? ` in ${seconds(Date.parse(last.finishedAt) - Date.parse(last.startedAt))}` : ''}` }
        : { label: 'No run yet', tone: 'neutral', line: 'The nightly job runs at 01:00.' }

  const reclassify = () => {
    setDispatch(null)
    buildOpenSeasons().then(
      (r) => setDispatch(r.status === 'dispatched' ? { ok: true, text: 'Dispatched. The runner takes 1 to 2 minutes to start.' } : { ok: false, text: 'Nothing started: the API has no dispatch token.' }),
      (e) => setDispatch({ ok: false, text: panelErrorText(e) }),
    )
  }

  return (
    <>
      <Head eyebrow={`Panel${decks.data ? ` · Read ${timeLabel(new Date(decks.data.readAt))}` : ''}`} title="Overview" lead="What is waiting for a decision, what changed last, and the state of the jobs behind /statistics." />

      <div className="stats">
        <div>
          <span className="lbl-sm">Decks to review</span>
          <span className="fig gd">{decks.data ? count(review.length) : '—'}</span>
          <span className="cap">A candidate, or no cover</span>
        </div>
        <div>
          <span className="lbl-sm">Candidate variations</span>
          <span className="fig">{decks.data ? count(candidates) : '—'}</span>
          <span className="cap">On the decks to review</span>
        </div>
        <div>
          <span className="lbl-sm">Upcoming tournaments</span>
          <span className="fig">{tournaments.data ? count(upcoming.length) : '—'}</span>
          <span className="cap">Scheduled and not started</span>
        </div>
        <div>
          <span className="lbl-sm">Waiting for a link</span>
          <span className="fig gd">{tournaments.data ? count(waiting.length) : '—'}</span>
          <span className="cap">Ran, no Omega tournament linked</span>
        </div>
        <div>
          <span className="lbl-sm">Last statistics job</span>
          <span className="fig-s" style={{ paddingTop: 8 }}>
            {sync.data ? job.label : '—'}
          </span>
          <span className="cap">{sync.data && last ? dayLabel(last.finishedAt ?? last.startedAt) : 'Nightly at 01:00'}</span>
        </div>
      </div>

      <div className="split">
        <div className="wide col" style={{ gap: 32 }}>
          <section className="col" style={{ gap: 16 }}>
            <Rail n="01" title="Needs a decision" note={decks.data ? `${review.length} decks` : undefined} />
            {decks.error ? <Failure title="Couldn't read the decks">{panelErrorText(decks.error)}</Failure> : null}
            <div className="tblbox">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Deck</th>
                    <th>What changed</th>
                    <th className="r">TCG lists</th>
                    <th className="r">Genesys lists</th>
                    <th className="r">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {review.slice(0, 6).map((d) => (
                    <tr key={d.code}>
                      <td>
                        <span className="who">
                          <Cover card={d.cover?.card} />
                          <span className="col-s">
                            <span className="nm">{d.name ?? hex(d.code)}</span>
                            <span className="cap">{kindLabel(d.kind)}</span>
                          </span>
                        </span>
                      </td>
                      <td className="dim">{what(d)}</td>
                      <td className="r ink">{count(d.tcg?.lists ?? 0)}</td>
                      <td className="r">{count(d.genesys?.lists ?? 0)}</td>
                      <td className="r">
                        <Link className="act" href={`/admin/decks/${d.code}`}>
                          Review
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {review.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="dim">
                        {decks.data ? 'Nothing is waiting.' : decks.error ? 'Nothing to show.' : 'Loading…'}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {review.length > 6 ? (
              <Link className="act" href="/admin/decks">
                All {review.length} decks to review
              </Link>
            ) : null}
          </section>

          <section className="col" style={{ gap: 16 }}>
            <Rail n="02" title="Recent activity" note="Every change is logged" />
            {audit.error ? <Failure title="Couldn't read the log">{panelErrorText(audit.error)}</Failure> : null}
            <div className="tblbox">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Who</th>
                    <th>Action</th>
                    <th>Target</th>
                    <th>Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {(audit.data?.entries ?? []).map((e) => (
                    <tr key={e.id}>
                      <td className="dim" style={{ whiteSpace: 'nowrap' }}>
                        {dayLabel(e.at)} · {timeLabel(e.at)}
                      </td>
                      <td className="ink">{e.actor.username ?? e.actor.id}</td>
                      <td className="mono">{e.action}</td>
                      <td className="mono">{e.target ?? '—'}</td>
                      <td>
                        <Chip tone={OUTCOME[e.outcome].tone}>{OUTCOME[e.outcome].label}</Chip>
                      </td>
                    </tr>
                  ))}
                  {audit.data?.entries.length ? null : (
                    <tr>
                      <td colSpan={5} className="dim">
                        {audit.data ? 'Nothing logged yet.' : audit.error ? 'Nothing to show.' : 'Loading…'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Link className="act" href="/admin/activity">
              Open the activity log
            </Link>
          </section>
        </div>

        <aside className="side col" style={{ gap: 24 }}>
          <div className="cut notch c-md pnl">
            <h2 className="t3">On the site</h2>
            <div className="col-s">
              {SITE.map(([label, href]) => (
                <Link key={href} className="lnk" href={href}>
                  {label} <span className="mono mut">{href}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="cut notch c-md pnl">
            <div className="fx-b">
              <h2 className="t3">Statistics job</h2>
              {sync.data ? <Chip tone={job.tone}>{job.label}</Chip> : null}
            </div>
            {sync.error ? <Failure title="Couldn't read the job">{panelErrorText(sync.error)}</Failure> : <p className="sm">{sync.data ? job.line : 'Loading…'}</p>}
            <div className="fx">
              <Button variant="secondary" size="mono" onClick={reclassify}>
                Reclassify open seasons
              </Button>
              <Button variant="ghost" size="mono" href="/admin/statistics/sweep">
                Open the job
              </Button>
            </div>
            {dispatch ? <p className={`sm ${dispatch.ok ? 'gn' : 'rd'}`}>{dispatch.text}</p> : null}
          </div>

          <div className="cut notch c-md pnl">
            <h2 className="t3">Open seasons</h2>
            {seasons.error ? <Failure title="Couldn't read the seasons">{panelErrorText(seasons.error)}</Failure> : null}
            <div className="col">
              {(seasons.data ?? []).map((entry) => (
                <div key={entry.ladder} className="fx-b">
                  <span className="fx">
                    <Chip tone={entry.ladder}>{entry.format}</Chip>
                    <span className="ink">{entry.season?.label ?? 'No open season'}</span>
                  </span>
                  <span className="mono">{entry.season ? `${count(entry.season.standings)} duelists` : '—'}</span>
                </div>
              ))}
              {!seasons.data && !seasons.error ? <p className="sm">Loading…</p> : null}
            </div>
            <Link className="act" href="/admin/seasons">
              Open Seasons
            </Link>
          </div>
        </aside>
      </div>
    </>
  )
}

export default OverviewPage
