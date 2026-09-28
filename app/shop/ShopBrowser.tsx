'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'
import { Equipped, LABEL_CHIP, LoadoutList, TYPE_ICON, bubblePreview, useLoadout } from '@omega/inventory'
import { Button } from '@ui/button'
import { Chip, FilterChip } from '@ui/chip'
import { Coins } from '@ui/coins'
import { DataTable, type Column } from '@ui/data-table'
import { Dialog } from '@ui/dialog'
import { Eyebrow } from '@ui/eyebrow'
import { Header } from '@ui/header'
import { Icon } from '@ui/icon'
import { Panel } from '@ui/panel'
import { SectionHead } from '@ui/section-head'
import { TabBar, tabPanelProps } from '@ui/tab-bar'
import { Thumb } from '@ui/thumb'
import { ItemTile } from '@ui/tile'
import { signIn } from '@utils/auth'
import { ShopApiError, getHistory, purchaseErrorMessage, purchaseItem } from '@utils/shop'
import type { ShopCatalog, ShopEnum, ShopItem, ShopLedgerEntry } from '@utils/types'

type Tab = 'store' | 'hist'
type Stage = 'confirm' | 'success' | 'funds' | 'auth'

const UNIT = 'Duel Points'
const BATTLEPASS = '/battlepass'

const REASON = { purchase: 'Purchase', refund: 'Refund', grant: 'Grant', reward: 'Reward', battlepass: 'Battlepass' }

const fmt = (n: number) => n.toLocaleString('en-US')
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** "Sat 20 Sep". `YYYY-MM-DD` dates are read in UTC so they never shift a day. */
const dayLabel = (date: Date, timeZone?: string) => {
  const part = (options: Intl.DateTimeFormatOptions) => date.toLocaleString('en-US', { ...options, timeZone })
  return `${part({ weekday: 'short' })} ${part({ day: '2-digit' })} ${part({ month: 'short' })}`
}
const clock = (date: Date) => date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
const untilLabel = (endsAt: string) => `Until ${dayLabel(new Date(`${endsAt}T00:00:00Z`), 'UTC')}`
const stamp = (iso: string) => `${dayLabel(new Date(iso))} · ${clock(new Date(iso))}`
const signed = (amount: number) => `${amount > 0 ? '+' : '−'}${fmt(Math.abs(amount))}`

const ON_STEEL = '[--fill:var(--color-steel)] hover:[--fill:var(--color-steel-lift)]'
const LINK = 'inline-flex min-h-11 items-center gap-1.5 text-cyan signal-strong hover:underline'

type ShopBrowserProps = { catalog: ShopCatalog; readAt: string }

