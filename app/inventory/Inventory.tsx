'use client'

import { useState } from 'react'
import Link from 'next/link'
import { InventoryGrid, LoadoutList, typesOf, useLoadout } from '@omega/inventory'
import { Avatar } from '@ui/avatar'
import { FilterChip } from '@ui/chip'
import { Eyebrow } from '@ui/eyebrow'
import { Icon } from '@ui/icon'
import { Panel } from '@ui/panel'
import { SectionHead } from '@ui/section-head'
import type { ShopEnum } from '@utils/types'
import { BATTLEPASS_ENABLED, SHOP_ENABLED } from '@utils/const'

const LINK = 'inline-flex min-h-11 items-center gap-1.5 text-cyan signal-strong hover:underline'

export const Inventory = ({ types }: { types: ShopEnum[] }) => {
  const loadout = useLoadout()
  const { user, wallet } = loadout
  const [filter, setFilter] = useState('ALL')
  const t = typesOf(types)

  const items = wallet?.items ?? []
  const chips = [{ value: 'ALL', name: 'All', count: items.length }]
    .concat([...new Set(items.map((i) => i.type))].map((value) => ({ value, name: t.name(value), count: items.filter((i) => i.type === value).length })))
  const name = user?.profile.username ?? 'Duelist'

  return (
    <div className="min-h-dvh w-full overflow-x-clip bg-space-000 text-ink">
      <div className="mx-auto w-[min(1200px,calc(100%-32px))] pt-23 pb-24 min-[720px]:pt-27">
        <section className="flex flex-col gap-5 pb-7 min-[720px]:flex-row min-[720px]:items-end min-[720px]:justify-between">
          <div className="flex max-w-180 flex-col gap-3 min-[720px]:gap-3.5">
            <Eyebrow rule={false} className="[&>span:nth-child(2)]:text-ink-muted">
              {wallet ? `${items.length} items · ${Object.keys(loadout.equipped).length} equipped` : 'Loading…'}
            </Eyebrow>
            <h1 className="display-1">Inventory</h1>
            <p className="text-ink-dim body min-[720px]:lead">Everything you bought or earned. One item per slot; equipping replaces what’s there, and everyone sees it right away.</p>
          </div>
          {user ? (
            <Link href="/profile/edit" className="group flex items-center gap-4">
              <Avatar name={name} src={user.profile.avatarUrl} cosmetics={user.cosmetics} size="lg" />
              <span className="flex flex-col gap-1">
                <span className="text-ink display-6 group-hover:text-cyan">{name}</span>
                <span className="text-ink-muted signal-sm">How others see you</span>
              </span>
            </Link>
          ) : null}
        </section>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <main className="flex min-w-0 flex-col gap-5">
            <SectionHead ruled num="01" id="h-inv" end="Newest first">
              Your items
            </SectionHead>
            {loadout.error ? (
              <p role="alert" className="text-loss body-sm">
                {loadout.error}
              </p>
            ) : null}
            {items.length ? (
              <>
                <div role="group" aria-label="Filter by type" className="flex flex-wrap gap-2">
                  {chips.map((c) => (
                    <FilterChip key={c.value} pressed={filter === c.value} label={c.name} count={c.count} onClick={() => setFilter(c.value)} />
                  ))}
                </div>
                <InventoryGrid loadout={loadout} types={types} only={filter === 'ALL' ? undefined : filter} />
              </>
            ) : wallet ? (
              <p className="text-ink-muted body-sm">
                Nothing here yet.
                {SHOP_ENABLED ? <> Buy something in the <Link href="/shop" className="text-cyan hover:underline">shop</Link>.</> : null}
                {BATTLEPASS_ENABLED ? <> Earn items on the <Link href="/battlepass" className="text-cyan hover:underline">battlepass</Link>.</> : null}
              </p>
            ) : (
              <p role="status" className="text-ink-muted signal-nav">Loading your items…</p>
            )}
          </main>

          <aside aria-label="Loadout" className="flex flex-col gap-6">
            <Panel tone="framed" title="Loadout" meta={`${t.slots.filter((s) => loadout.equipped[s.value]).length} of ${t.slots.length} slots`} className="pb-3 min-[720px]:pb-3">
              <LoadoutList loadout={loadout} types={types} />
              {SHOP_ENABLED ? (
                <Link href="/shop" className={LINK}>
                  Get more in the shop
                  <Icon name="arrow" size={16} />
                </Link>
              ) : null}
            </Panel>
          </aside>
        </div>
      </div>
    </div>
  )
}
