'use client'

import { useEffect, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { useAuth } from '@hooks/index'
import { EmptyBox } from '@omega/profile/empty-box'
import { formatNumber } from '@omega/tournament/labels'
import { Callout } from '@omega/wiki/wiki'
import { buttonClasses } from '@ui/button'
import { Chip } from '@ui/chip/chip.component'
import { Eyebrow } from '@ui/eyebrow/eyebrow'
import { SectionHead } from '@ui/section-head/section-head.component'
import { signIn } from '@utils/auth'
import { ShopApiError, getWallet, purchaseErrorMessage, purchaseItem } from '@utils/shop'
import type { ShopCatalog, ShopEnum, ShopItem } from '@utils/types'

/** `startsAt` / `endsAt` are plain `YYYY-MM-DD`, so they are read as UTC and never shifted a day. */
const DAY = new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'short', timeZone: 'UTC' })
const day = (date: string) => DAY.format(new Date(`${date}T00:00:00Z`))

const windowNote = ({ startsAt, endsAt }: ShopItem) => {
  if (startsAt && endsAt) return `${day(startsAt)} – ${day(endsAt)}`
  if (endsAt) return `until ${day(endsAt)}`
  if (startsAt) return `from ${day(startsAt)}`
  return null
}

/** The catalog sends the label and the blurb for every type, so nothing here is hardcoded. */
const typeLabel = (types: ShopEnum[], value: string) => types.find((type) => type.value === value)?.name ?? value

type ItemCardProps = {
  item: ShopItem
  label: string
  owned: boolean
  balance: number | null
  busy: boolean
  signedIn: boolean | undefined
  onBuy: (item: ShopItem) => void
}

