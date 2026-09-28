'use client'

import { useState } from 'react'
import { Alert, Button, Dialog, FactGrid, Field, Mark, OptionCard, RadioDot, Segmented, Select, Switch, TextInput } from '@ui/index'
import { useResource } from '@hooks/index'
import { count, dayLabel, dayTime, isoDay, timeLabel } from '@utils/format'
import {
  linkOmega,
  listOmegaBanlists,
  listOmegaTournaments,
  panelErrorText,
  type OmegaQuery,
  type OmegaTournament,
  type ScheduledTournament,
} from '@utils/panel'
import { MODES, poolLabel } from './params'

type Status = 'any' | 'live' | 'finished'

const nextDay = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)

/** Same timer, LP, master rule and card window as the schedule: what confirms it's the right tournament. */
const checks = (schedule: ScheduledTournament, omega: OmegaTournament) => {
  const { timer, startingLp, masterRule } = omega.settings
  const until = omega.cardPool.releasedUntil?.slice(0, 10) ?? null
  return [
    timer === schedule.timer ? { ok: true, text: `Timer ${timer} s` } : { ok: false, text: `Timer ${timer ?? '?'} s, not ${schedule.timer}` },
    startingLp === schedule.startLp
      ? { ok: true, text: `LP ${count(schedule.startLp)}` }
      : { ok: false, text: `LP ${startingLp ?? '?'}, not ${count(schedule.startLp)}` },
    masterRule === schedule.masterRule ? { ok: true, text: `MR${masterRule}` } : { ok: false, text: `MR${masterRule ?? '?'}, not MR${schedule.masterRule}` },
    until === schedule.relUntil
      ? { ok: true, text: `Pool ${until ? `until ${until}` : 'any date'}` }
      : { ok: false, text: `Pool until ${until ?? 'any'}, not ${schedule.relUntil ?? 'any'}` },
  ]
}

const GRID = 'grid-cols-[24px_92px_170px_110px_minmax(0,1fr)_150px]'

type Page = { rows: OmegaTournament[]; cursor: string | null; readAt: number }

