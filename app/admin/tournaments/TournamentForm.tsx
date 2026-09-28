'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, Button, Field, OptionCard, PageHeader, Panel, SectionHead, Segmented, Select, Switch, TextInput } from '@ui/index'
import { useResource } from '@hooks/index'
import { fromBrt, toBrt } from '@utils/format'
import {
  createTournament,
  getOptions,
  listTournaments,
  panelErrorText,
  updateTournament,
  type PanelFormat,
  type PanelOptions,
  type ScheduledTournament,
} from '@utils/panel'
import { MODES, SYSTEMS, bitsLabel, bitsOf, commandOrder } from './params'

type Draft = {
  formatId: string
  date: string
  time: string
  banlistId: string
  relFrom: string
  relUntil: string
  mode: number
  masterRule: number
  region: string
  duelRule: string
  timer: string
  drawCount: string
  startHand: string
  startLp: string
  extraRules: string
  budget: string
  requiresPass: boolean
  rewardTp: boolean
  tournyMode: number
}

/* Current-format values, which is what a new tournament almost always is. Retro formats come in
   through the format picker. */
const BLANK: Draft = {
  formatId: '',
  date: '',
  time: '20:00',
  banlistId: '',
  relFrom: '',
  relUntil: '',
  mode: 1,
  masterRule: 5,
  region: '1',
  duelRule: '5',
  timer: '180',
  drawCount: '1',
  startHand: '5',
  startLp: '8000',
  extraRules: '0',
  budget: '0.00',
  requiresPass: false,
  rewardTp: false,
  tournyMode: 0,
}

const toDraft = (t: ScheduledTournament): Draft => ({
  formatId: t.formatId === null ? '' : String(t.formatId),
  ...toBrt(t.startsAt),
  banlistId: String(t.banlistId),
  relFrom: t.relFrom ?? '',
  relUntil: t.relUntil ?? '',
  mode: t.mode,
  masterRule: t.masterRule,
  region: String(t.region),
  duelRule: String(t.duelRule),
  timer: String(t.timer),
  drawCount: String(t.drawCount),
  startHand: String(t.startHand),
  startLp: String(t.startLp),
  extraRules: t.extraRules,
  budget: (t.budgetCents / 100).toFixed(2),
  requiresPass: t.requiresPass,
  rewardTp: t.rewardTp,
  tournyMode: t.tournyMode,
})

const cents = (reais: string) => Math.round(Number(reais.replace(',', '.')) * 100)

/* Unannotated on purpose: every field is present, so the command preview can read it as a whole row. */
const toBody = (d: Draft) => ({
  formatId: d.formatId ? Number(d.formatId) : null,
  startsAt: fromBrt(d.date, d.time) ?? undefined,
  banlistId: Number(d.banlistId),
  relFrom: d.relFrom || null,
  relUntil: d.relUntil || null,
  mode: d.mode,
  masterRule: d.masterRule,
  region: Number(d.region),
  duelRule: Number(d.duelRule),
  timer: Number(d.timer),
  drawCount: Number(d.drawCount),
  startHand: Number(d.startHand),
  startLp: Number(d.startLp),
  extraRules: d.extraRules.trim() || '0',
  budgetCents: cents(d.budget),
  requiresPass: d.requiresPass,
  rewardTp: d.rewardTp,
  tournyMode: d.tournyMode,
})

const rangeHint = (options: PanelOptions | undefined, key: string, fallback: string) => {
  const range = options?.ranges[key]
  return range ? `${range.min}–${range.max.toLocaleString('en-US').replace(/,/g, ' ')}` : fallback
}

const load = (id: number | null) => (signal: AbortSignal) =>
  Promise.all([
    getOptions(signal),
    // No single-schedule read in the client util: the list is capped at 200 and holds it.
    id === null ? null : listTournaments({ upcoming: false, limit: 200 }, signal).then((all) => all.find((t) => t.id === id) ?? null),
  ]).then(([options, row]) => ({ options, row }))

