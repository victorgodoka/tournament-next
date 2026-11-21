'use client'

import { useState } from 'react'
import { Button } from '@ui/button'
import { Chip } from '@ui/chip'
import { Dialog } from '@ui/dialog'
import { useResource } from '@hooks/index'
import { dayLabel, dayTime, timeLabel } from '@utils/format'
import { listSeasons, panelErrorText, renameSeason, rolloverSeason, syncRanked, type PanelSeason } from '@utils/panel'
import { getPastSeasons, refreshLeaderboard } from '@utils/ranked'
import { getSeasons, type Season } from '@utils/statistics'
import { count, Failure, Head, Rail } from '../shared'

type Notice = { ok: boolean; title: string; body?: string }
type Open = PanelSeason & { season: NonNullable<PanelSeason['season']> }

const LADDER = { tcg: 'TCG', genesys: 'Genesys' } as const
const CODE = /^[a-z0-9]+(-[a-z0-9]+)*$/
const days = (from: string, to: number) => Math.max(0, Math.floor((to - Date.parse(from)) / 86_400_000))

const Note = ({ notice }: { notice: Notice }) =>
  notice.ok ? (
    <div role="status" className="well" style={{ borderColor: 'var(--color-win)' }}>
      <span className="t4">{notice.title}</span>
      {notice.body ? <p className="sm">{notice.body}</p> : null}
    </div>
  ) : (
    <Failure title={notice.title}>{notice.body}</Failure>
  )

/** What the rollover answers with, said to the admin. */
const ROLLOVER: Record<string, string> = {
  SEASON_MISMATCH: 'Another season is open now.',
  SEASON_EMPTY: 'Nobody has played this season yet, so there is nothing to close.',
  SEASON_CLOSED: 'Someone else just closed it.',
}

/** Close a season and open the next. `pressedAt` is the moment the button was pressed, not the moment of the confirm. */
const CloseDialog = ({ entry, pressedAt, onClose, onDone }: { entry: Open; pressedAt: number; onClose: () => void; onDone: (notice: Notice) => void }) => {
  const season = entry.season
  const [code, setCode] = useState(`${entry.ladder}-${season.ordinal + 1}`)
  const [label, setLabel] = useState(`Season ${season.ordinal + 1}`)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ code?: string; text: string } | null>(null)
  const badCode = !CODE.test(code) || code.length > 40
  const badLabel = label.trim().length < 1 || label.trim().length > 60

  const confirm = () => {
    setBusy(true)
    setError(null)
    // `season` turns a double click or a stale tab into SEASON_MISMATCH instead of a second rollover
    rolloverSeason({ ladder: entry.ladder, season: season.ordinal, code, label: label.trim() }).then(
      (result) => onDone({ ok: true, title: `${LADDER[entry.ladder]} ${result.closed.label} closed, ${result.opened.label} open`, body: `${count(result.closed.standings)} duelists frozen in the final standings.` }),
      (e) => {
        setBusy(false)
        const errorCode = (e as { code?: string }).code
        if (errorCode && ROLLOVER[errorCode]) onDone({ ok: false, title: ROLLOVER[errorCode]!, body: 'The lists were read again.' })
        else setError({ code: errorCode, text: panelErrorText(e) })
      },
    )
  }

  return (
    <Dialog
      open
      onClose={onClose}
      eyebrow={`${LADDER[entry.ladder]} · close and open next`}
      title={`Close ${season.label}?`}
      description="The ladder rolls over for everyone: the standings are frozen and ratings start the new season."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" disabled={busy || badCode || badLabel} onClick={confirm}>
            {busy ? 'Closing…' : 'Confirm closing and new season'}
          </Button>
        </>
      }
    >
      <div className="adm" style={{ minHeight: 0, background: 'transparent' }}>
        <div className="g2" style={{ gap: 20, flex: '1 1 100%' }}>
          <div className="well col">
            <span className="fx">
              <Chip tone={entry.ladder}>{LADDER[entry.ladder]}</Chip>
              <span className="lbl-strong">Season closing</span>
            </span>
            <div className="col-s">
              <span className="lbl-sm">Code · Label</span>
              <span className="ink">
                <span className="mono">{season.code}</span> · {season.label}
              </span>
            </div>
            <div className="col-s">
              <span className="lbl-sm">Opened · Closes</span>
              <span className="ink">
                {dayTime(season.startsAt)} → {dayTime(new Date(pressedAt))}
              </span>
            </div>
            <div className="col-s">
              <span className="lbl-sm">Days open · Duelists</span>
              <span className="ink">
                {days(season.startsAt, pressedAt)} · {count(season.standings)}
              </span>
            </div>
            <p className="cap">The label can still be renamed later; the code never changes.</p>
          </div>
          <div className="well col">
            <span className="fx">
              <Chip tone={entry.ladder}>{LADDER[entry.ladder]}</Chip>
              <span className="lbl-strong">New season</span>
            </span>
            <div className="col-s">
              <span className="lbl-sm">Starts</span>
              <span className="ink">{dayTime(new Date(pressedAt))}</span>
              <span className="cap">The moment you pressed Close this season, not the moment you confirm. The server stamps the exact instant when it answers; games from then on count for the new season.</span>
            </div>
            <label className="fld">
              <span className="lbl-sm">Code</span>
              <span className="cut inpw">
                <input className="inp mono" value={code} maxLength={40} onChange={(e) => setCode(e.target.value)} />
              </span>
              {error?.code === 'CODE_TAKEN' ? <span className="cap rd">{error.text} The old season is still open.</span> : badCode ? <span className="cap rd">Lowercase letters, digits and single hyphens, at most 40.</span> : null}
            </label>
            <label className="fld">
              <span className="lbl-sm">Label</span>
              <span className="cut inpw">
                <input className="inp" value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} />
              </span>
            </label>
            <p className="cap">Both are filled in for you and can be changed here. After this the code is fixed.</p>
          </div>
        </div>
        <p className="sm gd" style={{ flex: '1 1 100%', paddingTop: 16 }}>
          This can&apos;t be undone. A closed season doesn&apos;t reopen. /statistics shows the new season after its first build.
        </p>
        {error && error.code !== 'CODE_TAKEN' ? <Failure>{error.text}</Failure> : null}
      </div>
    </Dialog>
  )
}