export const LinkDialog = ({ schedule, onClose, onLinked }: { schedule: ScheduledTournament; onClose: () => void; onLinked: () => void }) => {
  const day = isoDay(schedule.startsAt)
  const [id, setId] = useState('')
  const [banlist, setBanlist] = useState(schedule.banlistName ?? '')
  const [from, setFrom] = useState(day)
  const [to, setTo] = useState(nextDay(day))
  const [status, setStatus] = useState<Status>('any')
  const [unlinked, setUnlinked] = useState(false)
  const [picked, setPicked] = useState<number | null>(null)
  const [more, setMore] = useState<Page[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const banlists = useResource('omega-banlists', listOmegaBanlists)
  const query: OmegaQuery = /^\d+$/.test(id.trim())
    ? { id: Number(id.trim()) }
    : {
        banlist: banlist || undefined,
        // `to` is exclusive; both are BRT days.
        from: from ? `${from}T00:00:00-03:00` : undefined,
        to: to ? `${to}T00:00:00-03:00` : undefined,
        status: status === 'any' ? undefined : status,
        unlinked: unlinked || undefined,
      }
  const key = JSON.stringify(query)
  const first = useResource(key, (signal) =>
    listOmegaTournaments(query, signal).then((page) => ({ rows: page.tournaments, cursor: page.nextCursor, readAt: Date.now() })),
  )

  // Extra pages belong to the query they were loaded for.
  const [moreKey, setMoreKey] = useState(key)
  if (moreKey !== key) {
    setMoreKey(key)
    setMore([])
  }

  const pages = first.data ? [first.data, ...more] : []
  const rows = pages.flatMap((page) => page.rows)
  const cursor = pages.at(-1)?.cursor ?? null
  const readAt = first.data?.readAt

  const loadMore = () => {
    if (!cursor) return
    setBusy(true)
    listOmegaTournaments({ ...query, cursor })
      .then((page) => setMore((m) => [...m, { rows: page.tournaments, cursor: page.nextCursor, readAt: Date.now() }]))
      .catch((e) => setError(panelErrorText(e)))
      .finally(() => setBusy(false))
  }

  const link = () => {
    if (picked === null) return
    setBusy(true)
    setError(null)
    linkOmega(schedule.id, picked).then(onLinked, (e) => {
      setError(panelErrorText(e))
      setBusy(false)
    })
  }

  const banlistOptions = [
    { value: '', label: 'Any banlist' },
    ...(banlists.data ?? []).map((b) => ({ value: b.banlist, label: `${b.banlist} · ${count(b.tournaments)}` })),
    ...(banlist && !banlists.data?.some((b) => b.banlist === banlist) ? [{ value: banlist, label: banlist }] : []),
  ]

  return (
    <Dialog
      open
      onClose={onClose}
      eyebrow={`Schedule #${schedule.id}`}
      title="Link the tournament that ran"
      description="The client doesn't know about schedules, so pick the Omega tournament yourself. Nothing in Omega changes."
      footer={
        <>
          <span className="flex-1 text-ink-muted caption">Linking twice is safe. Unlink any time from the schedule.</span>
          <Button variant="ghost" size="mono-md" onClick={onClose}>Cancel</Button>
          <Button size="mono-md" disabled={picked === null || busy} onClick={link}>
            {picked === null ? 'Pick a tournament' : `Link #${picked}`}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <FactGrid
          columns={6}
          items={[
            { label: 'Scheduled', value: dayTime(schedule.startsAt) },
            { label: 'Banlist', value: schedule.banlistName ?? `#${schedule.banlistId}` },
            { label: 'Mode', value: `${MODES[schedule.mode]} · MR${schedule.masterRule}` },
            { label: 'Timer', value: `${schedule.timer} s` },
            { label: 'Start LP', value: count(schedule.startLp) },
            { label: 'Card pool', value: poolLabel(schedule.relFrom, schedule.relUntil) },
          ]}
        />

        <div className="grid grid-cols-1 items-end gap-4 min-[720px]:grid-cols-2 lg:grid-cols-[1.1fr_1fr_0.8fr_0.8fr_auto]">
          <Field label="Exact ID" htmlFor="link-id">
            <TextInput id="link-id" prefix="#" placeholder="Ignores other filters" inputMode="numeric" value={id} onChange={(e) => setId(e.target.value)} />
          </Field>
          <Field label="Banlist in game">
            <Select block options={banlistOptions} value={banlist} onChange={(e) => setBanlist(e.target.value)} aria-label="Banlist in game" />
          </Field>
          <Field label="From" htmlFor="link-from">
            <TextInput id="link-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To" htmlFor="link-to">
            <TextInput id="link-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date, exclusive" />
          </Field>
          <Field label="Status">
            <Segmented
              label="Status"
              value={status}
              onChange={setStatus}
              options={[
                { value: 'any', label: 'Any' },
                { value: 'live', label: 'Live' },
                { value: 'finished', label: 'Finished' },
              ]}
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Switch checked={unlinked} onChange={setUnlinked} label="Hide tournaments already linked" quiet />
          <span className="flex-1" />
          <span className="text-ink-muted signal-sm">
            {rows.length} candidates · newest first{readAt ? ` · read ${timeLabel(new Date(readAt))}` : ''}
          </span>
        </div>

        {first.error ? <Alert tone="negative" title="Couldn't read Omega">{panelErrorText(first.error)}</Alert> : null}
        {error ? <Alert tone="negative" title="Not linked">{error}</Alert> : null}

        <div className="overflow-x-auto">
          <div role="radiogroup" aria-label="Omega tournaments" className="flex min-w-220 flex-col gap-2">
            <div className={`grid ${GRID} gap-4 px-4.5 text-ink-muted signal-sm`}>
              <span />
              <span>Omega ID</span>
              <span>Ran (BRT)</span>
              <span>Players</span>
              <span>Against schedule #{schedule.id}</span>
              <span>Linked to</span>
            </div>
            {rows.map((omega) => {
              const taken = omega.linkedTo !== null && omega.linkedTo !== schedule.id
              const on = picked === omega.id
              return (
                <OptionCard
                  key={omega.id}
                  checked={on}
                  disabled={taken}
                  onClick={() => setPicked(omega.id)}
                  className={`grid ${GRID} items-center gap-4 px-4.5 py-4 text-sm`}
                >
                  <RadioDot checked={on} />
                  <span className="flex flex-col gap-1">
                    <span className="text-[15px] text-ink data">#{omega.id}</span>
                    <span className={`signal-sm ${omega.status === 'live' ? 'text-crimson-lift' : 'text-ink-dim'}`}>
                      {omega.status === 'live' ? 'Live' : 'Finished'}
                    </span>
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="font-bold">{omega.startedAt ? dayLabel(omega.startedAt) : '—'}</span>
                    <span className="text-[13px] text-ink-dim">
                      {omega.startedAt ? timeLabel(omega.startedAt) : '?'} → {omega.endedAt ? timeLabel(omega.endedAt) : 'running'}
                    </span>
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="font-bold">{omega.players} players</span>
                    <span className="text-[13px] text-ink-dim">{omega.rounds} rounds</span>
                  </span>
                  <span className="flex flex-wrap gap-x-3.5 gap-y-1.5">
                    {checks(schedule, omega).map((check) => (
                      <Mark key={check.text} tone={check.ok ? 'ok' : 'warn'}>{check.text}</Mark>
                    ))}
                  </span>
                  <span className="text-[13px] text-ink-dim">{omega.linkedTo === null ? '—' : `Schedule #${omega.linkedTo}`}</span>
                </OptionCard>
              )
            })}
            {first.data && rows.length === 0 ? (
              <p className="border border-dashed border-line-mid px-4 py-6 text-center text-ink-muted body-sm">
                No Omega tournament matches. Widen the dates or clear the banlist.
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Button variant="secondary" size="mono-md" disabled={!cursor || busy} onClick={loadMore}>
            {cursor ? 'Load more' : 'End of the list'}
          </Button>
          <span className="text-ink-muted caption">Pages count hidden, linked tournaments too, so a short page isn&apos;t the end of the list.</span>
        </div>
      </div>
    </Dialog>
  )
}
