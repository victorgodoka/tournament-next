'use client'

import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { useAuth } from '@hooks/index'
import { ChatBubble } from '@omega/bubble'
import { Button } from '@ui/button'
import { Chip } from '@ui/chip'
import { Icon, type IconName } from '@ui/icon'
import { Thumb } from '@ui/thumb'
import { ItemTile } from '@ui/tile'
import { parseBubble } from '@utils/bubble'
import { equipItem, getWallet, unequipSlot } from '@utils/shop'
import type { ShopEnum, ShopItem, ShopWallet } from '@utils/types'

/** Art for the types that exist today; a new type from the panel falls back to the cards glyph. */
export const TYPE_ICON: Record<string, IconName> = {
  WEBDECO: 'frame',
  BACKGROUND: 'image',
  SONG: 'song',
  MSGBUBBLE: 'bubble',
  CUSTOMBADGE: 'badge',
  ANIMATEDFAV: 'cards',
}

/** A bubble is its own best picture: draw it with the item's `data` and sticker. */
export const bubblePreview = (item: ShopItem) =>
  item.type === 'MSGBUBBLE' ? (
    <span className="flex flex-col gap-3 px-6 text-[13px] normal-case tracking-normal">
      <ChatBubble style={parseBubble(item.data)} sticker={item.assetUrl}>gg, well played!</ChatBubble>
    </span>
  ) : undefined

/** Mono, 11px: chips that read as labels, not the 10px status chip. */
export const LABEL_CHIP = 'text-[11px] tracking-[0.14em]'

export const Equipped = ({ className }: { className?: string }) => (
  <Chip className={twMerge('h-auto gap-1.5 px-2.5 py-2 text-cyan [--edge:var(--color-ground-cyan)] [--fill:var(--color-ground-cyan)]', LABEL_CHIP, className)}>
    <Icon name="check" size={14} />
    Equipped
  </Chip>
)

const SOURCE = { purchase: 'Purchase', battlepass: 'Battlepass', reward: 'Reward' }
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const dayLabel = (date: Date) =>
  `${date.toLocaleString('en-US', { weekday: 'short' })} ${date.toLocaleString('en-US', { day: '2-digit' })} ${date.toLocaleString('en-US', { month: 'short' })}`

/** Labels read from the catalog's `types`, so a new type shows without a release. */
export const typesOf = (types: ShopEnum[]) => {
  const by = new Map(types.map((t) => [t.value, t]))
  return {
    name: (value: string) => by.get(value)?.name ?? value,
    description: (value: string) => by.get(value)?.description,
    surfaces: (value: string) => (by.get(value)?.surfaces ?? []).map(cap).join(' · '),
    equippable: (value: string) => !!by.get(value)?.equippable,
    slots: types.filter((t) => t.equippable && !t.currency),
  }
}

/**
 * The signed-in duelist's wallet, and equip/unequip on it. The loadout updates once the API
 * answers, then `/auth/me` is re-read so the header's frame follows.
 */
export const useLoadout = () => {
  const { user, refresh } = useAuth()
  const [wallet, setWallet] = useState<ShopWallet | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    const controller = new AbortController()
    getWallet(controller.signal).then(setWallet).catch((e) => controller.signal.aborted || console.error(e))
    return () => controller.abort()
    // Only on sign-in: `refresh` hands back a new `user` object after every equip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const setSlot = (slot: string, item: ShopItem | null) => {
    setError(null)
    ;(item ? equipItem(slot, item.id) : unequipSlot(slot))
      .then(() => {
        setWallet((w) => {
          if (!w) return w
          const next = { ...w.equipped }
          if (item) next[slot] = { ...item, slot, equippedAt: new Date().toISOString() }
          else delete next[slot]
          return { ...w, equipped: next }
        })
        refresh()
      })
      .catch((e) => {
        console.error(e)
        setError("That didn't go through. Reload the page and try again.")
      })
  }

  const equipped = wallet?.equipped ?? {}
  return {
    user,
    wallet,
    setWallet,
    equipped,
    isEquipped: (item: ShopItem) => equipped[item.type]?.id === item.id,
    setSlot,
    error,
  }
}

type Loadout = ReturnType<typeof useLoadout>

/** Every owned item as a tile, with Equip or Remove. `only` narrows it to one type. */
export const InventoryGrid = ({ loadout, types, only, className }: { loadout: Loadout; types: ShopEnum[]; only?: string; className?: string }) => {
  const t = typesOf(types)
  const items = (loadout.wallet?.items ?? []).filter((i) => !only || i.type === only)
  return (
    <div className={twMerge('grid grid-cols-2 gap-4 md:grid-cols-3 min-[720px]:gap-6 xl:grid-cols-4', className)}>
      {items.map((item) => {
        const on = loadout.isEquipped(item)
        return (
          <ItemTile
            key={item.id}
            src={`/items/${item.id}.png`}
            art={bubblePreview(item)}
            icon={TYPE_ICON[item.type] ?? 'cards'}
            selected={on}
            kicker={t.name(item.type)}
            title={item.name}
            detail={`${SOURCE[item.source]} · ${dayLabel(new Date(item.acquiredAt))}`}
            footer={
              on ? (
                <>
                  <Equipped />
                  <Button variant="ghost" size="signal" className="px-2 hover:[--fill:transparent]" aria-label={`Remove ${item.name} from its slot`} onClick={() => loadout.setSlot(item.type, null)}>
                    Remove
                  </Button>
                </>
              ) : (
                <>
                  <span className="pb-4 text-ink-muted signal-sm">{t.surfaces(item.type)}</span>
                  {t.equippable(item.type) ? (
                    <Button variant="secondary" size="signal" aria-label={`Equip ${item.name}`} onClick={() => loadout.setSlot(item.type, item)}>
                      Equip
                    </Button>
                  ) : null}
                </>
              )
            }
          />
        )
      })}
    </div>
  )
}

/** One row per slot: what's in it, and Remove. */
export const LoadoutList = ({ loadout, types }: { loadout: Loadout; types: ShopEnum[] }) => {
  const t = typesOf(types)
  return (
    <ul className="flex flex-col gap-px bg-line">
      {t.slots.map((slot) => {
        const item = loadout.equipped[slot.value]
        return (
          <li key={slot.value} className="flex items-center gap-3 bg-surface-100 py-2.5">
            <Thumb wide className={item ? 'text-cyan' : undefined}>
              <Icon name={TYPE_ICON[slot.value] ?? 'cards'} size={20} />
            </Thumb>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-ink-muted signal-sm">
                {slot.name} · {t.surfaces(slot.value)}
              </span>
              <span className={twMerge('text-[15px] leading-5.5 font-bold', item ? 'text-ink' : 'text-ink-muted')}>{item?.name ?? 'Empty'}</span>
            </span>
            {item ? (
              <Button variant="ghost" size="signal" className="px-2 hover:[--fill:transparent]" aria-label={`Empty the ${slot.name} slot`} onClick={() => loadout.setSlot(slot.value, null)}>
                Remove
              </Button>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
