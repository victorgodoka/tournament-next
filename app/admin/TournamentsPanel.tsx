'use client'

import { useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Button, Chip, Modal } from '@ui/index'
import {
  createTournament,
  deleteTournament,
  linkOmega,
  listFormats,
  listOmegaBanlists,
  listOmegaTournaments,
  listTournaments,
  unlinkOmega,
  updateTournament,
  type OmegaBanlist,
  type OmegaQuery,
  type OmegaTournament,
  type PanelFormat,
  type ScheduledTournament,
  type TournamentBody,
} from '@utils/panel'
import type { Banlist } from '@utils/wiki'
import {
  Empty,
  errorText,
  Field,
  INPUT,
  List,
  ListRow,
  MONO_INPUT,
  Notice,
  Row,
  RowButton,
  Toggle,
  dateTime,
  day,
  money,
} from './ui'

const MODES = [
  { value: 0, label: 'Single' },
  { value: 1, label: 'Match' },
  { value: 2, label: 'Tag' },
]

const TOURNY_MODES = [
  { value: 0, label: 'Swiss' },
  { value: 1, label: 'Single elimination' },
]

/* ---------------------------------------------------------------- *
 * Draft ↔ row
 * ---------------------------------------------------------------- */

type Draft = {
  formatId: string
  startsAt: string
  banlistId: string
  mode: number
  masterRule: number
  region: number
  timer: number
  drawCount: number
  startHand: number
  startLp: number
  duelRule: number
  relFrom: string
  relUntil: string
  extraRules: string
  budgetCents: number
  requiresPass: boolean
  rewardTp: boolean
  tournyMode: number
}

/* Current-format values, which is what a new tournament almost always is. Everything here is
   editable: Edison and the other retro formats come in through the format picker instead. */
const BLANK: Draft = {
  formatId: '',
  startsAt: '',
  banlistId: '',
  mode: 1,
  masterRule: 5,
  region: 1,
  timer: 180,
  drawCount: 1,
  startHand: 5,
  startLp: 8000,
  duelRule: 5,
  relFrom: '',
  relUntil: '',
  extraRules: '0',
  budgetCents: 0,
  requiresPass: false,
  rewardTp: false,
  tournyMode: 0,
}

/** Read outside the component: rendering must stay pure, and a row's past/upcoming needs a clock. */
const readClock = () => Date.now()