export const ShopBrowser = ({ catalog, readAt }: ShopBrowserProps) => {
  const loadout = useLoadout()
  const { user, wallet, setWallet, setSlot, isEquipped } = loadout
  const signedIn = !!user

  const [tab, setTab] = useState<Tab>('store')
  const [filter, setFilter] = useState('ALL')
  const [slide, setSlide] = useState(0)
  const [ledger, setLedger] = useState<ShopLedgerEntry[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [modal, setModal] = useState<{ item: ShopItem; stage: Stage; error?: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const error = loadout.error

  useEffect(() => {
    if (!user) return
    const controller = new AbortController()
    getHistory(null, controller.signal)
      .then((page) => {
        setLedger(page.entries)
        setCursor(page.nextCursor)
      })
      .catch((e) => controller.signal.aborted || console.error(e))
    return () => controller.abort()
  }, [user])

  const typeBy = new Map<string, ShopEnum>(catalog.types.map((t) => [t.value, t]))
  const typeName = (value: string) => typeBy.get(value)?.name ?? value
  const surfaces = (value: string) => (typeBy.get(value)?.surfaces ?? []).map(cap).join(' · ')
  const equippable = (value: string) => !!typeBy.get(value)?.equippable

  const balance = signedIn ? (wallet?.balance ?? 0) : 0
  const owned = new Set(signedIn ? (wallet?.items ?? []).map((i) => i.id) : [])
  const equipped = signedIn ? loadout.equipped : {}
  const isShort = (item: ShopItem) => signedIn && !owned.has(item.id) && item.price != null && item.price > balance

  const limited = catalog.items.filter((i) => i.endsAt)
  const base = catalog.items.filter((i) => !i.endsAt)
  const grid = base.filter((i) => filter === 'ALL' || i.type === filter)
  const chips = [{ value: 'ALL', name: 'All', count: base.length }]
    .concat(catalog.types.map((t) => ({ value: t.value, name: t.name, count: base.filter((i) => i.type === t.value).length })))
    .filter((c) => c.count > 0)
  const active = typeBy.get(filter)
  const slots = catalog.types.filter((t) => t.equippable && !t.currency)

  const current: Tab = signedIn ? tab : 'store'
  const tabs = signedIn
    ? [
        { id: 'store' as const, label: 'Storefront' },
        { id: 'hist' as const, label: 'History' },
      ]
    : [{ id: 'store' as const, label: 'Storefront' }]

  const refreshHistory = () =>
    getHistory(null)
      .then((page) => {
        setLedger(page.entries)
        setCursor(page.nextCursor)
      })
      .catch(console.error)

  const open = (item: ShopItem) =>
    setModal({ item, stage: !signedIn ? 'auth' : isShort(item) ? 'funds' : 'confirm' })

  const buy = () => {
    if (!modal || busy) return
    setBusy(true)
    purchaseItem(modal.item.id)
      .then(({ item, balance: next }) => {
        setWallet((w) =>
          w && {
            ...w,
            balance: next,
            items: [{ ...item, acquiredAt: new Date().toISOString(), source: 'purchase' as const }, ...w.items],
          },
        )
        setModal({ item, stage: 'success' })
        refreshHistory()
      })
      .catch((e) => {
        if (e instanceof ShopApiError && e.code === 'INSUFFICIENT_FUNDS') setModal((m) => m && { ...m, stage: 'funds' })
        else if (e instanceof ShopApiError && e.code === 'UNAUTHENTICATED') setModal((m) => m && { ...m, stage: 'auth' })
        else setModal((m) => m && { ...m, error: purchaseErrorMessage(e) })
      })
      .finally(() => setBusy(false))
  }

  const loadMore = () => {
    if (!cursor || busy) return
    setBusy(true)
    getHistory(cursor)
      .then((page) => {
        setLedger((l) => [...l, ...page.entries])
        setCursor(page.entries.length ? page.nextCursor : null)
      })
      .catch(console.error)
      .finally(() => setBusy(false))
  }

  /** Price and Buy, Owned and Equip, or Equipped: what a storefront card ends on. */
  const storeFooter = (item: ShopItem, steel?: boolean) => {
    if (isEquipped(item)) return <Equipped className={steel ? 'py-1.5' : undefined} />
    if (owned.has(item.id)) {
      return (
        <>
          <span className={twMerge('signal', steel ? 'text-ink-dim' : 'pb-3.5 text-ink-muted')}>Owned</span>
          {equippable(item.type) ? (
            <Button variant="secondary" size="signal" className={steel ? ON_STEEL : undefined} aria-label={`Equip ${item.name}`} onClick={() => setSlot(item.type, item)}>
              Equip
            </Button>
          ) : null}
        </>
      )
    }
    const short = isShort(item)
    return (
      <>
        <span className="flex flex-col gap-1">
          <Coins variant="display" displaySize="md" amount={item.price ?? '—'} unit={UNIT} className={steel ? undefined : 'max-[719px]:[&>span:nth-child(2)]:text-[20px]'} />
          {short && !steel ? <span className="text-ink-muted caption">Need {fmt((item.price ?? 0) - balance)} more</span> : null}
        </span>
        <Button variant="secondary" size="signal" className={steel ? ON_STEEL : undefined} aria-label={`Buy ${item.name}`} onClick={() => open(item)}>
          Buy
        </Button>
      </>
    )
  }

  const ledgerColumns: Column<ShopLedgerEntry>[] = [
    { key: 'when', label: 'When', width: 180, render: (e) => <span className="text-ink-dim body-sm">{stamp(e.createdAt)}</span> },
    {
      key: 'reason',
      label: 'Reason',
      width: 130,
      render: (e) => <Chip className={twMerge('h-auto py-1 [--edge:var(--color-surface-200)]', LABEL_CHIP)}>{REASON[e.reason]}</Chip>,
    },
    {
      key: 'detail',
      label: 'Detail',
      render: (e) => (
        <span className="flex min-w-0 flex-col">
          <span className="text-[15px] leading-5.5 font-bold text-ink">{e.itemName ?? 'Manual credit'}</span>
          {e.note ? <span className="text-ink-muted body-sm">{e.note}</span> : null}
        </span>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      width: 120,
      numeric: true,
      render: (e) => <span className={twMerge('stat', e.amount > 0 ? 'text-gold' : 'text-ink')}>{signed(e.amount)}</span>,
    },
  ]

  const m = modal ? { ...modal, short: Math.max(0, (modal.item.price ?? 0) - balance) } : null
  const mTitle = m && { confirm: 'Confirm purchase', success: 'Purchased', funds: 'Not enough Duel Points', auth: 'Sign in to buy' }[m.stage]
  const mTone = m?.stage === 'success' ? 'text-cyan' : m?.stage === 'funds' ? 'text-loss' : undefined
  const primaryWide = 'px-5'

  return (
    <>
      <Header
        extra={
          signedIn && wallet ? (
            <span className="cut my-auto flex h-9 shrink-0 items-center px-3 [--cut:var(--cut-xs)] [--edge:var(--color-surface-200)] [--fill:var(--color-surface-200)]">
              <Coins variant="display" displaySize="bar" amount={wallet.balance} unit={UNIT} />
            </span>
          ) : null
        }
      />

      <div className="min-h-dvh w-full overflow-x-clip bg-space-000 bg-[radial-gradient(ellipse_900px_380px_at_28%_-120px,rgba(0,253,255,0.09),transparent_70%),radial-gradient(ellipse_760px_340px_at_78%_-100px,rgba(74,111,216,0.16),transparent_70%)] text-ink">
        <div className="mx-auto w-[min(1200px,calc(100%-32px))] pt-23 pb-24 min-[720px]:pt-27">
          <section className="flex flex-col gap-3 pb-5 min-[720px]:flex-row min-[720px]:items-end min-[720px]:justify-between min-[720px]:gap-10 min-[720px]:pb-7">
            <div className="flex max-w-180 flex-col gap-3 min-[720px]:gap-3.5">
              <Eyebrow rule={false} className="[&>span:nth-child(2)]:text-ink-muted">
                {catalog.items.length} items on sale · {limited.length} limited
              </Eyebrow>
              <h1 className="display-1">Shop</h1>
              <p className="text-ink-dim body min-[720px]:lead">
                Frames, backgrounds, songs and badges for your profile and messenger, paid in Duel Points.
              </p>
            </div>
            <p className="text-ink-muted signal-sm min-[720px]:pb-1.5" suppressHydrationWarning>
              Catalog read {clock(new Date(readAt))}
              <span className="max-[719px]:hidden"> · refreshes every minute</span>
            </p>
          </section>

          <TabBar
            tabs={tabs}
            active={current}
            onSelect={setTab}
            label="Shop sections"
            idPrefix="shop"
            fit
            className="gap-6 min-[720px]:gap-8 [&>button]:min-h-12"
          />

          <div className="grid items-start gap-6 pt-7 min-[720px]:pt-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <main {...tabPanelProps('shop', current)} className="flex min-w-0 flex-col gap-9 min-[720px]:gap-12">
              {error ? (
                <p role="alert" className="text-loss body-sm">
                  {error}
                </p>
              ) : null}

              {current === 'store' ? (
                <>
                  {limited.length ? (
                    <section aria-labelledby="h-limited" className="flex flex-col gap-4 min-[720px]:gap-5">
                      <SectionHead ruled num="01" id="h-limited" end="Leaves the shop after its last day">
                        Limited time
                      </SectionHead>
                      <div
                        onScroll={(e) => setSlide(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
                        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scrollbar-none min-[720px]:grid min-[720px]:grid-cols-2 min-[720px]:gap-6 min-[720px]:overflow-visible [&::-webkit-scrollbar]:hidden"
                      >
                        {limited.map((item) => (
                          <ItemTile
                            key={item.id}
                            layout="row"
                            className="w-full shrink-0 snap-start min-[720px]:w-auto"
                            src={`/items/${item.id}.png`}
                            art={bubblePreview(item)}
                            icon={TYPE_ICON[item.type] ?? 'cards'}
                            selected={isEquipped(item)}
                            badges={
                              <>
                                <Chip tone="gold" className={twMerge('h-auto py-1 text-ink [--fill:var(--color-steel)]', LABEL_CHIP)}>
                                  Limited
                                </Chip>
                                <span className="text-ink-dim signal-sm">{untilLabel(item.endsAt!)}</span>
                              </>
                            }
                            kicker={typeName(item.type)}
                            title={item.name}
                            detail={item.description || typeBy.get(item.type)?.description}
                            footer={storeFooter(item, true)}
                          />
                        ))}
                      </div>
                      {limited.length > 1 ? (
                        <p className="text-center text-ink-muted signal-sm min-[720px]:hidden">
                          {Math.min(slide, limited.length - 1) + 1} of {limited.length} · swipe for more
                        </p>
                      ) : null}
                    </section>
                  ) : null}

                  <section aria-labelledby="h-all" className="flex flex-col gap-3.5 min-[720px]:gap-4">
                    <SectionHead ruled num={limited.length ? '02' : '01'} id="h-all" end="Sorted by type, then name">
                      All items
                    </SectionHead>
                    {base.length ? (
                      <>
                        <div role="group" aria-label="Filter by type" className="-mr-4 flex gap-2 overflow-x-auto scrollbar-none min-[720px]:mr-0 min-[720px]:flex-wrap min-[720px]:overflow-visible [&::-webkit-scrollbar]:hidden">
                          {chips.map((c) => (
                            <FilterChip key={c.value} pressed={filter === c.value} label={c.name} count={c.count} onClick={() => setFilter(c.value)} />
                          ))}
                        </div>
                        <p className="text-ink-muted signal-sm max-[719px]:hidden">
                          {active ? `${active.name} · shows on ${surfaces(active.value)}` : 'Every item on sale right now'}
                        </p>
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 min-[720px]:gap-6 xl:grid-cols-4">
                          {grid.map((item) => (
                            <ItemTile
                              key={item.id}
                              src={`/items/${item.id}.png`}
                            art={bubblePreview(item)}
                              icon={TYPE_ICON[item.type] ?? 'cards'}
                              selected={isEquipped(item)}
                              kicker={typeName(item.type)}
                              title={item.name}
                              footer={storeFooter(item)}
                            />
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-ink-dim body">Nothing on sale right now. Check back soon.</p>
                    )}
                  </section>
                </>
              ) : null}

              {current === 'hist' ? (
                <section aria-labelledby="h-hist" className="flex flex-col gap-5">
                  <SectionHead ruled num="01" id="h-hist" end="Newest first · 50 per page">
                    Duel Points ledger
                  </SectionHead>
                  <div className="overflow-x-auto">
                    <DataTable roomy columns={ledgerColumns} rows={ledger} rowKey={(e) => e.id} empty="No Duel Points movements yet." className="min-w-160" />
                  </div>
                  {cursor ? (
                    <Button variant="secondary" size="signal" className="self-center" disabled={busy} onClick={loadMore}>
                      Load more
                    </Button>
                  ) : ledger.length ? (
                    <p className="py-2 text-center text-ink-muted signal-sm">Start of your history</p>
                  ) : null}
                </section>
              ) : null}
            </main>

            <aside aria-label="Wallet and loadout" className="flex flex-col gap-6">
              <Panel tone="framed" title="Wallet" meta="Hub currency">
                {signedIn ? (
                  <div className="flex flex-col gap-3.5">
                    <span className="flex items-center gap-3">
                      <Coins variant="display" displaySize="xl" amount={balance} unit={UNIT} />
                      <span className="pt-2.5 text-ink-muted signal">Duel Points</span>
                    </span>
                    <p className="text-ink-dim body-sm">
                      Earned on the Hub from the battlepass, rewards and tournament prizes. Separate from the DP in your client.
                    </p>
                    <Link href={BATTLEPASS} className={LINK}>
                      Open battlepass
                      <Icon name="arrow" size={16} />
                    </Link>
                  </div>
                ) : user === null ? (
                  <div className="flex flex-col items-start gap-3.5 pb-1">
                    <p className="text-ink-dim body">Sign in to see your Duel Points, buy items and equip them.</p>
                    <Button size="signal" className={primaryWide} onClick={signIn}>
                      Sign in with Discord
                    </Button>
                  </div>
                ) : null}
              </Panel>

              {signedIn ? (
                <Panel tone="framed" title="Loadout" meta={`${slots.filter((t) => equipped[t.value]).length} of ${slots.length} slots`} className="pb-3 min-[720px]:pb-3">
                  <LoadoutList loadout={loadout} types={catalog.types} />
                  <Link href="/inventory" className={twMerge(LINK, 'mt-2')}>
                    Your inventory · {wallet?.items.length ?? 0} items
                    <Icon name="arrow" size={16} />
                  </Link>
                </Panel>
              ) : null}

              {signedIn && current !== 'hist' && ledger.length ? (
                <Panel
                  tone="framed"
                  title="Recent activity"
                  actions={
                    <button type="button" onClick={() => setTab('hist')} className="ml-auto cursor-pointer text-cyan signal-strong hover:underline">
                      Full history
                    </button>
                  }
                  className="pb-3 min-[720px]:pb-3"
                >
                  <ul className="flex flex-col gap-px bg-line">
                    {ledger.slice(0, 3).map((e) => (
                      <li key={e.id} className="flex items-center gap-3 bg-surface-100 py-3">
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="text-[15px] leading-5.5 font-bold">{e.itemName ?? 'Manual credit'}</span>
                          <span className="text-ink-muted caption">
                            {REASON[e.reason]} · {stamp(e.createdAt)}
                          </span>
                        </span>
                        <span className={twMerge('stat', e.amount > 0 ? 'text-gold' : 'text-ink')}>{signed(e.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </Panel>
              ) : null}
            </aside>
          </div>
        </div>
      </div>

      <Dialog
        open={!!m}
        onClose={() => setModal(null)}
        size="sm"
        title={<span className={mTone}>{mTitle}</span>}
        footer={
          m?.stage === 'confirm' ? (
            <>
              <Button variant="secondary" size="signal" onClick={() => setModal(null)}>
                Cancel
              </Button>
              <Button size="signal" className={primaryWide} disabled={busy} onClick={buy}>
                Buy for {fmt(m.item.price ?? 0)}
              </Button>
            </>
          ) : m?.stage === 'success' ? (
            <>
              <Button variant="secondary" size="signal" onClick={() => setModal(null)}>
                Keep browsing
              </Button>
              {equippable(m.item.type) ? (
                <Button
                  size="signal"
                  className={primaryWide}
                  onClick={() => {
                    setSlot(m.item.type, m.item)
                    setModal(null)
                  }}
                >
                  Equip now
                </Button>
              ) : null}
            </>
          ) : m?.stage === 'funds' ? (
            <>
              <Button variant="secondary" size="signal" onClick={() => setModal(null)}>
                Close
              </Button>
              <Button href={BATTLEPASS} size="signal" className={primaryWide}>
                Open battlepass
              </Button>
            </>
          ) : m?.stage === 'auth' ? (
            <>
              <Button variant="secondary" size="signal" onClick={() => setModal(null)}>
                Cancel
              </Button>
              <Button size="signal" className={primaryWide} onClick={signIn}>
                Sign in with Discord
              </Button>
            </>
          ) : null
        }
      >
        {m ? (
          <>
            <div className="flex gap-5">
              <Thumb wide src={`/items/${m.item.id}.png`} className="size-28">
                <Icon name={TYPE_ICON[m.item.type] ?? 'cards'} size={44} />
              </Thumb>
              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="text-azure-lift signal-sm">
                  {typeName(m.item.type)} · shows on {surfaces(m.item.type)}
                </span>
                <span className="font-sans text-[24px] leading-7.5 font-medium">{m.item.name}</span>
                <span className="text-ink-dim body-sm">{m.item.description || typeBy.get(m.item.type)?.description}</span>
                {m.item.ext ? (
                  <a href={m.item.ext} target="_blank" rel="noopener noreferrer" className={LINK}>
                    <Icon name="play" size={14} />
                    {/youtu\.?be/.test(m.item.ext) ? 'Listen on YouTube' : 'Open link'}
                  </a>
                ) : null}
              </div>
            </div>

            {m.stage === 'confirm' ? (
              <>
                <div className="grid grid-cols-2 gap-px border border-line bg-line">
                  <div className="flex flex-col gap-2 bg-surface-200 p-4">
                    <span className="text-ink-muted signal">Price</span>
                    <Coins variant="display" displaySize="lg" amount={m.item.price ?? '—'} unit={UNIT} />
                  </div>
                  <div className="flex flex-col gap-2 bg-surface-200 p-4">
                    <span className="text-ink-muted signal">Your balance</span>
                    <span className="font-display text-[32px] leading-none">{fmt(balance)}</span>
                  </div>
                </div>
                <p className="text-ink-muted caption">You pay the shop’s price at the moment you confirm. Each item can be owned once.</p>
              </>
            ) : null}

            {m.stage === 'success' ? (
              <div className="flex items-center gap-4 bg-ground-cyan p-4">
                <Icon name="check" size={24} className="text-cyan" />
                <div className="flex flex-col gap-0.5">
                  <span className="body-strong">It’s in your inventory.</span>
                  <span className="text-ink-dim body-sm">New balance: {fmt(balance)} Duel Points</span>
                </div>
              </div>
            ) : null}

            {m.stage === 'funds' ? (
              <p className="text-ink-dim body">
                You have <strong className="text-ink">{fmt(balance)}</strong> and this costs{' '}
                <strong className="text-gold">{fmt(m.item.price ?? 0)}</strong>. You need {fmt(m.short)} more Duel Points. Nothing was charged.
              </p>
            ) : null}

            {m.stage === 'auth' ? (
              <p className="text-ink-dim body">Buying needs a Hub account. Sign in with Discord and come back to this item.</p>
            ) : null}

            {m.error ? (
              <p role="alert" className="text-loss body-sm">
                {m.error}
              </p>
            ) : null}
          </>
        ) : null}
      </Dialog>
    </>
  )
}
