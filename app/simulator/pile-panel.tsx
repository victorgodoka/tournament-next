'use client'

import { useTranslations } from 'next-intl'
import { useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Button } from '@ui/button'
import { Icon } from '@ui/icon'
import { Panel } from '@ui/panel'
import { CardTile } from '@app/deck-builder/card-tile'
import type { CardMap } from '@utils/deck/types'
import { isMonsterSlot } from '@utils/simulator/board'
import type { Board, MonsterSlot, Pile } from '@utils/simulator/types'
import { ActivationMarks, MARK } from './board'
import type { Activation } from './board'
import type { Drag } from './use-drag'

export type PilePanelProps = {
  board: Board
  /** A pile lists all its cards, top first; a monster slot lists the stack under its monster. */
  zone: Pile | MonsterSlot
  cards: CardMap
  /** The same glow and rings as on the board, so a card picked here shows it. */
  activation: Activation | null
  /** Target mode: a tap picks the card, as a click does, instead of opening its menu. */
  picking: boolean
  /** Its place among the open windows: each one opens a little further down and in from the last. */
  index: number
  onCard(id: number, e: React.MouseEvent): void
  onMenu(id: number, e: React.MouseEvent): void
  onHover?(id: number | null): void
  drag: Drag
  onClose(): void
}

/** The window's width from `lg`, and the space kept from the viewport edges. */
const WIDTH = 320
const EDGE = 16
/** Each window opens this far down and in from the one before. */
const CASCADE = 28

/**
 * A non-modal list of one pile (or of a monster's Xyz materials), the board still in view. From `lg` it is a floating
 * window over the page, dragged by its header anywhere on screen; below `lg` it is fixed to the bottom and scrolls. A
 * touch tap opens the menu instead of dragging, which would fight the list's scroll (in target mode it picks the card);
 * a mouse or pen drags a card out onto the board.
 */
export const PilePanel = ({ board, zone, cards, activation, picking, index, onCard, onMenu, onHover, drag, onClose }: PilePanelProps) => {
  const t = useTranslations('Simulator')
  const touch = useRef(false)
  const stack = isMonsterSlot(zone)
  const ids = stack ? board.zones[zone].slice(1) : board.zones[zone]
  const name = stack ? t('pile.materials', { count: ids.length }) : t(`zones.${zone}`)

  // Where the window sits, from `lg`: opened over the side column, then wherever its header was dragged to.
  const [pos, setPos] = useState(() => ({ x: Math.max(EDGE, window.innerWidth - WIDTH - EDGE - index * CASCADE), y: 120 + index * CASCADE }))
  /** The pointer's offset from the window's corner while its header is held. */
  const held = useRef<{ dx: number; dy: number } | null>(null)
  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || (e.target as Element).closest('button')) return
    held.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const h = held.current
    if (!h) return
    setPos({
      x: Math.max(EDGE, Math.min(e.clientX - h.dx, window.innerWidth - WIDTH - EDGE)),
      y: Math.max(EDGE, Math.min(e.clientY - h.dy, window.innerHeight - 80)),
    })
  }
  const release = () => {
    held.current = null
  }

  return (
    <Panel
      tone="framed"
      label={name}
      style={{ '--x': `${pos.x}px`, '--y': `${pos.y}px` } as React.CSSProperties}
      className={twMerge(
        'flex flex-col p-0 min-[720px]:p-0',
        'max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-(--z-dock) max-lg:max-h-[45dvh]',
        'lg:fixed lg:top-(--y) lg:left-(--x) lg:z-(--z-dock-window) lg:w-80 lg:max-h-[60dvh] lg:shadow-lift',
      )}
    >
      {/* The handle: held and moved with the pointer (`touch-none`, so the finger moves the window, not the page). */}
      <header
        data-handle
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={release}
        onPointerCancel={release}
        className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-2 select-none lg:cursor-move lg:touch-none"
      >
        <h3 className="display-3">{name}</h3>
        <span className="ml-auto text-ink-muted signal-sm">{stack ? t(`zones.${zone}`) : ids.length}</span>
        <Button variant="ghost" size="icon-sm" aria-label={t('pile.close')} onClick={onClose} className="max-lg:size-11">
          <Icon name="close" />
        </Button>
      </header>
      {/* The list scrolls, not the panel: the chamfer is drawn on the panel and would scroll away with it. */}
      <div className="min-h-0 overflow-y-auto p-4">
        {ids.length ? (
          <ul aria-label={name} className="grid grid-cols-[repeat(auto-fill,64px)] gap-1">
            {ids.map((id) => {
              const card = board.cards[id]!
              const move = drag.bind(id, false) // not for a finger: it scrolls the list
              return (
                <li key={id} className="relative" onPointerEnter={() => onHover?.(id)} onPointerLeave={() => onHover?.(null)}>
                  <CardTile
                    id={card.code}
                    card={cards.get(card.code)}
                    sizes="64px"
                    data-card={id}
                    {...move}
                    onPointerDown={(e) => {
                      touch.current = e.pointerType !== 'mouse'
                      move.onPointerDown(e)
                    }}
                    onClick={(e) => (touch.current && e.detail > 0 && !picking ? onMenu(id, e) : onCard(id, e))}
                    onContextMenu={(e) => onMenu(id, e)}
                  />
                  {card.face === 'down' ? (
                    <span className={twMerge(MARK, 'top-0 right-0 text-ink')}>
                      <Icon name="down" size={14} label={t('faceDown')} />
                    </span>
                  ) : null}
                  <ActivationMarks active={activation?.card === id} targeted={!!activation?.targets.includes(id)} />
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-ink-muted body-sm">{t('pile.empty')}</p>
        )}
      </div>
    </Panel>
  )
}
