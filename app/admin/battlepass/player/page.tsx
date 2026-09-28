'use client'

import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Alert, Avatar, Button, Chip, FactGrid, Field, Icon, PageHeader, Panel, SectionHead, Select, Switch, TextInput } from '@ui/index'
import { useResource } from '@hooks/index'
import { count, dayLabel, timeLabel } from '@utils/format'
import { adjustPassXp, getPassProgress, getPassSeason, listPassSeasons, panelErrorText, setPassPremium } from '@utils/panel'
import { getProfile } from '@utils/profile'

const SNOWFLAKE = /^\d{15,20}$/

type Cell = { level: number; state: 'claimed' | 'ready' | 'locked' | 'none' }

const CELL = {
  claimed: 'bg-ground-cyan text-cyan shadow-[inset_0_0_0_2px_var(--color-cyan)]',
  ready: 'bg-surface-200 text-ink shadow-[inset_0_0_0_1px_var(--color-line-strong)]',
  locked: 'bg-surface-100 text-ink-muted shadow-[inset_0_0_0_1px_var(--color-line)]',
  none: 'text-line-mid',
}
const STATE_LABEL = { claimed: 'claimed', ready: 'ready to claim', locked: 'locked', none: 'no reward' }

const load = (code: string, userId: string) => (signal: AbortSignal) =>
  Promise.all([
    getPassProgress(code, userId, signal),
    getPassSeason(code, signal),
    getProfile(userId, undefined, 1).catch(() => null),
  ]).then(([progress, season, profile]) => ({ progress, season, profile, readAt: Date.now() }))

