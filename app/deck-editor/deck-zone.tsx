'use client'

import { useTranslations } from 'next-intl'
import { useMemo, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { SectionHead } from '@ui/section-head'
import { TypeCounts, type CardType } from '@ui/type-counts'
import { frameOf } from '@utils/deck/model'
import type { CardMap, Zone } from '@utils/deck/types'
import type { ViewMode } from './deck-editor.reducer'
import { CardTile } from './card-tile'
import { swipeCommits, swipeTravel } from './gestures'

export type DragPayload = { from: Zone | 'pool'; id: number; index?: number }

export const DRAG_TYPE = 'application/x-deck-card'

const SOURCES: ReadonlyArray<DragPayload['from']> = ['main', 'extra', 'side', 'pool']

/** Drops can come from another page or app; only a well-formed payload of ours is accepted. */
const readPayload = (e: React.DragEvent): DragPayload | null => {
  try {
    const p = JSON.parse(e.dataTransfer.getData(DRAG_TYPE)) as Partial<DragPayload>
    if (!SOURCES.includes(p.from!) || !Number.isInteger(p.id)) return null
    return { from: p.from!, id: p.id!, index: Number.isInteger(p.index) ? p.index : undefined }
  } catch {
    return null
  }
}

/** `TypeCounts` order: the main-deck frames, spells and traps, then the extra-deck frames. */
const TYPE_ORDER: CardType[] = ['normal', 'effect', 'ritual', 'spell', 'trap', 'fusion', 'synchro', 'xyz', 'link']

const GRID = {
  main: 'grid-cols-5 sm:grid-cols-8 lg:grid-cols-10',
  extra: 'grid-cols-5 sm:grid-cols-8 lg:grid-cols-15',
  side: 'grid-cols-5 sm:grid-cols-8 lg:grid-cols-15',
}
// The deck column is ~62% of the viewport on lg.
const SIZES = {
  main: '(min-width: 1024px) 6vw, (min-width: 640px) 12vw, 20vw',
  extra: '(min-width: 1024px) 4vw, (min-width: 640px) 12vw, 20vw',
  side: '(min-width: 1024px) 4vw, (min-width: 640px) 12vw, 20vw',
}

/** 32px on a desktop row, 44px tap targets below lg or on a coarse pointer. */
const ROW_BUTTON = 'size-8 shrink-0 cursor-pointer text-ink-dim hover:text-ink max-lg:size-11 pointer-coarse:size-11'

type DeckZoneProps = {
  zone: Zone
  ids: number[]
  cards: CardMap
  view: ViewMode
  /** Passcodes that are part of a validation problem. */
  problems: ReadonlySet<number>
  onRemove(id: number): void
  onDropCard(payload: DragPayload, index?: number): void
  onOpen(id: number): void
}

export const DeckZone = ({ zone, ids, cards, view, problems, onRemove, onDropCard, onOpen }: DeckZoneProps) => {
  const t = useTranslations('DeckEditor.zones')
  const [over, setOver] = useState(false)
  const [swipe, setSwipe] = useState<{ id: number; dx: number } | null>(null)
  const swipeStart = useRef<{ id: number; x: number; y: number } | null>(null)

  const unique = useMemo(() => {
    const counts = new Map<number, number>()
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1)
    return [...counts]
  }, [ids])

  const typeCounts = useMemo(() => {
    const counts = new Map<CardType, number>()
    for (const id of ids) {
      const card = cards.get(id)
      if (card) counts.set(frameOf(card), (counts.get(frameOf(card)) ?? 0) + 1)
    }
    return TYPE_ORDER.filter((type) => counts.has(type)).map((type) => ({ type, count: counts.get(type)! }))
  }, [ids, cards])

  const nameOf = (id: number) => cards.get(id)?.name ?? String(id)

  /** List rows: a touch or pen swipe left past 64 px removes a copy; the row follows the finger until then. */
  const rowSwipe = (id: number) => {
    const end = () => {
      swipeStart.current = null
      setSwipe(null)
    }
    return {
      onPointerDown: (e: React.PointerEvent) => {
        swipeStart.current = e.pointerType === 'mouse' ? null : { id, x: e.clientX, y: e.clientY }
      },
      onPointerMove: (e: React.PointerEvent) => {
        const s = swipeStart.current
        if (s?.id !== id) return
        const dx = swipeTravel(e.clientX - s.x, e.clientY - s.y)
        setSwipe(dx ? { id, dx } : null)
      },
      onPointerUp: (e: React.PointerEvent) => {
        const s = swipeStart.current
        end()
        if (s?.id === id && swipeCommits(e.clientX - s.x, e.clientY - s.y)) onRemove(id)
      },
      onPointerCancel: end,
    }
  }

  const dragStart = (id: number, index: number) => (e: React.DragEvent) => {
    e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ from: zone, id, index } satisfies DragPayload))
    e.dataTransfer.effectAllowed = 'move'
  }
  const open = (id: number) => (e: React.MouseEvent) => {
    e.preventDefault()
    onOpen(id)
  }

  const drop = (e: React.DragEvent<HTMLElement>) => {
    setOver(false)
    const payload = readPayload(e)
    if (!payload) return
    e.preventDefault()
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-index]')
    onDropCard(payload, target ? Number(target.dataset.index) : undefined)
  }

  return (
    <section
      id={`zone-${zone}`}
      data-zone={zone}
      aria-labelledby={`zone-${zone}-title`}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(DRAG_TYPE)) return
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false)
      }}
      onDrop={drop}
      className={twMerge('flex flex-col gap-3 p-2', over && 'bg-ground-cyan')}
    >
      <SectionHead compact as="h2" end={<TypeCounts items={typeCounts} />}>
        <span id={`zone-${zone}-title`}>
          {t(zone)} <span className="text-ink-muted signal">{ids.length}</span>
        </span>
      </SectionHead>

      {!ids.length ? (
        <p className="border border-dashed border-line-mid py-6 text-center text-ink-muted signal-sm">{t('empty')}</p>
      ) : view === 'list' ? (
        <ul className="flex flex-col divide-y divide-line border-y border-line">
          {unique.map(([id, count]) => {
            const card = cards.get(id)
            const level = card?.level
            const levelKey = card?.monsterTypes.includes('xyz') ? 'rank' : card?.monsterTypes.includes('link') ? 'link' : 'level'
            const dx = swipe?.id === id ? swipe.dx : 0
            return (
              <li
                key={id}
                data-card={id}
                data-index={ids.indexOf(id)}
                draggable
                onDragStart={dragStart(id, ids.indexOf(id))}
                onContextMenu={open(id)}
                {...rowSwipe(id)}
                // pan-y: the list still scrolls under a vertical swipe; horizontal ones come to us.
                className={twMerge('relative touch-pan-y overflow-hidden', problems.has(id) && 'outline outline-2 outline-crimson-lift')}
              >
                {dx ? (
                  <span aria-hidden style={{ width: -dx }} className="absolute inset-y-0 right-0 grid place-items-center overflow-hidden bg-crimson text-ink mono-data">
                    −1
                  </span>
                ) : null}
                <div style={dx ? { transform: `translateX(${dx}px)` } : undefined} className="flex items-center gap-3 px-2 py-1.5">
                  <span className="w-8 shrink-0 text-ink-muted mono-data">{t('copies', { count })}</span>
                  <span className="min-w-0 flex-1 truncate text-ink body-sm">{nameOf(id)}</span>
                  <span className="shrink-0 text-ink-muted signal-sm max-sm:hidden">{card?.humanReadableCardType}</span>
                  <span className="w-14 shrink-0 text-ink-muted signal-sm">{level != null ? t(levelKey, { level }) : null}</span>
                  <button type="button" aria-label={t('removeOne', { name: nameOf(id) })} onClick={() => onRemove(id)} className={ROW_BUTTON}>
                    −
                  </button>
                  <button type="button" aria-label={t('addOne', { name: nameOf(id) })} onClick={() => onDropCard({ from: 'pool', id })} className={ROW_BUTTON}>
                    +
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <ul className={twMerge('grid gap-1', GRID[zone])}>
          {(view === 'stacked' ? unique : ids.map((id) => [id, 1] as const)).map(([id, count], i) => {
            const index = view === 'stacked' ? ids.indexOf(id) : i
            return (
              <li key={`${id}-${i}`} data-card={id} data-index={index}>
                <CardTile
                  id={id}
                  card={cards.get(id)}
                  sizes={SIZES[zone]}
                  count={count}
                  problem={problems.has(id)}
                  label={t('removeOne', { name: nameOf(id) })}
                  onClick={() => onRemove(id)}
                  onContextMenu={open(id)}
                  onInfo={() => onOpen(id)}
                  draggable
                  onDragStart={dragStart(id, index)}
                />
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
