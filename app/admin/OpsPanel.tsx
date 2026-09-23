'use client'

import { useEffect, useState } from 'react'
import { Button, Chip } from '@ui/index'
import { refreshLeaderboard } from '@utils/ranked'
import { listSeasons, renameSeason, rolloverSeason, syncRanked, type PanelSeason } from '@utils/panel'
import { Empty, errorText, Field, INPUT, List, ListRow, Notice, Row, RowButton, dateTime } from './ui'

/* ---------------------------------------------------------------- *
 * One ladder's open season
 * ---------------------------------------------------------------- */

const SeasonRow = ({ entry, onChanged }: { entry: PanelSeason; onChanged: () => void }) => {
  const [open, setOpen] = useState<'none' | 'rename' | 'rollover'>('none')
  const [code, setCode] = useState('')
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const season = entry.season

  const run = async (work: () => Promise<string>) => {
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      setDone(await work())
      setOpen('none')
      setCode('')
      setLabel('')
      onChanged()
    } catch (failure) {
      setError(errorText(failure))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ListRow>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2.5 text-ink display-5">
            {entry.format}
            {season ? <Chip tone="cyan">{season.code}</Chip> : <Chip tone="negative">no open season</Chip>}
          </p>
          {season ? (
            <>
              <p className="mt-1.5 text-ink-muted mono-data">
                {season.label} · ordinal {season.ordinal} · opened {dateTime(season.startsAt)}
              </p>
              <p className="mt-1 text-ink-muted mono-note">
                {season.standings.toLocaleString()} duelists in the snapshot · last synced {dateTime(season.syncedAt)}
              </p>
            </>
          ) : null}
        </div>

        {season ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <RowButton onClick={() => setOpen(open === 'rename' ? 'none' : 'rename')}>Rename</RowButton>
            <RowButton tone="danger" onClick={() => setOpen(open === 'rollover' ? 'none' : 'rollover')}>
              Close &amp; open next
            </RowButton>
          </div>
        ) : null}
      </div>

      {season && open === 'rename' ? (
        <div className="mt-3.75 grid gap-4 border border-line bg-surface-200 px-4 py-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field id={`code-${season.code}`} label="New code" hint="The internal identifier. Must stay unique.">
            <input id={`code-${season.code}`} value={code} onChange={(e) => setCode(e.target.value)} placeholder={season.code} autoComplete="off" className={INPUT} />
          </Field>
          <Field id={`label-${season.code}`} label="New label">
            <input id={`label-${season.code}`} value={label} onChange={(e) => setLabel(e.target.value)} placeholder={season.label} autoComplete="off" className={INPUT} />
          </Field>
          <Button
            size="sm"
            disabled={busy || (!code.trim() && !label.trim())}
            onClick={() =>
              run(async () => {
                await renameSeason(season.code, { code: code.trim() || undefined, label: label.trim() || undefined })
                return `${entry.format}: season renamed.`
              })
            }
          >
            {busy ? 'Saving…' : 'Rename'}
          </Button>
        </div>
      ) : null}

      {season && open === 'rollover' ? (
        <div className="mt-3.75 border border-negative bg-ground-negative px-4 py-4">
          <p className="text-ink body-sm">
            Close <strong>{season.label}</strong> ({season.code}) and open the next one for {entry.format}. The final
            standings are computed from a live read, so run this <strong>before</strong> the rating reset. Nothing of the
            closed season is ever deleted.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Field id={`next-code-${season.code}`} label="Next code" hint={`Defaults to ${entry.ladder}-${season.ordinal + 1}.`}>
              <input id={`next-code-${season.code}`} value={code} onChange={(e) => setCode(e.target.value)} placeholder={`${entry.ladder}-${season.ordinal + 1}`} autoComplete="off" className={INPUT} />
            </Field>
            <Field id={`next-label-${season.code}`} label="Next label" hint={`Defaults to Season ${season.ordinal + 1}.`}>
              <input id={`next-label-${season.code}`} value={label} onChange={(e) => setLabel(e.target.value)} placeholder={`Season ${season.ordinal + 1}`} autoComplete="off" className={INPUT} />
            </Field>
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const result = await rolloverSeason({
                    ladder: entry.ladder,
                    // The ordinal we believe is open: this is what turns a stale tab into a 409.
                    season: season.ordinal,
                    code: code.trim() || undefined,
                    label: label.trim() || undefined,
                  })
                  return `${result.format}: ${result.closed.code} closed with ${result.closed.standings.toLocaleString()} duelists, ${result.opened.code} open.`
                })
              }
            >
              {busy ? 'Rolling over…' : 'Roll the season over'}
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="mt-3.75">
          <Notice tone="error">{error}</Notice>
        </div>
      ) : null}
      {done ? (
        <div className="mt-3.75">
          <Notice tone="ok">{done}</Notice>
        </div>
      ) : null}
    </ListRow>
  )
}

/* ---------------------------------------------------------------- *
 * Panel
 * ---------------------------------------------------------------- */

export const OpsPanel = () => {
  const [seasons, setSeasons] = useState<PanelSeason[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'sync' | 'refresh' | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const load = () => listSeasons().then(setSeasons).catch((failure) => setError(errorText(failure)))

  useEffect(() => {
    const abort = new AbortController()
    listSeasons(abort.signal)
      .then(setSeasons)
      .catch((failure) => !abort.signal.aborted && setError(errorText(failure)))
    return () => abort.abort()
  }, [])

  const sync = async () => {
    setBusy('sync')
    setError(null)
    setDone(null)
    try {
      const result = await syncRanked()
      setDone(
        result.status === 'busy'
          ? 'A sync was already running; this click did nothing.'
          : `Synced ${result.duelists.toLocaleString()} duelists into ${result.standings.toLocaleString()} standings (${result.day}, ${result.ms} ms).`,
      )
      await load()
    } catch (failure) {
      setError(errorText(failure))
    } finally {
      setBusy(null)
    }
  }

  const refresh = async () => {
    setBusy('refresh')
    setError(null)
    setDone(null)
    try {
      const result = await refreshLeaderboard()
      setDone(`Leaderboard re-read: ${result.tcg.toLocaleString()} TCG, ${result.genesys.toLocaleString()} Genesys.`)
    } catch (failure) {
      setError(errorText(failure))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Row
      index="03"
      title="Ranked operations"
      blurb="The nightly job, run by hand. Sync rewrites each ladder's snapshot; a rollover freezes a season's final results and opens the next."
      action={
        <div className="flex flex-wrap gap-3">
          <Button size="sm" onClick={sync} disabled={busy !== null}>
            {busy === 'sync' ? 'Syncing…' : 'Update ranked data'}
          </Button>
          <Button variant="secondary" size="sm" onClick={refresh} disabled={busy !== null}>
            {busy === 'refresh' ? 'Refreshing…' : 'Refresh leaderboard'}
          </Button>
        </div>
      }
    >
      <div className="grid gap-6">
        <Notice tone="error">{error}</Notice>
        <Notice tone="ok">{done}</Notice>

        {seasons === null ? (
          <Empty>Loading seasons…</Empty>
        ) : seasons.length === 0 ? (
          <Empty>No ladder has an open season.</Empty>
        ) : (
          <List>
            {seasons.map((entry) => (
              <SeasonRow key={entry.ladder} entry={entry} onChanged={load} />
            ))}
          </List>
        )}
      </div>
    </Row>
  )
}
