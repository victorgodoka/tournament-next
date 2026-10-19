'use client'

import { useTranslations } from 'next-intl'
import { useRef } from 'react'
import { twMerge } from 'tailwind-merge'
import { Button } from '@ui/button'
import { Icon } from '@ui/icon'
import { Panel } from '@ui/panel'
import { CardTile } from '@app/deck-builder/card-tile'
import type { CardMap } from '@utils/deck/types'
import { isMonsterSlot } from '@utils/simulator/board'
import type { Board, MonsterSlot, Pile } from '@utils/simulator/types'
import { MARK } from './board'

export type PilePanelProps = {
  board: Board
  /** A pile lists all its cards, top first; a monster slot lists the stack under its monster. */
  zone: Pile | MonsterSlot
  cards: CardMap
  onCard(id: number, e: React.MouseEvent): void
  onMenu(id: number, e: React.MouseEvent): void
  onClose(): void
}

/**
 * A non-modal list of one pile (or of a monster's Xyz materials), the board still in view. On desktop it sits
 * at the top of the side column; below `lg` it is fixed to the bottom and scrolls. A touch tap opens the menu
 * instead of dragging, which would fight the list's scroll.
 */
export const PilePanel = ({ board, zone, cards, onCard, onMenu, onClose }: PilePanelProps) => {
  const t = useTranslations('Simulator')
  const touch = useRef(false)
  const stack = isMonsterSlot(zone)
  const ids = stack ? board.zones[zone].slice(1) : board.zones[zone]
  const name = stack ? t('pile.materials', { count: ids.length }) : t(`zones.${zone}`)

  return (
    <Panel
      tone="framed"
      title={name}
      meta={stack ? t(`zones.${zone}`) : ids.length}
      actions={
        <Button variant="ghost" size="icon-sm" aria-label={t('pile.close')} onClick={onClose} className="max-lg:size-11">
          <Icon name="close" />
        </Button>
      }
      className="p-4 min-[720px]:p-4 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-(--z-dock) max-lg:flex max-lg:max-h-[45dvh] max-lg:flex-col"
    >
      {/* The list scrolls, not the panel: the chamfer is drawn on the panel and would scroll away with it. */}
      <div className="min-h-0 overflow-y-auto lg:max-h-[55dvh]">
        {ids.length ? (
          <ul aria-label={name} className="grid grid-cols-[repeat(auto-fill,64px)] gap-1">
            {ids.map((id) => {
              const card = board.cards[id]!
              return (
                <li key={id} className="relative">
                  <CardTile
                    id={card.code}
                    card={cards.get(card.code)}
                    sizes="64px"
                    data-card={id}
                    onPointerDown={(e) => {
                      touch.current = e.pointerType !== 'mouse'
                    }}
                    onClick={(e) => (touch.current && e.detail > 0 ? onMenu(id, e) : onCard(id, e))}
                    onContextMenu={(e) => onMenu(id, e)}
                  />
                  {card.face === 'down' ? (
                    <span className={twMerge(MARK, 'top-0 right-0 text-ink')}>
                      <Icon name="down" size={14} label={t('faceDown')} />
                    </span>
                  ) : null}
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
