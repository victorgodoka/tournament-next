'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'
import { useAuth } from '@hooks/index'
import { Button } from '@ui/button'
import { Chip } from '@ui/chip'
import { Coins } from '@ui/coins'
import { Dialog } from '@ui/dialog'
import { Eyebrow } from '@ui/eyebrow'
import { Header } from '@ui/header'
import { Icon } from '@ui/icon'
import { SectionHead } from '@ui/section-head'
import { signIn } from '@utils/auth'
import {
  buyPremium,
  claimAll,
  claimReward,
  getProgress,
  passErrorMessage,
  type PassClaim,
  type PassLevel,
  type PassProgress,
  type PassReward,
  type PassSeason,
  type PassTrack,
} from '@utils/battlepass'
import { ShopApiError, getWallet } from '@utils/shop'
import type { ShopEnum } from '@utils/types'
import { TYPE_ICON } from '@omega/inventory'

/** `soon`/`ended` are a listed season outside its window: no XP, claims still work. */
export type Phase = 'open' | 'soon' | 'ended'
type Data = { season: PassSeason; levels: PassLevel[]; types: ShopEnum[]; phase: Phase } | null
type Status = 'claimable' | 'claimed' | 'next' | 'locked' | 'prem' | 'preview'

const UNIT = 'Duel Points'
const LABEL_CHIP = 'text-[11px] tracking-[0.14em]'
const CARD = 'cut notch [--cut:var(--cut-lg)] [--edge:var(--color-line-mid)] [--fill:var(--color-surface-100)]'
const FORMAT_TONE: Record<string, string> = {
  TCG: 'text-ladder-tcg [--edge:var(--color-ladder-tcg)]',
  Genesys: 'text-ladder-genesys [--edge:var(--color-ladder-genesys)]',
}