const ItemCard = ({ item, label, owned, balance, busy, signedIn, onBuy }: ItemCardProps) => {
  const limited = windowNote(item)
  // The storefront only lists priced items; `null` is inventory-only, so it reads as unbuyable.
  const short = balance !== null && item.price !== null && balance < item.price

  return (
    <li className="flex flex-col border border-line bg-surface-000 p-[clamp(14px,1.8vw,20px)]">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-ink body-strong">{item.name}</p>
        {owned ? (
          <Chip tone="cyan" solid>
            Owned
          </Chip>
        ) : limited ? (
          <Chip tone="gold">{limited}</Chip>
        ) : null}
      </div>

      <p className="mt-1.5 text-ink-muted signal">{label}</p>
      {item.season ? <p className="mt-1 text-ink-dim mono-data">{item.season}</p> : null}

      {item.ext ? (
        <a
          href={item.ext}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-2.5 self-start text-cyan signal hover:underline"
        >
          Preview ↗
        </a>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-4">
        <p className={twMerge('mono-data tabular-nums', owned ? 'text-ink-muted' : 'text-amber')}>
          {item.price === null ? '—' : `${formatNumber(item.price)} DP`}
        </p>

        {owned ? (
          <span className="text-ink-muted signal">In your inventory</span>
        ) : signedIn === false ? (
          <button type="button" onClick={signIn} className={buttonClasses({ variant: 'ghost', size: 'mono' })}>
            Sign in to buy
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onBuy(item)}
            disabled={busy || signedIn === undefined}
            className={buttonClasses({ variant: short ? 'ghost' : 'primary', size: 'mono' })}
          >
            {busy ? 'Buying…' : short ? 'Not enough DP' : 'Buy'}
          </button>
        )}
      </div>
    </li>
  )
}

type ShopBrowserProps = { catalog: ShopCatalog }

export const ShopBrowser = ({ catalog }: ShopBrowserProps) => {
  const { user } = useAuth()
  const [balance, setBalance] = useState<number | null>(null)
  const [owned, setOwned] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [filter, setFilter] = useState<string>('all')

  const signedIn = user === undefined ? undefined : Boolean(user)

  useEffect(() => {
    if (!user) return
    const controller = new AbortController()
    getWallet(controller.signal)
      .then((wallet) => {
        setBalance(wallet.balance)
        setOwned(new Set(wallet.items.map((item) => item.id)))
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        // Signed out mid-session, or the wallet is unreachable: the catalog still reads.
        console.error(error)
      })
    return () => controller.abort()
  }, [user])

  /* One section per type, in the order the catalog lists its types; a type the catalog didn't
     describe still gets a section, under its raw value, rather than disappearing. */
  const sections = useMemo(() => {
    const byType = new Map<string, ShopItem[]>()
    for (const item of catalog.items) byType.set(item.type, [...(byType.get(item.type) ?? []), item])

    const known = catalog.types.filter((type) => byType.has(type.value))
    const extra = [...byType.keys()]
      .filter((value) => !catalog.types.some((type) => type.value === value))
      .map((value) => ({ value, name: value, description: '' }))

    return [...known, ...extra].map((type) => ({ type, items: byType.get(type.value) ?? [] }))
  }, [catalog])

  const shown = filter === 'all' ? sections : sections.filter(({ type }) => type.value === filter)

  const buy = async (item: ShopItem) => {
    if (!user) return signIn()
    setBusy(item.id)
    setNotice(null)
    try {
      const result = await purchaseItem(item.id)
      // The response carries the new balance inside the same transaction that charged it.
      setBalance(result.balance)
      setOwned((current) => new Set(current).add(item.id))
      setNotice({ tone: 'ok', text: `${item.name} is yours. ${formatNumber(result.balance)} DP left.` })
    } catch (error) {
      console.error(error)
      if (error instanceof ShopApiError && error.code === 'ALREADY_OWNED') {
        setOwned((current) => new Set(current).add(item.id))
      }
      if (error instanceof ShopApiError && error.status === 401) return signIn()
      setNotice({ tone: 'error', text: purchaseErrorMessage(error) })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-page px-gutter">
      <section>
        <Eyebrow tone="amber" meta="Cosmetics only · no card is ever sold">Duel Points</Eyebrow>
        <h1 className="mt-4 text-ink display-1">Shop</h1>
        <p className="mt-3.5 max-w-[62ch] text-ink-dim lead">
          Profile frames, backgrounds, songs, messenger bubbles, custom ranked badges and animated favorites. Everything
          here is decoration — no card, no deck and no ranked advantage is for sale.
        </p>
      </section>

      <section className="pt-section">
        <div className="flex flex-wrap items-center justify-between gap-4 border border-line-strong bg-surface-100 px-[clamp(16px,2.4vw,28px)] py-[clamp(16px,2.4vw,24px)]">
          <div>
            <p className="text-ink-muted signal">Your balance</p>
            {signedIn === false ? (
              <p className="mt-1.5 text-ink display-4">Signed out</p>
            ) : (
              <p className="mt-1.5 text-amber display-2 tabular-nums">
                {balance === null ? '—' : formatNumber(balance)} <span className="text-ink-muted display-5">DP</span>
              </p>
            )}
          </div>
          {signedIn === false ? (
            <button type="button" onClick={signIn} className={buttonClasses({ variant: 'discord', size: 'sm' })}>
              Sign in with Discord
            </button>
          ) : (
            <p className="max-w-[46ch] text-ink-muted signal-sm">
              Duel Points are credited by the Omega staff. There is no automatic way to earn them yet, and they are not
              the duel points of the game client.
            </p>
          )}
        </div>

        {notice ? (
          <p
            role={notice.tone === 'error' ? 'alert' : 'status'}
            className={twMerge(
              'mt-3.5 border px-4 py-3 body-sm',
              notice.tone === 'error' ? 'border-negative bg-ground-negative text-ink-dim' : 'border-positive bg-ground-positive text-ink-dim',
            )}
          >
            {notice.text}
          </p>
        ) : null}
      </section>

      {catalog.items.length ? (
        <>
          <section className="pt-section">
            <div className="flex flex-wrap gap-2">
              {[{ value: 'all', name: 'Everything' }, ...sections.map(({ type }) => type)].map((type) => {
                const on = filter === type.value
                const count = type.value === 'all' ? catalog.items.length : (sections.find((s) => s.type.value === type.value)?.items.length ?? 0)
                return (
                  <button
                    key={type.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setFilter(type.value)}
                    className={twMerge(
                      'inline-flex min-h-11 cursor-pointer items-center gap-2 border px-3 signal-chip',
                      on ? 'border-gold bg-ground-gold text-gold' : 'border-line text-ink-dim hover:border-gold hover:text-gold',
                    )}
                  >
                    {type.name}
                    <span className="text-ink-muted">{formatNumber(count)}</span>
                  </button>
                )
              })}
            </div>
          </section>

          {shown.map(({ type, items }, index) => (
            <section key={type.value} className="pt-section">
              <SectionHead num={String(index + 1).padStart(2, '0')}>{type.name}</SectionHead>
              {type.description ? <p className="mt-2.5 max-w-[62ch] text-ink-dim body-sm">{type.description}</p> : null}
              <ul className="mt-4.5 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    label={typeLabel(catalog.types, item.type)}
                    owned={owned.has(item.id)}
                    balance={balance}
                    busy={busy === item.id}
                    signedIn={signedIn}
                    onBuy={buy}
                  />
                ))}
              </ul>
            </section>
          ))}
        </>
      ) : (
        <section className="pt-section">
          <EmptyBox title="The shop is empty right now" note="Nothing on sale">
            Every item is either out of its window or not for sale this season. Limited items appear on their first day
            and disappear the day after the last one.
          </EmptyBox>
        </section>
      )}

      <section className="pt-section">
        <Callout>
          Buying puts the item in your inventory and charges the price the server holds, never the one this page shows.
          Equipping is not wired yet: an item you own stays in the inventory until profile decorations start reading
          from it.
        </Callout>
      </section>
    </div>
  )
}
