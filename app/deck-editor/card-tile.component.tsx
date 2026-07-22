'use client'

import { memo, type DragEvent } from 'react'
import type { Card } from '@lib/cards.types'
import { cardImageUrl } from '@lib/cards.utils'
import { CARD_PLACEHOLDER_SRC } from '@app/profile/profile.const'
import type { BanStatus } from './deck-editor.types'
import { BanlistBadge, QuantityStepper } from './deck-editor.parts'

export interface CardTileProps {
  card: Card
  /** Total copies already in the deck (all zones). */
  count: number
  /** Per-card copy limit for the active format. */
  max: number
  status: BanStatus
  points?: number
  addDisabled: boolean
  onOpen: (card: Card) => void
  onAdd: (card: Card) => void
  onRemove: (card: Card) => void
}

/** Payload every draggable card writes, read by the deck zones on drop. */
export const DRAG_MIME = 'application/x-ygo-card'

function CardTileBase({
  card,
  count,
  max,
  status,
  points,
  addDisabled,
  onOpen,
  onAdd,
  onRemove,
}: CardTileProps) {
  const handleDragStart = (event: DragEvent<HTMLElement>) => {
    event.dataTransfer.setData(DRAG_MIME, JSON.stringify({ card, source: 'grid' }))
    event.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <article
      className="card-tile"
      data-in-deck={count > 0 || undefined}
      draggable
      onDragStart={handleDragStart}
      onClick={() => onOpen(card)}
      onContextMenu={(event) => {
        event.preventDefault()
        onAdd(card)
      }}
      title={`${card.name_en} — left-click for details, right-click to add`}
    >
      <div className="card-tile__art">
        <img
          className="card-tile__img"
          src={cardImageUrl(card.id)}
          alt={card.name_en}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={(event) => {
            event.currentTarget.src = CARD_PLACEHOLDER_SRC
          }}
        />
        <span className="card-tile__badges">
          <BanlistBadge status={status} points={points} compact />
        </span>
        {count > 0 && (
          <span className="card-tile__count" aria-label={`${count} in deck`}>
            ×{count}
          </span>
        )}
      </div>

      <div className="card-tile__foot" onClick={(event) => event.stopPropagation()}>
        <span className="card-tile__name">{card.name_en}</span>
        <QuantityStepper
          size="sm"
          count={count}
          max={max}
          addDisabled={addDisabled}
          onIncrement={() => onAdd(card)}
          onDecrement={() => onRemove(card)}
          label={card.name_en}
        />
      </div>
    </article>
  )
}

const CardTile = memo(CardTileBase)
export default CardTile