const fmt = (n: number) => n.toLocaleString('en-US')
const pad = (n: number) => String(n).padStart(2, '0')
const part = (iso: string, options: Intl.DateTimeFormatOptions, timeZone?: string) => new Date(iso).toLocaleString('en-US', { ...options, timeZone })
/** Season bounds are UTC midnights: read them in UTC so they never shift a day. "Thu 31 Dec". */
const day = (iso: string) => `${part(iso, { weekday: 'short' }, 'UTC')} ${short(iso)}`
const short = (iso: string) => `${part(iso, { day: '2-digit' }, 'UTC')} ${part(iso, { month: 'short' }, 'UTC')}`
/** A claim, in local time. "Wed 08 Oct · 19:42". */
const stamp = (iso: string) =>
  `${part(iso, { weekday: 'short' })} ${part(iso, { day: '2-digit' })} ${part(iso, { month: 'short' })} · ${new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
const list = (items: string[]) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items.at(-1)}` : (items[0] ?? ''))
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`

/** Mono 10px line: the tile footers and column heads. */
const Tag = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <span className={twMerge('text-ink-muted signal-sm', className)}>{children}</span>
)

/** Phone copy, desktop copy. */
const Fit = ({ phone, wide }: { phone: React.ReactNode; wide: React.ReactNode }) => (
  <>
    <span className="min-[720px]:hidden">{phone}</span>
    <span className="max-[719px]:hidden">{wide}</span>
  </>
)

const Bar = ({ pct, className }: { pct: number; className?: string }) => (
  <div className={twMerge('h-1 overflow-hidden rounded-xs bg-line', className)}>
    <div className="h-full rounded-xs bg-cyan" style={{ width: `${Math.round(pct * 100)}%` }} />
  </div>
)

export const BattlepassBrowser = ({ data }: { data: Data }) => {
  const { user } = useAuth()
  const signedIn = !!user
  const code = data?.season.code ?? ''

  const [me, setMe] = useState<PassProgress | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<{ error?: string } | null>(null)
  const [toast, setToast] = useState<{ title: string; sub: string } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const scroller = useRef<HTMLDivElement>(null)
  const scrolled = useRef(false)

  const refresh = (signal?: AbortSignal) =>
    getProgress(code, signal)
      .then(setMe)
      .catch((e) => signal?.aborted || console.error(e))

  useEffect(() => {
    if (!user || !code) return
    const controller = new AbortController()
    getProgress(code, controller.signal)
      .then(setMe)
      .catch((e) => controller.signal.aborted || console.error(e))
    getWallet(controller.signal)
      .then((w) => setBalance(w.balance))
      .catch((e) => controller.signal.aborted || console.error(e))
    return () => controller.abort()
  }, [user, code])

  useEffect(() => () => clearTimeout(timer.current), [])

  /** Open the track a couple of columns before the duelist's level, once. */
  const level = signedIn ? (me?.level ?? 0) : 0
  useEffect(() => {
    const el = scroller.current
    if (!el || !me || scrolled.current) return
    scrolled.current = true
    const col = el.querySelector<HTMLElement>(`[data-level="${Math.max(1, me.level - 2)}"]`)
    if (col) el.scrollLeft = col.offsetLeft - 10
  }, [me])

  if (!data) {
    return (
      <>
        <Header />
        <div className="min-h-dvh w-full bg-space-000 text-ink">
          <div className="mx-auto flex w-[min(1280px,calc(100%-32px))] flex-col gap-4 pt-23 pb-24 min-[720px]:pt-27">
            <Eyebrow rule={false}>Battlepass</Eyebrow>
            <h1 className="display-1 min-[720px]:display-hero">No season running</h1>
            <p className="max-w-155 text-ink-dim body min-[720px]:lead">There’s no battlepass season on right now. Check back when the next one starts.</p>
          </div>
        </div>
      </>
    )
  }

  const { season, levels, types, phase } = data
  const typeBy = new Map(types.map((t) => [t.value, t]))
  const isCurrency = (r: PassReward) => typeBy.get(r.item.type)?.currency ?? r.item.type === 'CURRENCY'
  const typeLabel = (r: PassReward) => (isCurrency(r) ? 'Currency' : (typeBy.get(r.item.type)?.name ?? r.item.type))
  const label = (r: PassReward) => (isCurrency(r) ? `${fmt(r.qty)} ${r.item.name}` : r.qty > 1 ? `${r.qty} × ${r.item.name}` : r.item.name)
  const rewardAt = (lv: number, track: PassTrack) => levels.find((l) => l.level === lv)?.[track] ?? null

  const live = signedIn && !!me
  const maxLevel = me?.maxLevel ?? levels.length
  const xp = me?.xp ?? 0
  const premium = live && me.premium
  const price = season.premiumPrice
  const next = me?.nextLevel ?? null
  /** `levels[].xp` is the total a level needs: the bar runs from the reached level's total to the next one's. */
  const cur = level ? (levels.find((l) => l.level === level)?.xp ?? 0) : 0
  const pct = next ? Math.max(0, Math.min(1, (xp - cur) / (next.xp - cur))) : 1
  const toGo = next ? next.xp - xp : 0

  const claimedKeys = new Set(me?.claimed.map((c) => `${c.level}-${c.track}`))
  const claimableKeys = new Set(me?.claimable.map((c) => `${c.level}-${c.track}`))
  const status = (lv: number, track: PassTrack): Status => {
    if (!live) return 'preview'
    const key = `${lv}-${track}`
    if (claimedKeys.has(key)) return 'claimed'
    if (track === 'premium' && !premium) return 'prem'
    if (claimableKeys.has(key)) return 'claimable'
    return lv === level + 1 ? 'next' : 'locked'
  }

  const freeTotal = levels.filter((l) => l.free).length
  const premTotal = levels.filter((l) => l.premium).length
  const premReached = levels.filter((l) => l.premium && l.level <= level).length
  const premWaiting = premium ? 0 : levels.filter((l) => l.premium && l.level <= level && !claimedKeys.has(`${l.level}-premium`)).length
  const claimable = me?.claimable ?? []
  const cc = live ? claimable.length : 0
  const freeN = claimable.filter((c) => c.track === 'free').length
  const nextReward = levels.find((l) => l.level > level && (l.free || (premium && l.premium)))?.level

  const hist = [...(me?.claimed ?? [])].sort((a, b) => b.claimedAt.localeCompare(a.claimedAt))
  const canAfford = price != null && balance != null && balance >= price
  const formats = list(season.formats)

  const notify = (title: string, sub: string) => {
    clearTimeout(timer.current)
    setToast({ title, sub })
    timer.current = setTimeout(() => setToast(null), 3600)
  }

  /** Mark claims from the response instead of waiting on the public track, and take the newest balance. */
  const applyClaims = (claims: PassClaim[]) => {
    const at = new Date().toISOString()
    const keys = new Set(claims.map((c) => `${c.level}-${c.track}`))
    setMe(
      (m) =>
        m && {
          ...m,
          claimed: [...m.claimed, ...claims.map((c) => ({ level: c.level, track: c.track, itemId: c.itemId, qty: c.qty, claimedAt: at }))],
          claimable: m.claimable.filter((c) => !keys.has(`${c.level}-${c.track}`)),
        },
    )
    const last = claims.findLast((c) => c.grant.balance != null)
    if (last) setBalance(last.grant.balance!)
    return last?.grant.balance
  }

  const fail = (e: unknown) => {
    if (e instanceof ShopApiError && ['ALREADY_CLAIMED', 'PREMIUM_REQUIRED', 'LEVEL_NOT_REACHED'].includes(e.code ?? '')) refresh()
    if (e instanceof ShopApiError && e.code === 'ALREADY_CLAIMED') return
    setError(passErrorMessage(e))
  }

  const claim = (lv: number, track: PassTrack, r: PassReward) => {
    if (busy) return
    setBusy(true)
    setError(null)
    claimReward(code, lv, track)
      .then((res) => {
        const bal = applyClaims([res])
        if (res.grant.currency) notify(`${fmt(res.qty)} ${r.item.name} claimed`, bal != null ? `Balance ${fmt(bal)} DP` : 'Added to your balance.')
        else notify(`${r.item.name} claimed`, res.grant.granted === false ? 'Already in your inventory. Marked as claimed.' : 'Added to your inventory, ready to equip.')
      })
      .catch(fail)
      .finally(() => setBusy(false))
  }

  const takeAll = () => {
    if (busy) return
    setBusy(true)
    setError(null)
    claimAll(code)
      .then(({ claimed }) => {
        if (!claimed.length) {
          notify('Nothing left to claim', 'Everything you reached is already yours.')
          refresh()
          return
        }
        const bal = applyClaims(claimed)
        const gain = claimed.reduce((sum, c) => sum + (c.grant.currency ? c.qty : 0), 0)
        notify(
          `${plural(claimed.length, 'reward')} claimed`,
          gain ? `+${fmt(gain)} Duel Points${bal != null ? ` · balance ${fmt(bal)} DP` : ''}` : 'Added to your inventory.',
        )
      })
      .catch(fail)
      .finally(() => setBusy(false))
  }

  const buy = () => {
    if (busy) return
    setBusy(true)
    buyPremium(code)
      .then((res) => {
        setBalance(res.balance)
        setMe((m) => m && { ...m, premium: true, premiumSource: res.premiumSource })
        setDialog(null)
        notify('Premium track unlocked', `Balance ${fmt(res.balance)} DP · premium rewards you reached are ready.`)
        // The server decides what premium makes claimable.
        refresh()
      })
      .catch((e) => {
        if (e instanceof ShopApiError && e.code === 'ALREADY_PREMIUM') {
          setDialog(null)
          refresh()
        } else setDialog({ error: passErrorMessage(e) })
      })
      .finally(() => setBusy(false))
  }

  const openBuy = () => (signedIn ? setDialog({}) : signIn())

  const tile = (lv: number, track: PassTrack, isNextCol: boolean) => {
    const r = rewardAt(lv, track)
    if (!r) {
      return (
        <div className="flex h-49 items-center justify-center border border-line text-ink-muted signal-sm min-[720px]:h-54">
          No reward
        </div>
      )
    }
    const st = status(lv, track)
    const ready = st === 'claimable'
    const name = label(r)
    const glyph = isCurrency(r) ? 'text-gold' : track === 'premium' ? 'text-azure-lift' : 'text-ink-dim'
    return (
      <div
        className={twMerge(
          'cut notch flex h-49 flex-col transition-transform duration-120 ease-out hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0 min-[720px]:h-54 [--cut:var(--cut-md)] [--edge:var(--color-line-mid)]',
          ready && '[--edge:var(--color-cyan)] [--fill:var(--color-ground-cyan)] [--sw:2px]',
          isNextCol && st === 'next' && '[--edge:var(--color-azure-lift)]',
          ready || st === 'preview' || isNextCol ? '' : st === 'claimed' ? 'opacity-50' : 'opacity-[0.38]',
        )}
      >
        <div
          className={twMerge(
            'notch-clip dots relative m-px grid h-21 shrink-0 place-items-center bg-surface-200 bg-size-[12px_12px] min-[720px]:h-25',
            ready && 'm-0.5 bg-ground-cyan',
          )}
        >
          {!isCurrency(r) ? (
            // eslint-disable-next-line @next/next/no-img-element -- CDN assets of any size; next/image needs known hosts.
            <img src={`/items/${r.item.id}.png`} alt="" className={twMerge('absolute inset-0 size-full object-cover', st === 'claimed' && 'opacity-60')} />
          ) : (
            <Icon
              name={isCurrency(r) ? 'coin' : (TYPE_ICON[r.item.type] ?? 'cards')}
              size={44}
              className={twMerge(glyph, st === 'claimed' ? 'opacity-60' : (st === 'locked' || st === 'prem') && !isNextCol ? 'opacity-70' : '')}
            />
          )}
          {ready ? (
            <span className="cut absolute top-2 left-2 px-2 py-1 font-bold text-cyan-on signal-sm [--cut:var(--cut-xs)] [--edge:var(--color-cyan)] [--fill:var(--color-cyan)] min-[720px]:top-2.5 min-[720px]:left-2.5">
              Ready
            </span>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 px-3 pt-2.5">
          <span className={twMerge('truncate text-[14px] leading-5 font-bold', st === 'claimed' ? 'text-ink-muted' : 'text-ink')}>{name}</span>
          <Tag>{typeLabel(r)}</Tag>
        </div>
        <div className="flex h-14 items-center gap-2 px-3 pb-3">
          {ready ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => claim(lv, track, r)}
              aria-label={`Claim ${name}, level ${lv}, ${track} track`}
              className="cut h-10.5 w-full cursor-pointer text-cyan-on signal-strong transition-colors duration-120 [--edge:var(--color-cyan)] [--fill:var(--color-cyan)] hover:[--edge:var(--color-ink)] hover:[--fill:var(--color-ink)] disabled:cursor-wait"
            >
              Claim
            </button>
          ) : st === 'claimed' ? (
            <>
              <Icon name="check" size={16} className="text-ink-muted" />
              <Tag>Claimed</Tag>
            </>
          ) : st === 'next' ? (
            <div className="flex flex-1 flex-col gap-2">
              <Tag className="font-bold text-cyan">{fmt(toGo)} XP to go</Tag>
              <Bar pct={pct} />
            </div>
          ) : st === 'locked' ? (
            <>
              <Icon name="lock" size={14} className="text-ink-muted" />
              <Tag>
                <Fit phone={`Level ${lv}`} wide={`Reach level ${lv}`} />
              </Tag>
            </>
          ) : st === 'prem' ? (
            <>
              <Icon name="lock" size={14} className="text-gold" />
              <Tag className="text-gold">
                <Fit phone="Premium" wide={lv <= level ? 'Premium' : `Premium · level ${lv}`} />
              </Tag>
            </>
          ) : (
            <Tag className={track === 'premium' ? 'text-gold' : undefined}>
              {track === 'premium' ? <Fit phone="Premium" wide={`Premium · level ${lv}`} /> : `Level ${lv}`}
            </Tag>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <Header
        extra={
          signedIn && balance != null ? (
            <span className="cut my-auto flex h-9 shrink-0 items-center px-3 [--cut:var(--cut-xs)] [--edge:var(--color-surface-200)] [--fill:var(--color-surface-200)]">
              <Coins variant="display" displaySize="bar" amount={balance} unit={UNIT} />
            </span>
          ) : null
        }
      />

      <div className="min-h-dvh w-full overflow-x-clip bg-space-000 bg-[radial-gradient(1100px_420px_at_18%_-8%,rgba(0,253,255,0.06),transparent_62%),radial-gradient(900px_380px_at_88%_-8%,rgba(74,111,216,0.10),transparent_62%)] text-ink">
        <div className="mx-auto w-[min(1280px,calc(100%-32px))] pt-23 pb-24 min-[720px]:pt-27">
          <section className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_480px] lg:gap-12">
            <div className="flex flex-col gap-4 pt-2">
              <Eyebrow rule={false}>
                Battlepass · {season.code} · {phase === 'soon' ? `Starts ${day(season.startsAt)}` : `${phase === 'ended' ? 'Ended' : 'Ends'} ${day(season.endsAt)}`}
              </Eyebrow>
              <h1 className="display-1 min-[720px]:display-hero">{season.name}</h1>
              <p className="max-w-155 text-ink-dim body min-[720px]:lead">
                {season.description ||
                  `Earn XP in ranked ${formats} duels, in tournaments and with your first visit of the day. Reach a level to unlock its free reward, and the premium track adds one more.`}
              </p>
              <div className="mt-2 flex flex-wrap items-start gap-x-8 gap-y-4">
                <div className="flex flex-col gap-1.5">
                  <Tag>Window</Tag>
                  <span className="signal-strong">
                    {short(season.startsAt)} – {short(season.endsAt)}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Tag>Queues that count</Tag>
                  <div className="flex gap-2">
                    {season.formats.map((f) => (
                      <Chip key={f} className={twMerge('h-auto px-2.5 py-1 text-ink [--fill:var(--color-space-000)]', LABEL_CHIP, FORMAT_TONE[f])}>
                        {f}
                      </Chip>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Tag>Levels</Tag>
                  <span className="signal-strong">{maxLevel}</span>
                </div>
              </div>
            </div>

            {live ? (
              <div className="cut notch flex flex-col gap-4 p-5 [--cut:var(--cut-lg)] [--edge:var(--color-steel)] [--fill:var(--color-steel)] min-[720px]:p-6">
                <div className="flex items-center justify-between">
                  <span className="text-ink-dim signal">Your level</span>
                  <Chip className={twMerge('h-auto gap-2 px-2.5 py-1 text-ink [--fill:var(--color-steel)]', LABEL_CHIP, premium ? '[--edge:var(--color-gold)]' : '[--edge:var(--color-line-strong)]')}>
                    <span aria-hidden className={twMerge('size-1.5', premium ? 'bg-gold' : 'bg-line-strong')} />
                    {premium ? (me.premiumSource === 'omega_pass' ? 'Premium · Omega Pass' : 'Premium · Web') : 'Free track'}
                  </Chip>
                </div>
                <div className="flex items-end justify-between">
                  <div className="flex items-baseline gap-2.5 font-display">
                    <span className="text-[64px] leading-[0.9] min-[720px]:text-[88px]">{pad(level)}</span>
                    <span className="text-[28px] leading-none text-ink-dim">/ {maxLevel}</span>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="stat">{fmt(xp)}</span>
                    <span className="text-ink-dim signal-sm">Season XP</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <div
                    role="progressbar"
                    aria-label="Progress to the next level"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(pct * 100)}
                    className="h-2.5 overflow-hidden rounded-xs bg-[rgba(8,10,20,0.55)]"
                  >
                    <div className="h-full rounded-xs bg-cyan" style={{ width: `${Math.round(pct * 1000) / 10}%` }} />
                  </div>
                  <div className="flex justify-between text-ink-dim signal-sm">
                    <span>{level ? `Level ${level} · ${fmt(cur)}` : 'Start · 0'}</span>
                    <span>{next ? `Level ${next.level} · ${fmt(next.xp)} XP` : 'Max level'}</span>
                  </div>
                </div>
                <p className="body-strong">{next ? `${fmt(toGo)} XP to level ${next.level}.` : 'Top level reached. Every reward is yours to claim.'}</p>
                <div className="h-px bg-line-mid" />
                <span className="text-ink-dim signal-sm">{phase === 'ended' ? 'Season ended · final XP' : 'Duels count a few minutes after they end'}</span>
              </div>
            ) : user === null ? (
              <div className={twMerge(CARD, 'dots flex flex-col gap-4 p-5 min-[720px]:p-7')}>
                <h2 className="display-3 min-[720px]:display-2">Track your progress</h2>
                <p className="text-ink-dim body">Sign in to see your level, earn XP from your duels and claim rewards as you reach them.</p>
                <div className="mt-2 flex flex-wrap gap-3">
                  <Button size="signal" className="px-6" onClick={signIn}>
                    Sign In
                  </Button>
                  <Button variant="secondary" size="signal" className="px-5.5" onClick={signIn}>
                    Create Account
                  </Button>
                </div>
              </div>
            ) : null}
          </section>

          {phase !== 'open' ? (
            <div className={twMerge(CARD, 'mt-8 flex flex-col gap-2 px-6 py-4.5 [--cut:var(--cut-md)] min-[720px]:flex-row min-[720px]:items-center min-[720px]:gap-4')}>
              <span className="flex shrink-0 items-center gap-4">
                <span aria-hidden className="size-2 bg-gold" />
                <span className="signal-strong">{phase === 'ended' ? 'Season ended' : 'Starting soon'}</span>
              </span>
              <span className="text-ink-dim body">
                {phase === 'ended'
                  ? `XP stopped on ${day(season.endsAt)}. Every reward you reached can still be claimed while ${season.name} is listed.`
                  : `XP starts counting on ${day(season.startsAt)}. Until then, here’s what the track holds.`}
              </span>
            </div>
          ) : null}

          <SectionHead compact num="01" id="h-rewards" className="mt-12" end={live ? (cc ? `${cc} ready to claim` : 'Nothing to claim') : `${maxLevel} levels · 2 tracks`}>
            Rewards
          </SectionHead>

          {error ? (
            <p role="alert" className="mt-4 text-loss body-sm">
              {error}
            </p>
          ) : null}

          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-6">
            <div className={twMerge(CARD, 'flex flex-col gap-5 p-5 min-[720px]:flex-row min-[720px]:items-center min-[720px]:gap-6 min-[720px]:p-6')}>
              {live ? (
                <>
                  <div className="flex flex-1 flex-col gap-2">
                    <span className="text-ink-muted signal">Ready to claim</span>
                    <span className="display-2">{cc ? plural(cc, 'reward') : 'All caught up'}</span>
                    <span className="max-w-130 text-ink-dim body-sm">
                      {cc
                        ? `${freeN} free · ${cc - freeN} premium. Duel Points go to your balance, everything else to your inventory.`
                        : nextReward
                          ? `Your next reward unlocks at level ${nextReward}.`
                          : 'You’ve claimed every reward this season.'}
                    </span>
                  </div>
                  {cc ? (
                    <Button size="signal" className="min-h-12 px-7" disabled={busy} onClick={takeAll}>
                      Claim All ({cc})
                    </Button>
                  ) : null}
                </>
              ) : (
                <div className="flex flex-1 flex-col gap-2">
                  <span className="text-ink-muted signal">
                    {freeTotal} free · {premTotal} premium
                  </span>
                  <span className="display-2">Rewards are claimed by hand</span>
                  <span className="max-w-130 text-ink-dim body-sm">
                    Reach a level and its reward waits for you, even after the season ends. Duel Points go to your balance, everything else to your inventory.
                  </span>
                </div>
              )}
            </div>

            <div className={twMerge(CARD, 'flex flex-col gap-3 p-5 min-[720px]:p-6')}>
              <span className="flex items-center gap-2.5">
                <span aria-hidden className="size-2 bg-gold" />
                <span className="text-ink-muted signal">Premium track</span>
              </span>
              {premium ? (
                <>
                  <span className="display-2 text-gold">Unlocked</span>
                  <span className="text-ink-dim body-sm">
                    {me.premiumSource === 'omega_pass'
                      ? 'Through your Omega Pass in the game. If the pass expires, the premium track locks again. What you claimed stays yours.'
                      : 'Unlocked on Omega Hub for the whole season. Every premium reward you reach is yours to claim.'}
                  </span>
                </>
              ) : (
                <>
                  {price != null ? <Coins variant="display" displaySize="xl" amount={price} unit={UNIT} /> : null}
                  <span className="text-ink-dim body-sm">
                    {premWaiting
                      ? `${plural(premWaiting, 'premium reward')} ${premWaiting === 1 ? 'is' : 'are'} already waiting at levels you’ve reached. Unlock them all at once.`
                      : 'Unlock every premium reward, including the levels you’ve already reached.'}
                  </span>
                  {price != null ? (
                    <Button variant="secondary" size="signal" className="mt-1 self-start px-5" onClick={openBuy}>
                      {signedIn ? 'Buy Premium' : 'Sign In to Buy'}
                    </Button>
                  ) : null}
                  {season.premiumOmegaPass ? <Tag>{price != null ? 'Also unlocked' : 'Unlocked'} by the Omega Pass in the game</Tag> : null}
                </>
              )}
            </div>
          </div>

          <div className="mt-6 flex gap-3 min-[720px]:gap-4">
            <div className="flex w-16 shrink-0 flex-col gap-2.5 pt-2.5 min-[720px]:w-30 min-[720px]:gap-3">
              <div className="h-10 min-[720px]:h-11" />
              <div className="flex h-49 flex-col justify-center gap-1 border-t border-line min-[720px]:h-54 min-[720px]:gap-1.5">
                <span className="font-display text-[18px] leading-[1.1] uppercase min-[720px]:text-[22px]">Free</span>
                <Tag>
                  <Fit phone={freeTotal} wide={plural(freeTotal, 'reward')} />
                </Tag>
              </div>
              <div className="flex h-49 flex-col justify-center gap-1 border-t border-line min-[720px]:h-54 min-[720px]:gap-1.5">
                <span className="font-display text-[18px] leading-[1.1] text-gold uppercase min-[720px]:text-[22px]">
                  <Fit phone="Prem." wide="Premium" />
                </span>
                <Tag>
                  {premium || !live ? <Fit phone={premTotal} wide={plural(premTotal, 'reward')} /> : 'Locked'}
                </Tag>
              </div>
            </div>
            <div
              ref={scroller}
              role="region"
              aria-label={`Battlepass track, levels 1 to ${maxLevel}`}
              tabIndex={0}
              className="relative min-w-0 flex-1 overflow-x-auto pb-4 [scrollbar-color:var(--color-line-mid)_var(--color-surface-100)] [scrollbar-width:thin] max-[719px]:[scrollbar-width:none]"
            >
              <div className="flex w-max gap-2.5 pt-2.5 pr-4 pl-2.5 min-[720px]:gap-3 min-[720px]:pr-20">
                {levels.map((l) => {
                  const isNext = live && l.level === level + 1
                  const reached = live && l.level <= level
                  const f = status(l.level, 'free')
                  const p = status(l.level, 'premium')
                  const bright = !live || f === 'claimable' || p === 'claimable'
                  return (
                    <div
                      key={l.level}
                      data-level={l.level}
                      className={twMerge(
                        'flex w-33 shrink-0 flex-col gap-2.5 min-[720px]:w-41 min-[720px]:gap-3',
                        isNext && 'bg-ground-cyan shadow-[0_0_0_8px_var(--color-ground-cyan)] min-[720px]:shadow-[0_0_0_10px_var(--color-ground-cyan)]',
                      )}
                    >
                      <div className="flex h-10 flex-col justify-end gap-2 min-[720px]:h-11">
                        <div className="flex items-baseline justify-between">
                          <span className={twMerge('signal-strong', isNext ? 'text-cyan' : bright ? 'text-ink' : 'text-ink-muted')}>LV {pad(l.level)}</span>
                          <Tag className={isNext ? 'text-cyan' : undefined}>{isNext ? 'Next unlock' : fmt(l.xp)}</Tag>
                        </div>
                        <Bar pct={reached ? 1 : isNext ? pct : 0} className="rounded-none" />
                      </div>
                      {tile(l.level, 'free', isNext)}
                      {tile(l.level, 'premium', isNext)}
                      <div className="h-11">
                        {isNext && phase === 'open' ? (
                          <a
                            href="#how-xp"
                            className="cut flex h-11 items-center justify-center gap-2 text-cyan signal-strong transition-colors duration-120 [--edge:var(--color-cyan)] [--fill:var(--color-space-000)] hover:[--fill:var(--color-ground-cyan)]"
                          >
                            Earn {fmt(toGo)} XP
                            <Icon name="arrow" size={14} className="max-[719px]:hidden" />
                          </a>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <SectionHead compact num="02" id="h-log" className="mt-10" end={<span className="text-ink-muted signal-sm max-[719px]:hidden">XP credited every few minutes</span>}>
            Season log
          </SectionHead>

          <div className="mt-5 grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-6">
            <div className={twMerge(CARD, 'flex flex-col')}>
              <div className="flex items-center justify-between px-5 py-4 min-[720px]:px-6 min-[720px]:py-5">
                <h3 className="display-3">Claimed</h3>
                <Tag>{live ? (hist.length > 5 ? `Latest 5 of ${hist.length}` : `${hist.length} claimed`) : 'Signed out'}</Tag>
              </div>
              <div className="grid grid-cols-[110px_110px_minmax(0,1fr)_180px] gap-px border-t border-line bg-line text-ink-muted signal max-[719px]:hidden">
                <span className="bg-surface-200 px-6 py-2.5">Level</span>
                <span className="bg-surface-200 px-4 py-2.5">Track</span>
                <span className="bg-surface-200 px-4 py-2.5">Reward</span>
                <span className="bg-surface-200 py-2.5 pr-6 pl-4 text-right">Claimed</span>
              </div>
              {live && hist.length ? (
                <ul className="flex flex-col gap-px bg-line max-[719px]:border-t max-[719px]:border-line">
                  {hist.slice(0, 5).map((h) => {
                    const r = rewardAt(h.level, h.track)
                    const name = r ? label(r) : h.itemId
                    const track = (
                      <span className={twMerge('signal-strong', h.track === 'free' ? 'text-ink-dim' : 'text-gold')}>{h.track === 'free' ? 'Free' : 'Premium'}</span>
                    )
                    return (
                      <li
                        key={`${h.level}-${h.track}`}
                        className="flex min-h-13 items-center gap-3.5 bg-surface-100 px-5 py-3 min-[720px]:grid min-[720px]:grid-cols-[110px_110px_minmax(0,1fr)_180px] min-[720px]:gap-0 min-[720px]:p-0"
                      >
                        <span className="w-11 shrink-0 font-display text-[18px] leading-none min-[720px]:w-auto min-[720px]:px-6 min-[720px]:text-[20px]">LV {pad(h.level)}</span>
                        <span className="px-4 max-[719px]:hidden">{track}</span>
                        <span className="flex min-w-0 flex-1 flex-col min-[720px]:px-4">
                          <span className="truncate text-[15px] leading-5.5 font-bold">{name}</span>
                          <span className="text-ink-dim body-sm max-[719px]:hidden">
                            {r && isCurrency(r) ? 'Added to your balance' : `${r ? typeLabel(r) : 'Item'} · in your inventory`}
                          </span>
                          <span className="text-ink-muted caption min-[720px]:hidden">{stamp(h.claimedAt)}</span>
                        </span>
                        <span className="text-right text-ink-muted caption max-[719px]:hidden min-[720px]:pr-6 min-[720px]:pl-4">{stamp(h.claimedAt)}</span>
                        <span className="shrink-0 min-[720px]:hidden">{track}</span>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="border-t border-line px-6 py-8 text-ink-dim body">
                  {live ? 'Nothing claimed yet. Rewards wait here once you reach their level.' : 'Sign in to see what you’ve claimed this season.'}
                </p>
              )}
            </div>

            <div id="how-xp" className={twMerge(CARD, 'flex scroll-mt-24 flex-col gap-5 px-5 pt-5 pb-6 min-[720px]:px-6')}>
              <h3 className="display-3">How XP works</h3>
              {[
                ['Ranked duels', `Wins, losses and draws in the ${formats} queues all give XP.`],
                ['Tournaments', 'Entering a tournament, and every match you win in it.'],
                ['Daily visit', 'Your first visit of the day.'],
              ].map(([k, v]) => (
                <div key={k} className="flex flex-col gap-1">
                  <span className="text-azure-lift signal">{k}</span>
                  <span className="text-ink-dim body-sm">{v}</span>
                </div>
              ))}
              <div className="h-px bg-line" />
              <div className="flex flex-col gap-1">
                <span className="text-ink-muted signal">Timing</span>
                <span className="text-ink-dim body-sm">XP shows up a few minutes after a duel or tournament ends, and never twice.</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-ink-muted signal">Rewards</span>
                <span className="text-ink-dim body-sm">
                  Claim each one once. Duel Points go to your balance; everything else goes to your <Link href="/inventory" className="hover:underline">inventory</Link>, ready to equip.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog
        open={!!dialog && price != null}
        onClose={() => setDialog(null)}
        size="sm"
        title={`${season.name} · Premium track`}
        footer={
          <>
            <Button variant="secondary" size="signal" className="px-5" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            {canAfford ? (
              <Button size="signal" className="px-6" disabled={busy} onClick={buy}>
                Pay {fmt(price ?? 0)} DP
              </Button>
            ) : null}
          </>
        }
      >
        <p className="display-2">Unlock premium</p>
        <p className="text-ink-dim body">
          Every premium reward from level 1 to {maxLevel}.{' '}
          {premReached ? `The ${premReached} you’ve already reached ${premReached === 1 ? 'is' : 'are'} ready to claim right away.` : 'Each one is yours to claim as you reach it.'}
        </p>
        <div className="flex flex-col gap-px border border-line bg-line">
          {[
            ['Price', `${fmt(price ?? 0)} DP`, 'text-gold'],
            ['Your balance', `${fmt(balance ?? 0)} DP`, 'text-ink'],
            canAfford ? ['After purchase', `${fmt((balance ?? 0) - (price ?? 0))} DP`, 'text-ink'] : ['Missing', `${fmt((price ?? 0) - (balance ?? 0))} DP`, 'text-loss'],
          ].map(([k, v, tone]) => (
            <div key={k} className="flex items-center justify-between bg-surface-200 px-4 py-3">
              <span className="text-ink-muted signal">{k}</span>
              <span className={twMerge('font-mono text-[13px] font-bold tracking-[0.08em]', tone)}>{v}</span>
            </div>
          ))}
        </div>
        {!canAfford ? <p className="text-loss body-sm">You need {fmt((price ?? 0) - (balance ?? 0))} more Duel Points. Nothing has been charged.</p> : null}
        {dialog?.error ? (
          <p role="alert" className="text-loss body-sm">
            {dialog.error}
          </p>
        ) : null}
        <Tag>Charged once · shows as Battlepass in your history</Tag>
      </Dialog>

      {toast ? (
        <div role="status" className="fixed bottom-10 left-1/2 z-80 -translate-x-1/2 drop-shadow-[0_16px_40px_rgba(0,0,0,0.5)]">
          <div className="cut notch flex min-w-[min(360px,calc(100vw-32px))] items-center gap-3.5 py-3.5 pr-6 pl-4.5 [--cut:var(--cut-md)] [--edge:var(--color-cyan)] [--fill:var(--color-surface-200)]">
            <Icon name="check" size={22} className="text-cyan" />
            <div className="flex flex-col">
              <span className="text-[15px] leading-5.5 font-bold">{toast.title}</span>
              <span className="text-ink-dim body-sm">{toast.sub}</span>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