export const TournamentForm = ({ id }: { id: number | null }) => {
  const router = useRouter()
  const { data, error: loadError } = useResource(`form:${id}`, load(id))
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const options = data?.options
  const d: Draft = draft ?? (data?.row ? toDraft(data.row) : { ...BLANK, banlistId: String(options?.banlists[0]?.id ?? '') })
  const set = (patch: Partial<Draft>) => setDraft({ ...d, ...patch })
  const format: PanelFormat | undefined = options?.formats.find((f) => String(f.id) === d.formatId)
  const fromFormat = (field: 'banlistId' | 'relFrom' | 'relUntil') => {
    if (!format) return undefined
    const value = field === 'banlistId' ? String(format.banlist?.id ?? '') : (format[field] ?? '')
    return d[field] === value ? `From ${format.name}` : undefined
  }

  const pickFormat = (formatId: string) => {
    const next = options?.formats.find((f) => String(f.id) === formatId)
    set({
      formatId,
      ...(next ? { banlistId: String(next.banlist?.id ?? d.banlistId), relFrom: next.relFrom ?? '', relUntil: next.relUntil ?? '' } : {}),
    })
  }

  const startsAt = fromBrt(d.date, d.time)
  const body = toBody(d)
  const bits = bitsOf(d.extraRules)
  const drawWarn = Number(d.drawCount) > 1
  const banlist = options?.banlists.find((b) => String(b.id) === d.banlistId)

  const save = () => {
    if (!startsAt) return setError('Pick a start date and time.')
    setSaving(true)
    setError(null)
    const request = id === null ? createTournament(body) : updateTournament(id, body)
    request.then(
      () => router.push('/admin/tournaments'),
      (e) => {
        setError(panelErrorText(e))
        setSaving(false)
      },
    )
  }

  if (id !== null && data && !data.row) return <Alert tone="negative" title={`No schedule #${id}`}>It may have been deleted.</Alert>

  return (
    <>
      <PageHeader
        flush
        eyebrow={id === null ? 'Schedule · New tournament' : `Schedule · #${id}`}
        title={id === null ? 'New tournament' : `Edit tournament #${id}`}
        lead={
          id === null
            ? 'Save the schedule and the server hands back the createtourny command to paste into the client.'
            : 'Saving recomputes the command. The link to the Omega tournament is kept.'
        }
      />

      {loadError ? <Alert tone="negative" title="Couldn't read the form options">{panelErrorText(loadError)}</Alert> : null}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Panel label="Format and start" className="flex flex-col gap-5 [--edge:var(--color-line-mid)]">
            <SectionHead compact num="01">Format and start</SectionHead>
            <div className="grid grid-cols-1 gap-5 min-[720px]:grid-cols-2">
              <Field label="Format" hint="Fills the banlist and card window. Anything you change below wins.">
                <Select
                  block
                  aria-label="Format"
                  value={d.formatId}
                  onChange={(e) => pickFormat(e.target.value)}
                  options={[
                    { value: '', label: 'No format' },
                    ...(options?.formats ?? []).map((f) => ({
                      value: String(f.id),
                      label: `${f.name} · ${f.banlist?.name ?? '?'}${f.relUntil ? ` · until ${f.relUntil}` : ''}`,
                    })),
                  ]}
                />
              </Field>
              <Field label="Starts at" hint={startsAt ? `Your time (BRT). Saved as ${startsAt}` : 'Your time (BRT).'}>
                <span className="flex gap-2">
                  <TextInput prefix="Date" type="date" aria-label="Start date" value={d.date} onChange={(e) => set({ date: e.target.value })} plateClassName="flex-1" />
                  <TextInput prefix="Time" type="time" aria-label="Start time" value={d.time} onChange={(e) => set({ time: e.target.value })} plateClassName="w-40 shrink-0" />
                </span>
              </Field>
            </div>
          </Panel>

          <Panel label="Card pool" className="flex flex-col gap-5 [--edge:var(--color-line-mid)]">
            <SectionHead compact num="02">Card pool</SectionHead>
            <div className="grid grid-cols-1 gap-5 min-[720px]:grid-cols-3">
              <Field label="Banlist" source={fromFormat('banlistId')} hint={banlist ? `From the card database · ${banlist.tournaments} tournaments` : 'From the card database'}>
                <Select
                  block
                  aria-label="Banlist"
                  value={d.banlistId}
                  onChange={(e) => set({ banlistId: e.target.value })}
                  options={(options?.banlists ?? []).map((b) => ({ value: String(b.id), label: `${b.name} · #${b.id}` }))}
                />
              </Field>
              <Field label="Released from" htmlFor="rel-from" source={fromFormat('relFrom')} hint="Empty: no lower bound">
                <TextInput id="rel-from" type="date" value={d.relFrom} onChange={(e) => set({ relFrom: e.target.value })} />
              </Field>
              <Field label="Released until" htmlFor="rel-until" source={fromFormat('relUntil')} hint="Booster release dates, not card dates">
                <TextInput id="rel-until" type="date" value={d.relUntil} onChange={(e) => set({ relUntil: e.target.value })} />
              </Field>
            </div>
          </Panel>

          <Panel label="Duel" className="flex flex-col gap-5 [--edge:var(--color-line-mid)]">
            <SectionHead compact num="03">Duel</SectionHead>
            <div className="grid grid-cols-1 gap-5 min-[720px]:grid-cols-2">
              <Field label="Mode">
                <Segmented label="Mode" value={d.mode} onChange={(mode) => set({ mode })} options={MODES.map((label, value) => ({ value, label }))} />
              </Field>
              <Field label="Master rule" hint="Edison tournaments store MR1. Everything current stores MR5.">
                <Segmented
                  label="Master rule"
                  value={d.masterRule}
                  onChange={(masterRule) => set({ masterRule })}
                  options={(options?.masterRules.map((r) => r.value) ?? [1, 2, 3, 4, 5]).map((value) => ({ value, label: `MR${value}` }))}
                />
              </Field>
              <Field label="Region" hint="Saved as the raw number. OCG banlists store 0, so the label can mislead.">
                <Select
                  block
                  aria-label="Region"
                  value={d.region}
                  onChange={(e) => set({ region: e.target.value })}
                  options={(options?.regions ?? []).map((r) => ({ value: String(r.value), label: r.name ? `${r.value} · ${r.name}` : String(r.value) }))}
                />
              </Field>
              <Field label="Duel rule" hint="0–7. No names are known for these values.">
                <Select
                  block
                  aria-label="Duel rule"
                  value={d.duelRule}
                  onChange={(e) => set({ duelRule: e.target.value })}
                  options={(options?.duelRules ?? []).map((r) => ({ value: String(r.value), label: r.name ?? String(r.value) }))}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-5 min-[720px]:grid-cols-4">
              <Field label="Timer" htmlFor="timer" hint={`${rangeHint(options, 'timer', '0–255')} per turn`}>
                <TextInput id="timer" inputMode="numeric" suffix="s" value={d.timer} onChange={(e) => set({ timer: e.target.value })} />
              </Field>
              <Field
                label="Draw count"
                htmlFor="draw"
                warn={drawWarn}
                hint={`${rangeHint(options, 'drawCount', '0–31')}.${drawWarn ? ' Above 1 may not survive the game’s storage.' : ''}`}
              >
                <TextInput id="draw" inputMode="numeric" warn={drawWarn} value={d.drawCount} onChange={(e) => set({ drawCount: e.target.value })} />
              </Field>
              <Field label="Start hand" htmlFor="hand" hint={rangeHint(options, 'startHand', '0–31')}>
                <TextInput id="hand" inputMode="numeric" value={d.startHand} onChange={(e) => set({ startHand: e.target.value })} />
              </Field>
              <Field label="Start LP" htmlFor="lp" hint={rangeHint(options, 'startLp', '0–102 000')}>
                <TextInput id="lp" inputMode="numeric" value={d.startLp} onChange={(e) => set({ startLp: e.target.value })} />
              </Field>
            </div>
          </Panel>

          <Panel label="Extra rules" className="flex flex-col gap-5 [--edge:var(--color-line-mid)]">
            <SectionHead compact num="04" end="Combinations real tournaments use · newest first">Extra rules</SectionHead>
            <div role="radiogroup" aria-label="Extra rules preset" className="grid grid-cols-1 gap-3 min-[720px]:grid-cols-2">
              {(options?.extraRulesPresets ?? []).map((preset) => (
                <OptionCard
                  key={preset.value}
                  checked={preset.value === d.extraRules.trim()}
                  onClick={() => set({ extraRules: preset.value })}
                  className="flex flex-col gap-1.5 px-4 py-3.5"
                >
                  <span className="flex w-full items-center gap-2.5">
                    <span className="flex-1 text-[15px] font-bold">{preset.banlists.slice(0, 2).join(', ') || 'No banlist'}{preset.banlists.length > 2 ? ` +${preset.banlists.length - 2}` : ''}</span>
                    <span className="text-gold signal-sm">{preset.tournaments} {preset.tournaments === 1 ? 'tournament' : 'tournaments'}</span>
                  </span>
                  <span className="text-ink-dim data">{bitsLabel(preset.bits)}</span>
                </OptionCard>
              ))}
            </div>
            <Field
              label="Value sent"
              htmlFor="extra"
              warn={bits === null}
              hint={bits === null ? 'Not a number. Type decimal or 0x…' : `${bitsLabel(bits)}. A uint64 bitmask, kept as a string. Type decimal or 0x… for a custom value; no bit has a known name yet.`}
            >
              <TextInput id="extra" mono warn={bits === null} value={d.extraRules} onChange={(e) => set({ extraRules: e.target.value })} />
            </Field>
          </Panel>

          <Panel label="Event" className="flex flex-col gap-5 [--edge:var(--color-line-mid)]">
            <SectionHead compact num="05">Event</SectionHead>
            <div className="grid grid-cols-1 gap-5 min-[720px]:grid-cols-2">
              <Field label="System">
                <Segmented label="Tournament system" value={d.tournyMode} onChange={(tournyMode) => set({ tournyMode })} options={SYSTEMS.map((label, value) => ({ value, label }))} />
              </Field>
              <Field label="Budget" htmlFor="budget" hint={`Sent as ${Number.isFinite(body.budgetCents) ? body.budgetCents : '?'} cents`}>
                <TextInput id="budget" prefix="R$" inputMode="decimal" value={d.budget} onChange={(e) => set({ budget: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-5 min-[720px]:grid-cols-2">
              <Switch
                checked={d.requiresPass}
                onChange={(requiresPass) => set({ requiresPass })}
                label="Requires battlepass"
                hint="Eligible while the duelist’s pass date is still in the future."
              />
              <Switch checked={d.rewardTp} onChange={(rewardTp) => set({ rewardTp })} label="Reward TP" hint="Tournament points for the results." />
            </div>
          </Panel>
        </div>

        <aside className="flex flex-col gap-5 xl:sticky xl:top-6">
          <Panel tone="steel" title="Command order" meta="16 arguments" className="[--edge:var(--color-line-mid)]">
            <ol className="flex flex-col">
              {commandOrder({ ...body, banlistName: null }).map((row, i) => (
                <li key={row.label} className="flex h-7.5 items-center gap-3 border-t border-line-mid">
                  <span className="w-5 text-gold signal-sm">{String(i + 1).padStart(2, '0')}</span>
                  <span className="flex-1 text-[13px] text-ink-dim">{row.label}</span>
                  <span className="text-ink data">{row.value}</span>
                </li>
              ))}
            </ol>
            <div className="mt-4.5 flex flex-col gap-1.5 bg-space-000 px-4 py-3.5">
              <span className="text-ink-dim signal-sm">Command</span>
              <span className="text-[13px] leading-5 text-ink-dim">The server builds it when you save. Copy it from the schedule, never retype it.</span>
            </div>
          </Panel>
          {error ? <Alert tone="negative" title="Not saved">{error}</Alert> : null}
          <div className="flex gap-4">
            <Button size="mono-md" className="flex-1" disabled={saving || !options} onClick={save}>
              {id === null ? 'Schedule tournament' : 'Save changes'}
            </Button>
            <Button href="/admin/tournaments" variant="secondary" size="mono-md">Cancel</Button>
          </div>
        </aside>
      </div>
    </>
  )
}