const BattlepassPlayerPage = () => {
  const seasons = useResource('pass-seasons', listPassSeasons)
  const [input, setInput] = useState('')
  const [picked, setPicked] = useState('')
  const [target, setTarget] = useState<{ code: string; userId: string } | null>(null)
  const { data, error: loadError, reload } = useResource(target ? `${target.code}:${target.userId}` : null, load(target?.code ?? '', target?.userId ?? ''))
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [notice, setNotice] = useState<{ tone: 'positive' | 'negative'; title: string; body?: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const code = picked || seasons.data?.find((s) => s.active)?.code || seasons.data?.[0]?.code || ''

  const act = (request: Promise<unknown>, done: string, after?: () => void) => {
    setBusy(true)
    setNotice(null)
    request
      .then(() => {
        setNotice({ tone: 'positive', title: done })
        after?.()
        reload()
      })
      .catch((e) => setNotice({ tone: 'negative', title: 'That didn’t go through', body: panelErrorText(e) }))
      .finally(() => setBusy(false))
  }

  const p = data?.progress
  const track = data?.season.track ?? []
  const claimed = new Set(p?.claimed.map((c) => `${c.level}:${c.track}`))
  const cells = (premium: boolean): Cell[] =>
    track.map((t) => {
      const reward = premium ? t.premium : t.free
      if (!reward) return { level: t.level, state: 'none' }
      if (claimed.has(`${t.level}:${premium ? 'premium' : 'free'}`)) return { level: t.level, state: 'claimed' }
      return { level: t.level, state: t.level <= (p?.level ?? 0) && (!premium || p?.premium) ? 'ready' : 'locked' }
    })
  const rows = (premium: boolean) => {
    const all = cells(premium)
    return Array.from({ length: Math.ceil(all.length / 16) }, (_, i) => all.slice(i * 16, i * 16 + 16))
  }
  const floor = p && p.level > 0 ? (track[p.level - 1]?.xp ?? 0) : 0
  const next = p ? track[p.level] : undefined
  const progress = p && next ? Math.min(100, Math.max(0, ((p.xp - floor) / (next.xp - floor)) * 100)) : 100
  const profile = data?.profile
  const name = profile?.displayName ?? profile?.handle ?? null
  const passDue = profile?.hasPass && profile.passDueDate ? `Until ${dayLabel(profile.passDueDate)}` : 'No'

  return (
    <>
      <PageHeader flush eyebrow={data ? `Battlepass · Read ${timeLabel(new Date(data.readAt))}` : 'Battlepass'} title="Duelist progress" />

      <form
        className="grid grid-cols-1 items-end gap-3 min-[720px]:grid-cols-[minmax(0,1fr)_260px_auto]"
        onSubmit={(e) => {
          e.preventDefault()
          if (SNOWFLAKE.test(input.trim()) && code) setTarget({ code, userId: input.trim() })
        }}
      >
        <Field label="Duelist ID" htmlFor="bp-user">
          <TextInput id="bp-user" mono prefix={<Icon name="search" size={16} />} value={input} onChange={(e) => setInput(e.target.value)} />
        </Field>
        <Field label="Season">
          <Select
            block
            aria-label="Season"
            value={code}
            onChange={(e) => setPicked(e.target.value)}
            options={(seasons.data ?? []).map((s) => ({ value: s.code, label: `${s.code} · ${s.name}` }))}
          />
        </Field>
        <Button type="submit" variant="secondary" size="mono-md">Look up</Button>
      </form>

      {loadError ? <Alert tone="negative" title="Couldn't read the progress">{panelErrorText(loadError)}</Alert> : null}
      {notice ? <Alert tone={notice.tone} title={notice.title}>{notice.body}</Alert> : null}

      {p && target ? (
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex min-w-0 flex-col gap-6">
            <section className="cut notch flex flex-col gap-6 p-5 [--cut:var(--cut-lg)] [--fill:var(--color-steel)] min-[720px]:p-7">
              <div className="flex flex-wrap items-center gap-4">
                <Avatar name={name ?? p.userId} src={profile?.avatar} cosmetics={profile?.cosmetics} size="lg" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-lg font-bold">{name ?? 'Unknown name'}</span>
                  <span className="text-ink-dim data">{p.userId}</span>
                </div>
                {p.premium ? (
                  <Chip tone="gold">Premium · {p.premiumSource === 'omega_pass' ? 'Omega pass' : 'Site'}</Chip>
                ) : (
                  <Chip>Free track</Chip>
                )}
              </div>
              <div className="flex flex-wrap items-end gap-7">
                <div className="flex flex-col gap-2">
                  <span className="text-ink-dim signal-sm">Level</span>
                  <span className="display-hero">{p.level}</span>
                </div>
                <div className="flex min-w-60 flex-1 flex-col gap-2.5 pb-1.5">
                  <div className="flex items-baseline gap-2.5">
                    <span className="text-[28px] leading-none stat">{count(p.xp)}</span>
                    <span className="text-ink-dim signal-sm">XP</span>
                    <span className="flex-1" />
                    <span className="text-[13px] text-ink-dim">{next ? `Level ${next.level} at ${count(next.xp)}` : 'Top level'}</span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label={next ? `Progress to level ${next.level}` : 'Top level reached'}
                    aria-valuemin={floor}
                    aria-valuemax={next?.xp ?? p.xp}
                    aria-valuenow={p.xp}
                    className="h-2.5 overflow-hidden rounded-xs bg-surface-100"
                  >
                    <div className="h-full rounded-xs bg-cyan" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              </div>
            </section>

            <Panel label="Rewards claimed" className="flex flex-col gap-4.5 [--edge:var(--color-line-mid)]">
              <SectionHead
                compact
                num="01"
                end={
                  <span className="flex flex-wrap gap-4">
                    {(['claimed', 'ready', 'locked'] as const).map((state) => (
                      <span key={state} className="inline-flex items-center gap-1.5">
                        <span className={twMerge('size-3.5', CELL[state])} />
                        <span className="text-ink-muted signal-sm">{state === 'ready' ? 'Ready' : state === 'claimed' ? 'Claimed' : 'Locked'}</span>
                      </span>
                    ))}
                  </span>
                }
              >
                Rewards claimed
              </SectionHead>
              <div className="overflow-x-auto">
                <div className="flex min-w-160 flex-col gap-1">
                  {([false, true] as const).map((premium) =>
                    rows(premium).map((row, i) => (
                      <div key={`${premium}-${i}`} className="grid grid-cols-[80px_repeat(16,minmax(0,1fr))] items-center gap-1">
                        <span className="text-ink-muted signal-sm">{i === 0 ? (premium ? 'Premium' : 'Free') : ''}</span>
                        {row.map((cell) => (
                          <span
                            key={cell.level}
                            aria-label={`Level ${cell.level}, ${STATE_LABEL[cell.state]}`}
                            className={twMerge('flex h-10 items-center justify-center font-mono text-xs font-bold', CELL[cell.state])}
                          >
                            {cell.state === 'none' ? '—' : cell.level}
                          </span>
                        ))}
                      </div>
                    )),
                  )}
                </div>
              </div>
              <span className="text-ink-muted caption">A dash means that level has no reward on that track. XP arrives with the next sync, every 15 minutes.</span>
            </Panel>
          </div>

          <div className="flex flex-col gap-6">
            <Panel label="Premium" className="flex flex-col gap-4.5 [--edge:var(--color-line-mid)]">
              <SectionHead compact num="02">Premium</SectionHead>
              <FactGrid
                columns={2}
                items={[
                  { label: 'Omega pass', value: passDue },
                  { label: 'Site premium', value: p.webPremium ? 'Yes' : 'No' },
                ]}
              />
              <Switch
                checked={p.webPremium}
                disabled={busy}
                onChange={(premium) => act(setPassPremium(target.code, target.userId, premium), premium ? 'Site premium given' : 'Site premium removed')}
                label="Give site premium"
                hint="A courtesy for support cases. The game’s pass isn’t touched."
              />
            </Panel>

            <Panel label="Adjust XP" className="flex flex-col gap-4.5 [--edge:var(--color-line-mid)]">
              <SectionHead compact num="03">Adjust XP</SectionHead>
              <Field label="Amount" htmlFor="xp-amount" hint="Negative removes XP. Never goes below 0.">
                <TextInput id="xp-amount" inputMode="numeric" suffix="XP" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </Field>
              <Field label="Note" htmlFor="xp-note">
                <TextInput id="xp-note" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
              <Button
                size="mono-md"
                disabled={busy || !Number(amount)}
                onClick={() =>
                  act(adjustPassXp(target.code, target.userId, Number(amount), note.trim() || undefined), `XP adjusted by ${amount}`, () => {
                    setAmount('')
                    setNote('')
                  })
                }
              >
                Adjust XP
              </Button>
            </Panel>
          </div>
        </div>
      ) : (
        <p className="text-ink-muted body-sm">{target ? 'Loading…' : 'Type a duelist ID and pick a season.'}</p>
      )}
    </>
  )
}

export default BattlepassPlayerPage