const SeasonsPage = () => {
  const open = useResource('ranked-seasons', listSeasons)
  const all = useResource('statistics-seasons', () => getSeasons())
  const past = useResource('past-seasons', () => Promise.all((['tcg', 'genesys'] as const).map((ladder) => getPastSeasons(ladder))))
  const [closing, setClosing] = useState<{ entry: Open; at: number } | null>(null)
  const [renaming, setRenaming] = useState<{ code: string; label: string } | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const reload = () => {
    open.reload()
    all.reload()
    past.reload()
  }
  // duelists: the open ones from the live snapshot, the closed ones from the archive
  const duelists = new Map<string, number>([
    ...(open.data ?? []).flatMap((e): [string, number][] => (e.season ? [[e.season.code, e.season.standings]] : [])),
    ...(past.data ?? []).flatMap((p) => p.seasons.map((s): [string, number] => [s.code, s.standings])),
  ])

  const save = (season: Season) => {
    if (!renaming) return
    const label = renaming.label.trim()
    if (label.length < 1 || label.length > 60 || label === season.label) return setRenaming(null)
    setBusy('rename')
    // only the label: the route also takes a code, and the panel never sends it
    renameSeason(season.code, { label }).then(
      () => {
        setBusy(null)
        setRenaming(null)
        setNotice({ ok: true, title: `${season.code} is now "${label}"` })
        reload()
      },
      (e) => {
        setBusy(null)
        setNotice({ ok: false, title: "That didn't go through", body: panelErrorText(e) })
      },
    )
  }

  const job = (which: 'sync' | 'refresh') => {
    setBusy(which)
    setNotice(null)
    const request: Promise<Notice> =
      which === 'sync'
        ? syncRanked().then((r) =>
            r.status === 'busy'
              ? { ok: false, title: 'Already running', body: 'Another update holds the lock. Try again when it ends.' }
              : { ok: true, title: `Ranked data updated for ${r.day}`, body: `${count(r.duelists)} duelists · ${count(r.standings)} standings · ${(r.ms / 1000).toFixed(1)} s` },
          )
        : refreshLeaderboard().then((r) => ({ ok: true, title: `Leaderboard rebuilt at ${timeLabel(r.readAt)}`, body: `${count(r.tcg)} TCG · ${count(r.genesys)} Genesys` }))
    request.then(setNotice, (e) => setNotice({ ok: false, title: "That didn't go through", body: panelErrorText(e) })).finally(() => setBusy(null))
  }

  return (
    <>
      <Head eyebrow="Ranked · one open season per ladder" title="Seasons" lead="Close a season and open the next, rename a label, and run the ranked jobs by hand. Renaming and closing are separate: nothing here renames while closing." />
      {open.error ? <Failure title="Couldn't read the open seasons">{panelErrorText(open.error)}</Failure> : null}
      {notice ? <Note notice={notice} /> : null}

      <section className="col" style={{ gap: 16 }}>
        <Rail n="01" title="Open seasons" note="TCG, then Genesys" />
        <div className="g2">
          {(['tcg', 'genesys'] as const).map((ladder) => {
            const entry = (open.data ?? []).find((e) => e.ladder === ladder)
            const season = entry?.season
            return (
              <div key={ladder} className="cut notch c-md pnl">
                <div className="fx-b">
                  <span className="fx">
                    <Chip tone={ladder}>{LADDER[ladder]}</Chip>
                    <h3 className="t3">{season?.label ?? (open.data ? 'No open season' : 'Loading…')}</h3>
                  </span>
                  {season ? <span className="mono mut">{season.code}</span> : null}
                </div>
                {season ? (
                  <>
                    <div className="stats" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                      <div>
                        <span className="lbl-sm">Opened</span>
                        <span className="fig-s">{dayLabel(season.startsAt)}</span>
                        {/* eslint-disable-next-line react-hooks/purity -- a day count, read when the page renders */}
                        <span className="cap">{days(season.startsAt, Date.now())} days open</span>
                      </div>
                      <div>
                        <span className="lbl-sm">Duelists</span>
                        <span className="fig-s">{count(season.standings)}</span>
                        <span className="cap">{season.syncedAt ? `Synced ${dayTime(season.syncedAt)}` : 'No snapshot yet'}</span>
                      </div>
                    </div>
                    <div className="fx">
                      {/* the moment of the press is the new season's start, so it is recorded here */}
                      <Button variant="danger-outline" size="mono-md" onClick={() => setClosing({ entry: entry as Open, at: Date.now() })}>
                        Close this season
                      </Button>
                    </div>
                  </>
                ) : null}
              </div>
            )
          })}
        </div>
      </section>

      <section className="col" style={{ gap: 16 }}>
        <Rail n="02" title="All seasons" note="Only the label can be renamed" />
        <div className="tblbox">
          <table className="tbl">
            <thead>
              <tr>
                <th>Ladder</th>
                <th>Label</th>
                <th>Code</th>
                <th>State</th>
                <th>Opened</th>
                <th>Closed</th>
                <th className="r">Duelists</th>
                <th className="r">Action</th>
              </tr>
            </thead>
            <tbody>
              {(all.data ?? []).map((s) => {
                const editing = renaming?.code === s.code
                return (
                  <tr key={s.code}>
                    <td>
                      <Chip tone={s.ladder}>{LADDER[s.ladder]}</Chip>
                    </td>
                    <td>
                      {editing ? (
                        <span className="cut inpw" style={{ minHeight: 34, maxWidth: 320 }}>
                          <input
                            className="inp"
                            autoFocus
                            aria-label={`Label of ${s.code}`}
                            maxLength={60}
                            value={renaming.label}
                            onChange={(e) => setRenaming({ code: s.code, label: e.target.value })}
                            onKeyDown={(e) => (e.key === 'Enter' ? save(s) : e.key === 'Escape' ? setRenaming(null) : undefined)}
                          />
                        </span>
                      ) : (
                        <span className="nm">{s.label}</span>
                      )}
                    </td>
                    <td className="mono">{s.code}</td>
                    <td>
                      <Chip tone={s.endsAt ? 'neutral' : 'positive'}>{s.endsAt ? 'Closed' : 'Open'}</Chip>
                    </td>
                    <td className="dim">{dayLabel(s.startsAt)}</td>
                    <td className="dim">{s.endsAt ? dayLabel(s.endsAt) : '—'}</td>
                    <td className="r">{count(duelists.get(s.code))}</td>
                    <td className="r">
                      <span className="fx" style={{ justifyContent: 'flex-end', gap: 14, flexWrap: 'nowrap' }}>
                        {editing ? (
                          <>
                            <button type="button" className="act" disabled={busy === 'rename'} onClick={() => save(s)}>
                              Save label
                            </button>
                            <button type="button" className="act" onClick={() => setRenaming(null)}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button type="button" className="act" onClick={() => setRenaming({ code: s.code, label: s.label })}>
                            Rename
                          </button>
                        )}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {all.data?.length ? null : (
                <tr>
                  <td colSpan={8} className="dim">
                    {all.data ? 'No season yet.' : 'Loading…'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="col" style={{ gap: 16 }}>
        <Rail n="03" title="Ranked data" note="The nightly job runs at 01:00" />
        <div className="g2" style={{ gap: 1, background: 'var(--color-line)', border: '1px solid var(--color-line)' }}>
          {(
            [
              ['sync', 'Update ranked data', 'Does now what the nightly job does.', 'Run update', 'Running…'],
              ['refresh', 'Refresh the leaderboard', 'Rebuilds the cached board now instead of at the next 30-minute read.', 'Refresh now', 'Refreshing…'],
            ] as const
          ).map(([which, title, blurb, action, running]) => (
            <div key={which} className="fx-b" style={{ background: 'var(--color-surface-100)', padding: '20px 24px', flexWrap: 'nowrap' }}>
              <div className="col-s">
                <span className="t4">{title}</span>
                <span className="sm">{blurb}</span>
              </div>
              <Button variant="secondary" size="mono-md" disabled={busy !== null} onClick={() => job(which)}>
                {busy === which ? running : action}
              </Button>
            </div>
          ))}
        </div>
      </section>

      {closing ? (
        <CloseDialog
          key={closing.at}
          entry={closing.entry}
          pressedAt={closing.at}
          onClose={() => setClosing(null)}
          onDone={(result) => {
            setClosing(null)
            setNotice(result)
            reload()
          }}
        />
      ) : null}
    </>
  )
}

export default SeasonsPage
