'use client'

import { useState } from 'react'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'
import { Alert, Button, Chip, Coin, Field, FilterChip, PageHeader, Panel, Switch, TextArea, TextInput } from '@ui/index'
import { useResource } from '@hooks/index'
import { count, dayLabel, timeLabel } from '@utils/format'
import { createPassSeason, listPassSeasons, panelErrorText, type PassFormat } from '@utils/panel'
import { brtLocal, passState, premiumLabel } from './season'

const FORMATS: PassFormat[] = ['TCG', 'Genesys']

const BLANK = {
  code: '',
  name: '',
  description: '',
  startsAt: '',
  endsAt: '',
  xpPerLevel: '1000',
  premiumPrice: '',
  formats: FORMATS,
  premiumOmegaPass: true,
  active: false,
}

const load = (signal: AbortSignal) => listPassSeasons(signal).then((seasons) => ({ seasons, readAt: Date.now() }))

const BattlepassSeasonsPage = () => {
  const { data, error: loadError, reload } = useResource('pass-seasons', load)
  const [form, setForm] = useState(BLANK)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (patch: Partial<typeof BLANK>) => setForm({ ...form, ...patch })

  const now = data?.readAt ?? 0
  const seasons = [...(data?.seasons ?? [])].sort((a, b) => b.startsAt.localeCompare(a.startsAt))

  const create = () => {
    const startsAt = brtLocal(form.startsAt)
    const endsAt = brtLocal(form.endsAt)
    if (!startsAt || !endsAt) return setError('Pick when the season starts and ends.')
    setBusy(true)
    setError(null)
    createPassSeason({
      code: form.code.trim(),
      name: form.name.trim(),
      description: form.description,
      startsAt,
      endsAt,
      xpPerLevel: Number(form.xpPerLevel),
      premiumPrice: form.premiumPrice.trim() ? Number(form.premiumPrice) : null,
      formats: form.formats,
      premiumOmegaPass: form.premiumOmegaPass,
      active: form.active,
    })
      .then(() => {
        setForm(BLANK)
        reload()
      })
      .catch((e) => setError(panelErrorText(e)))
      .finally(() => setBusy(false))
  }

  return (
    <>
      <PageHeader
        flush
        eyebrow={`Economy · ${seasons.length} seasons · XP synced every 15 min`}
        title="Battlepass"
        lead="Each season has its own window, XP curve, rules and free and premium tracks. Its code is the battlepass’s own, not the ranked season’s."
        end={<Button href="/admin/battlepass/player" variant="secondary" size="mono-md">Look up a duelist</Button>}
      />
      {loadError ? <Alert tone="negative" title="Couldn't read the seasons">{panelErrorText(loadError)}</Alert> : null}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-4">
          {seasons.map((s) => {
            const state = passState(s, now)
            const stats = [
              ['Participants', count(s.stats?.participants ?? 0)],
              ['Premium', count(s.stats?.premium ?? 0)],
              ['Claims', count(s.stats?.claims ?? 0)],
              ['Last XP sync', s.syncedAt ? (Date.parse(s.syncedAt) > now - 86_400_000 ? timeLabel(s.syncedAt) : dayLabel(s.syncedAt)) : '—'],
            ]
            return (
              <Link
                key={s.code}
                href={`/admin/battlepass/${encodeURIComponent(s.code)}`}
                className={twMerge(
                  'cut notch flex flex-col gap-4.5 p-6 text-ink [--cut:var(--cut-lg)] hover:-translate-y-0.5 motion-safe:transition-transform motion-safe:duration-120',
                  state.running ? '[--fill:var(--color-steel)]' : 'hover:[--fill:var(--color-surface-200)]',
                )}
              >
                <div className="flex flex-wrap items-center gap-3.5">
                  <span className="text-ink-dim data">{s.code}</span>
                  <h2 className="flex-1 display-2">{s.name}</h2>
                  <Chip tone={state.tone}>{state.label}</Chip>
                </div>
                <div className="flex flex-wrap gap-6 text-sm text-ink-dim">
                  <span><span className="text-ink-muted signal-sm">Window </span> {dayLabel(s.startsAt)} → {dayLabel(s.endsAt)}</span>
                  <span><span className="text-ink-muted signal-sm">XP from </span> {s.formats.join(', ')}</span>
                  <span><span className="text-ink-muted signal-sm">Premium </span> {premiumLabel(s)}</span>
                </div>
                <dl className="grid grid-cols-2 gap-px bg-line-mid min-[720px]:grid-cols-4">
                  {stats.map(([label, value]) => (
                    <div key={label} className={twMerge('flex flex-col gap-2 px-4 py-3.5', state.running ? 'bg-steel' : 'bg-surface-100')}>
                      <dt className="text-ink-dim signal-sm">{label}</dt>
                      <dd className="text-[28px] leading-none stat">{value}</dd>
                    </div>
                  ))}
                </dl>
              </Link>
            )
          })}
          {data && seasons.length === 0 ? <p className="text-ink-muted body-sm">No seasons yet.</p> : null}
          <span className="text-ink-muted caption">A season can&apos;t be deleted once anyone has claimed a reward. Turn it off instead.</span>
        </div>

        <Panel label="New season" className="flex flex-col gap-4 [--edge:var(--color-line-mid)]">
          <h2 className="display-3">New season</h2>
          <div className="flex flex-col gap-1.5">
            <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-3">
              <Field label="Code" htmlFor="bp-code">
                <TextInput id="bp-code" mono placeholder="tcg-4" value={form.code} onChange={(e) => set({ code: e.target.value.toLowerCase() })} />
              </Field>
              <Field label="Name" htmlFor="bp-name">
                <TextInput id="bp-name" placeholder="Season 4" value={form.name} onChange={(e) => set({ name: e.target.value })} />
              </Field>
            </div>
            <span className="text-ink-muted caption">The code can&apos;t change after you create it.</span>
          </div>
          <Field label="Description" htmlFor="bp-desc">
            <TextArea id="bp-desc" rows={2} placeholder="Shown to duelists" value={form.description} onChange={(e) => set({ description: e.target.value })} />
          </Field>
          <div className="flex flex-col gap-1.5">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Starts" htmlFor="bp-start">
                <TextInput id="bp-start" type="datetime-local" value={form.startsAt} onChange={(e) => set({ startsAt: e.target.value })} />
              </Field>
              <Field label="Ends" htmlFor="bp-end">
                <TextInput id="bp-end" type="datetime-local" value={form.endsAt} onChange={(e) => set({ endsAt: e.target.value })} />
              </Field>
            </div>
            <span className="text-ink-muted caption">XP only counts inside this window. BRT, saved as UTC.</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="XP per level" htmlFor="bp-xp">
              <TextInput id="bp-xp" inputMode="numeric" value={form.xpPerLevel} onChange={(e) => set({ xpPerLevel: e.target.value })} />
            </Field>
            <Field label="Premium price" htmlFor="bp-price">
              <TextInput id="bp-price" inputMode="numeric" prefix={<Coin className="h-4 w-3.5" />} placeholder="Not sold" value={form.premiumPrice} onChange={(e) => set({ premiumPrice: e.target.value })} />
            </Field>
          </div>
          <Field label="Ranked queues that give XP">
            <div role="group" aria-label="Formats" className="flex gap-1.5">
              {FORMATS.map((f) => (
                <FilterChip
                  key={f}
                  label={f}
                  pressed={form.formats.includes(f)}
                  onClick={() => set({ formats: form.formats.includes(f) ? form.formats.filter((x) => x !== f) : [...form.formats, f] })}
                />
              ))}
            </div>
          </Field>
          <Switch
            checked={form.premiumOmegaPass}
            onChange={(premiumOmegaPass) => set({ premiumOmegaPass })}
            label="Omega pass unlocks premium"
            hint="The game’s paid pass, while its date is in the future."
          />
          <Switch checked={form.active} onChange={(active) => set({ active })} label="Visible to duelists" hint="Off until the track is ready." />
          {error ? <Alert tone="negative" title="Not created">{error}</Alert> : null}
          <Button size="mono-md" disabled={busy || !form.code.trim() || !form.name.trim()} onClick={create}>
            Create season
          </Button>
        </Panel>
      </div>
    </>
  )
}

export default BattlepassSeasonsPage