/** `<input type="datetime-local">` speaks local wall-clock; the API speaks ISO UTC. */
const toLocalInput = (iso: string) => {
  const date = new Date(iso)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

const toDraft = (row: ScheduledTournament): Draft => ({
  formatId: row.formatId === null ? '' : String(row.formatId),
  startsAt: toLocalInput(row.startsAt),
  banlistId: String(row.banlistId),
  mode: row.mode,
  masterRule: row.masterRule,
  region: row.region,
  timer: row.timer,
  drawCount: row.drawCount,
  startHand: row.startHand,
  startLp: row.startLp,
  duelRule: row.duelRule,
  relFrom: row.relFrom ?? '',
  relUntil: row.relUntil ?? '',
  extraRules: row.extraRules,
  budgetCents: row.budgetCents,
  requiresPass: row.requiresPass,
  rewardTp: row.rewardTp,
  tournyMode: row.tournyMode,
})

const toBody = (draft: Draft): TournamentBody => ({
  formatId: draft.formatId ? Number(draft.formatId) : null,
  startsAt: new Date(draft.startsAt).toISOString(),
  banlistId: Number(draft.banlistId),
  mode: draft.mode,
  masterRule: draft.masterRule,
  region: draft.region,
  timer: draft.timer,
  drawCount: draft.drawCount,
  startHand: draft.startHand,
  startLp: draft.startLp,
  duelRule: draft.duelRule,
  relFrom: draft.relFrom || null,
  relUntil: draft.relUntil || null,
  // A uint64 bitmask: it travels as a string all the way, never through a JS number.
  extraRules: draft.extraRules.trim() || '0',
  budgetCents: draft.budgetCents,
  requiresPass: draft.requiresPass,
  rewardTp: draft.rewardTp,
  tournyMode: draft.tournyMode,
})

/* ---------------------------------------------------------------- *
 * Small controls
 * ---------------------------------------------------------------- */

const NumberField = ({
  id,
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  id: string
  label: string
  hint?: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}) => (
  <Field id={id} label={label} hint={hint ?? `${min}–${max}`}>
    <input
      id={id}
      type="number"
      inputMode="numeric"
      value={value}
      min={min}
      max={max}
      required
      onChange={(e) => onChange(e.target.valueAsNumber)}
      className={MONO_INPUT}
    />
  </Field>
)

/* ---------------------------------------------------------------- *
 * The 16 parameters
 * ---------------------------------------------------------------- */

const TournamentForm = ({
  tournament,
  formats,
  banlists,
  onDone,
  onCancel,
}: {
  tournament: ScheduledTournament | null
  formats: PanelFormat[]
  banlists: Banlist[]
  onDone: () => void
  onCancel: () => void
}) => {
  const [draft, setDraft] = useState<Draft>(tournament ? toDraft(tournament) : BLANK)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const set = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }))

  /** The server pulls banlist and card window from the format; mirror it so the form shows it too. */
  const pickFormat = (id: string) => {
    const format = formats.find((entry) => String(entry.id) === id)
    if (!format) return set({ formatId: id })
    set({
      formatId: id,
      banlistId: format.banlist ? String(format.banlist.id) : draft.banlistId,
      relFrom: format.relFrom ?? '',
      relUntil: format.relUntil ?? '',
    })
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const body = toBody(draft)
      if (tournament) await updateTournament(tournament.id, body)
      else await createTournament(body)
      onDone()
    } catch (failure) {
      setError(errorText(failure))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="border border-line-strong bg-surface-100 p-5.5 lg:p-7">
      <p className="text-gold signal-lg">{tournament ? `Edit schedule #${tournament.id}` : 'New scheduled tournament'}</p>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <Field id="t-starts-at" label="Starts at" hint="Your local time; stored as UTC.">
          <input
            id="t-starts-at"
            type="datetime-local"
            value={draft.startsAt}
            onChange={(e) => set({ startsAt: e.target.value })}
            required
            className={INPUT}
          />
        </Field>

        <Field id="t-format" label="Format" hint="Fills banlist and card window. Provenance only — the values below are what is saved.">
          <select id="t-format" value={draft.formatId} onChange={(e) => pickFormat(e.target.value)} className={INPUT}>
            <option value="">None</option>
            {formats.map((format) => (
              <option key={format.id} value={format.id}>
                {format.name}
              </option>
            ))}
          </select>
        </Field>

        <Field id="t-banlist" label="Banlist" hint="Card database id. Required.">
          <select
            id="t-banlist"
            value={draft.banlistId}
            onChange={(e) => set({ banlistId: e.target.value })}
            required
            className={INPUT}
          >
            <option value="">Pick a banlist</option>
            {banlists.map((banlist) => (
              <option key={banlist.id} value={banlist.id}>
                {banlist.name} · {banlist.format}
              </option>
            ))}
          </select>
        </Field>

        <Field id="t-mode" label="Duel mode">
          <select id="t-mode" value={draft.mode} onChange={(e) => set({ mode: Number(e.target.value) })} className={INPUT}>
            {MODES.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <NumberField
          id="t-master-rule"
          label="Master rule"
          hint="1–5, literal: N is Master Rule N. Edison uses 1, everything current uses 5."
          value={draft.masterRule}
          min={1}
          max={5}
          onChange={(masterRule) => set({ masterRule })}
        />
        <NumberField
          id="t-region"
          label="Region"
          hint="0–7, the card's raw ot. Do not translate it: OCG banlists store 0."
          value={draft.region}
          min={0}
          max={7}
          onChange={(region) => set({ region })}
        />
        <NumberField
          id="t-timer"
          label="Timer"
          hint="0–255 seconds per turn."
          value={draft.timer}
          min={0}
          max={255}
          onChange={(timer) => set({ timer })}
        />
        <NumberField
          id="t-draw-count"
          label="Draw count"
          hint="0–31. The game stores draw as one bit, so above 1 may not round-trip."
          value={draft.drawCount}
          min={0}
          max={31}
          onChange={(drawCount) => set({ drawCount })}
        />
        <NumberField
          id="t-start-hand"
          label="Starting hand"
          value={draft.startHand}
          min={0}
          max={31}
          onChange={(startHand) => set({ startHand })}
        />
        <NumberField
          id="t-start-lp"
          label="Starting LP"
          hint="0–102000. The game stores LP/400 in 8 bits."
          value={draft.startLp}
          min={0}
          max={102000}
          onChange={(startLp) => set({ startLp })}
        />
        <NumberField id="t-duel-rule" label="Duel rule" value={draft.duelRule} min={0} max={7} onChange={(duelRule) => set({ duelRule })} />

        <Field id="t-tourny-mode" label="Bracket">
          <select
            id="t-tourny-mode"
            value={draft.tournyMode}
            onChange={(e) => set({ tournyMode: Number(e.target.value) })}
            className={INPUT}
          >
            {TOURNY_MODES.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field id="t-rel-from" label="Cards released from" hint="Booster release date. Empty means no lower bound.">
          <input id="t-rel-from" type="date" value={draft.relFrom} onChange={(e) => set({ relFrom: e.target.value })} className={INPUT} />
        </Field>
        <Field id="t-rel-until" label="Cards released until" hint="Empty means no upper bound.">
          <input id="t-rel-until" type="date" value={draft.relUntil} onChange={(e) => set({ relUntil: e.target.value })} className={INPUT} />
        </Field>

        <Field id="t-extra-rules" label="Extra rules" hint="uint64 bitmask, decimal or 0x…. Kept as text on purpose.">
          <input
            id="t-extra-rules"
            value={draft.extraRules}
            onChange={(e) => set({ extraRules: e.target.value })}
            inputMode="numeric"
            autoComplete="off"
            className={MONO_INPUT}
          />
        </Field>

        <NumberField
          id="t-budget"
          label="Budget (cents)"
          hint={`Integer of cents — ${money(draft.budgetCents)}.`}
          value={draft.budgetCents}
          min={0}
          max={Number.MAX_SAFE_INTEGER}
          onChange={(budgetCents) => set({ budgetCents })}
        />

        <div className="grid grid-cols-1 gap-3 self-end sm:grid-cols-2 md:col-span-2">
          <Toggle label="Requires battlepass" checked={draft.requiresPass} onChange={(requiresPass) => set({ requiresPass })} />
          <Toggle label="Rewards TP" checked={draft.rewardTp} onChange={(rewardTp) => set({ rewardTp })} />
        </div>
      </div>

      {error ? (
        <div className="mt-6">
          <Notice tone="error">{error}</Notice>
        </div>
      ) : null}

      <div className="mt-7 flex flex-wrap gap-3">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? 'Saving…' : tournament ? 'Save schedule' : 'Create schedule'}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

/* ---------------------------------------------------------------- *
 * The command
 * ---------------------------------------------------------------- */

/** Rendered by the server in the order the game client expects. Copied, never rebuilt. */
const Command = ({ command }: { command: string }) => {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), [])

  const copy = async () => {
    await navigator.clipboard.writeText(command)
    setCopied(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="mt-3.75 flex flex-wrap items-center gap-2.5 border border-line bg-surface-200 px-3.5 py-3">
      <code className="min-w-0 flex-1 overflow-x-auto text-ink-dim mono-data">{command}</code>
      <RowButton tone="gold" onClick={copy}>
        {copied ? 'Copied' : 'Copy'}
      </RowButton>
    </div>
  )
}

/* ---------------------------------------------------------------- *
 * Picking the tournament that actually ran
 * ---------------------------------------------------------------- */

const settingsLine = (omega: OmegaTournament) => {
  const { mode, masterRule, timer, startingLp } = omega.settings
  return [mode && `${mode}`, masterRule != null && `MR${masterRule}`, timer != null && `${timer}s`, startingLp != null && `${startingLp} LP`]
    .filter(Boolean)
    .join(' · ')
}

const LinkPicker = ({
  schedule,
  omegaBanlists,
  onClose,
  onLinked,
}: {
  schedule: ScheduledTournament
  omegaBanlists: OmegaBanlist[]
  onClose: () => void
  onLinked: (row: ScheduledTournament) => void
}) => {
  const [query, setQuery] = useState<OmegaQuery>({
    formatId: schedule.formatId ?? undefined,
    unlinked: true,
    limit: 25,
  })
  const [rows, setRows] = useState<OmegaTournament[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [linking, setLinking] = useState<number | null>(null)

  const load = async (next: OmegaQuery, append?: string) => {
    setStatus('loading')
    setError(null)
    try {
      const page = await listOmegaTournaments({ ...next, cursor: append })
      setRows((current) => (append ? [...current, ...page.tournaments] : page.tournaments))
      setCursor(page.nextCursor)
    } catch (failure) {
      setError(errorText(failure))
    } finally {
      setStatus('idle')
    }
  }

  // Only the first read is automatic; every filter change goes through `apply`.
  useEffect(() => {
    const abort = new AbortController()
    listOmegaTournaments(query, abort.signal)
      .then((page) => {
        setRows(page.tournaments)
        setCursor(page.nextCursor)
        setStatus('idle')
      })
      .catch((failure) => {
        if (abort.signal.aborted) return
        setError(errorText(failure))
        setStatus('idle')
      })
    return () => abort.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const apply = (patch: Partial<OmegaQuery>) => {
    const next = { ...query, ...patch }
    setQuery(next)
    load(next)
  }

  const link = async (omegaId: number) => {
    setLinking(omegaId)
    try {
      onLinked(await linkOmega(schedule.id, omegaId))
    } catch (failure) {
      setError(errorText(failure))
    } finally {
      setLinking(null)
    }
  }

  return (
    <Modal isOpen onClose={onClose}>
      <div className="max-h-[86dvh] w-full max-w-[880px] overflow-y-auto border border-line-strong bg-surface-100 p-5.5 lg:p-7">
        <p className="text-gold signal-lg">Link schedule #{schedule.id}</p>
        <h2 className="mt-3 text-ink display-4">The tournament that ran</h2>
        <p className="mt-2.5 max-w-[60ch] text-ink-dim body-sm">
          The game creates tournaments without knowing a schedule exists, so the link is made by hand. Confirm the timer, LP
          and card window match before linking — a wrong link is worse than a missing one.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field id="link-banlist" label="Banlist (as the game writes it)">
            <select
              id="link-banlist"
              value={query.banlist ?? ''}
              onChange={(e) => apply({ banlist: e.target.value || undefined, formatId: undefined })}
              className={INPUT}
            >
              <option value="">{schedule.format ? `From format: ${schedule.format.name}` : 'Any'}</option>
              {omegaBanlists.map((entry) => (
                <option key={entry.banlist} value={entry.banlist}>
                  {entry.banlist} ({entry.tournaments})
                </option>
              ))}
            </select>
          </Field>

          <Field id="link-status" label="Status">
            <select
              id="link-status"
              value={query.status ?? ''}
              onChange={(e) => apply({ status: (e.target.value || undefined) as OmegaQuery['status'] })}
              className={INPUT}
            >
              <option value="">Any</option>
              <option value="live">Live</option>
              <option value="finished">Finished</option>
            </select>
          </Field>

          <Field id="link-from" label="Started from">
            <input id="link-from" type="date" value={query.from?.slice(0, 10) ?? ''} onChange={(e) => apply({ from: e.target.value || undefined })} className={INPUT} />
          </Field>

          <Field id="link-id" label="Or an exact id" hint="Ignores every other filter.">
            <input
              id="link-id"
              type="number"
              inputMode="numeric"
              placeholder="1107"
              onChange={(e) => apply({ id: e.target.value ? Number(e.target.value) : undefined })}
              className={MONO_INPUT}
            />
          </Field>
        </div>

        <div className="mt-4">
          <Toggle label="Hide tournaments already linked" checked={query.unlinked ?? false} onChange={(unlinked) => apply({ unlinked })} />
        </div>

        {error ? (
          <div className="mt-5">
            <Notice tone="error">{error}</Notice>
          </div>
        ) : null}

        <div className="mt-5">
          {rows.length === 0 && status === 'idle' ? (
            <Empty>No Omega tournament matches these filters.</Empty>
          ) : (
            <List>
              {rows.map((omega) => {
                const taken = omega.linkedTo !== null && omega.linkedTo !== schedule.id
                return (
                  <ListRow key={omega.id}>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2.5 text-ink display-5">
                          #{omega.id}
                          <Chip tone={omega.status === 'live' ? 'negative' : 'neutral'} dot={omega.status === 'live'}>
                            {omega.status}
                          </Chip>
                          {omega.linkedTo !== null ? <Chip tone="amber">linked to #{omega.linkedTo}</Chip> : null}
                        </p>
                        <p className="mt-1.5 text-ink-muted mono-data">
                          {omega.banlist ?? 'no banlist'} · {omega.players} players · {omega.rounds} rounds ·{' '}
                          {dateTime(omega.startedAt)}
                        </p>
                        <p className="mt-1 text-ink-muted mono-note">
                          {settingsLine(omega)} · cards {day(omega.cardPool.releasedFrom?.slice(0, 10) ?? null)} →{' '}
                          {day(omega.cardPool.releasedUntil?.slice(0, 10) ?? null)} · extra {omega.extraRules.raw}
                        </p>
                      </div>

                      <RowButton tone="gold" disabled={taken || linking !== null} onClick={() => link(omega.id)}>
                        {linking === omega.id ? 'Linking…' : taken ? 'Taken' : 'Link this one'}
                      </RowButton>
                    </div>
                  </ListRow>
                )
              })}
            </List>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {cursor ? (
            <Button variant="secondary" size="sm" onClick={() => load(query, cursor)} disabled={status === 'loading'}>
              {status === 'loading' ? 'Loading…' : 'Load more'}
            </Button>
          ) : null}
          <p className="text-ink-muted mono-note">Paging runs before the &ldquo;already linked&rdquo; filter, so a short page is not the end of the list.</p>
        </div>
      </div>
    </Modal>
  )
}

/* ---------------------------------------------------------------- *
 * The list
 * ---------------------------------------------------------------- */

const TournamentRow = ({
  row,
  now,
  onEdit,
  onDelete,
  onLink,
  onUnlink,
}: {
  row: ScheduledTournament
  /** The clock as of the last read. Rendering must not call `Date.now()` itself. */
  now: number
  onEdit: () => void
  onDelete: () => Promise<void>
  onLink: () => void
  onUnlink: () => Promise<void>
}) => {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const upcoming = new Date(row.startsAt).getTime() > now

  return (
    <ListRow>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2.5 text-ink display-5">
            {dateTime(row.startsAt)}
            <Chip tone={upcoming ? 'amber' : 'neutral'}>{upcoming ? 'upcoming' : 'past'}</Chip>
            {row.format ? <Chip tone="indigo">{row.format.name}</Chip> : null}
          </p>
          <p className="mt-1.5 text-ink-muted mono-data">
            #{row.id} · {row.banlistName ?? `banlist ${row.banlistId}`} ·{' '}
            {MODES.find((mode) => mode.value === row.mode)?.label ?? row.mode} ·{' '}
            {TOURNY_MODES.find((mode) => mode.value === row.tournyMode)?.label ?? row.tournyMode} · MR{row.masterRule} ·{' '}
            {row.timer}s · {row.startLp} LP
          </p>
          <p className="mt-1 text-ink-muted mono-note">
            cards {day(row.relFrom)} → {day(row.relUntil)} · budget {money(row.budgetCents)}
            {row.requiresPass ? ' · battlepass' : ''}
            {row.rewardTp ? ' · rewards TP' : ''}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {row.omegaTournamentId === null ? (
            <RowButton tone="gold" onClick={onLink}>
              Link result
            </RowButton>
          ) : (
            <>
              <Chip tone={row.omega ? 'positive' : 'negative'}>
                {row.omega ? `#${row.omegaTournamentId} · ${row.omega.players} players` : `#${row.omegaTournamentId} missing`}
              </Chip>
              <RowButton
                onClick={async () => {
                  setBusy(true)
                  await onUnlink().finally(() => setBusy(false))
                }}
                disabled={busy}
              >
                Unlink
              </RowButton>
            </>
          )}
          <RowButton onClick={onEdit}>Edit</RowButton>
          <RowButton tone="danger" onClick={() => setConfirming(true)}>
            Delete
          </RowButton>
        </div>
      </div>

      <Command command={row.command} />

      {confirming ? (
        <div className="mt-3.75 border border-negative bg-ground-negative px-4 py-3.5">
          <p className="text-ink body-sm">
            Delete this schedule? The tournament that ran in the game is not ours and stays exactly as it is.
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

export const TournamentsPanel = ({ banlists }: { banlists: Banlist[] }) => {
  const [rows, setRows] = useState<ScheduledTournament[] | null>(null)
  const [now, setNow] = useState(0)
  const [formats, setFormats] = useState<PanelFormat[]>([])
  const [omegaBanlists, setOmegaBanlists] = useState<OmegaBanlist[]>([])
  const [upcoming, setUpcoming] = useState(true)
  const [editing, setEditing] = useState<ScheduledTournament | 'new' | null>(null)
  const [linking, setLinking] = useState<ScheduledTournament | null>(null)
  const [error, setError] = useState<string | null>(null)

  const take = (list: ScheduledTournament[]) => {
    setRows(list)
    setNow(readClock())
  }

  const load = (next = upcoming, signal?: AbortSignal) =>
    listTournaments({ upcoming: next }, signal)
      .then(take)
      .catch((failure) => !signal?.aborted && setError(errorText(failure)))

  useEffect(() => {
    const abort = new AbortController()
    listTournaments({ upcoming: true }, abort.signal)
      .then(take)
      .catch((failure) => !abort.signal.aborted && setError(errorText(failure)))
    listFormats(abort.signal).then(setFormats).catch(() => {})
    listOmegaBanlists(abort.signal).then(setOmegaBanlists).catch(() => {})
    return () => abort.abort()
  }, [])

  const swap = (saved: ScheduledTournament) =>
    setRows((current) => current?.map((row) => (row.id === saved.id ? saved : row)) ?? null)

  const act = async (work: Promise<unknown>) => {
    try {
      await work
      await load()
    } catch (failure) {
      setError(errorText(failure))
    }
  }

  return (
    <Row
      index="02"
      title="Scheduled tournaments"
      blurb="Ours, in Postgres, fully editable. The tournament itself is still created by hand in the game client — the row hands back the command to paste."
      action={
        editing === null ? (
          <Button size="sm" onClick={() => setEditing('new')}>
            New tournament
          </Button>
        ) : null
      }
    >
      <div className="grid gap-6">
        {editing !== null ? (
          <TournamentForm
            tournament={editing === 'new' ? null : editing}
            formats={formats}
            banlists={banlists}
            onCancel={() => setEditing(null)}
            onDone={() => {
              setEditing(null)
              setError(null)
              load()
            }}
          />
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: true, label: 'Upcoming' },
            { id: false, label: 'Everything' },
          ].map(({ id, label }) => (
            <button
              key={label}
              type="button"
              aria-pressed={id === upcoming}
              onClick={() => {
                setUpcoming(id)
                setRows(null)
                load(id)
              }}
              className={twMerge(
                'min-h-9 cursor-pointer border px-3.5 signal-tab',
                id === upcoming ? 'border-gold bg-gold text-gold-on' : 'border-surface-400 text-ink-muted hover:border-gold hover:text-gold',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <Notice tone="error">{error}</Notice>

        {rows === null ? (
          <Empty>Loading tournaments…</Empty>
        ) : rows.length === 0 ? (
          <Empty>{upcoming ? 'Nothing scheduled ahead.' : 'No tournament scheduled yet.'}</Empty>
        ) : (
          <List>
            {rows.map((row) => (
              <TournamentRow
                key={row.id}
                row={row}
                now={now}
                onEdit={() => setEditing(row)}
                onDelete={() => act(deleteTournament(row.id))}
                onLink={() => setLinking(row)}
                onUnlink={() => act(unlinkOmega(row.id))}
              />
            ))}
          </List>
        )}

        {rows !== null && rows.length >= 200 ? (
          <p className="text-ink-muted mono-note">The list caps at 200 rows; there is no pagination yet.</p>
        ) : null}
      </div>

      {linking ? (
        <LinkPicker
          schedule={linking}
          omegaBanlists={omegaBanlists}
          onClose={() => setLinking(null)}
          onLinked={(saved) => {
            swap(saved)
            setLinking(null)
          }}
        />
      ) : null}
    </Row>
  )
}
