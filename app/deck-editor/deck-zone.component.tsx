'use client'

import { useState, type DragEvent } from 'react'
import type { Card } from '@lib/cards.types'
import { cardDisplayName, cardImageUrl, cardCategory, type DeckCardGroup } from '@lib/cards.utils'
import IconComponent from '@components/icon/icon.component'
import { ZONE_LIMITS } from './deck-editor.const'
import type { DeckFormat, DeckZone } from './deck-editor.types'
import { banStatus, canAdd, copyLimit, genesysCost } from './deck-editor.utils'
import type { EditorState } from './deck-editor.types'
import { BanlistBadge, QuantityStepper } from './deck-editor.parts'
import { DRAG_MIME } from './card-tile.component'
import Image from 'next/image'

export interface DragPayload {
  card: Card
  source: 'grid' | DeckZone
}

interface DeckZoneProps {
  zone: DeckZone
  label: string
  icon: string
  groups: DeckCardGroup[]
  state: EditorState
  format: DeckFormat
  onOpen: (card: Card) => void
  onIncrement: (zone: DeckZone, card: Card) => void
  onDecrement: (zone: DeckZone, id: number) => void
  onDrop: (target: DeckZone, payload: DragPayload) => void
}

const readPayload = (event: DragEvent): DragPayload | null => {
  const raw = event.dataTransfer.getData(DRAG_MIME)
  if (!raw) return null
  try {
    return JSON.parse(raw) as DragPayload
  } catch {
    return null
  }
}

const DeckZoneComponent = ({
  zone,
  label,
  icon,
  groups,
  state,
  format,
  onOpen,
  onIncrement,
  onDecrement,
  onDrop,
}: DeckZoneProps) => {
  const [dragOver, setDragOver] = useState(false)
  const count = state[zone].length
  const { max } = ZONE_LIMITS[zone]
  const over = count > max

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragOver(false)
    const payload = readPayload(event)
    if (payload) onDrop(zone, payload)
  }

  return (
    <section className="deck-zone" aria-label={label}>
      <header className="deck-zone__head">
        <h3 className="deck-zone__title">
          <IconComponent icon={icon} width={16} height={16} />
          {label}
        </h3>
        <span className={`deck-zone__count${over ? ' deck-zone__count--over' : ''}`}>
          {count}
          <span className="deck-zone__limit">/{max}</span>
        </span>
      </header>

      <div
        className={`deck-zone__body${dragOver ? ' deck-zone__body--drop' : ''}`}
        onDragOver={(event) => {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'copy'
          if (!dragOver) setDragOver(true)
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragOver(false)
        }}
        onDrop={handleDrop}
      >
        {groups.length === 0 ? (
          <p className="deck-zone__empty">Drag cards here, or right-click a card to add it.</p>
        ) : (
          <ul className="deck-zone__list" role="list">
            {groups.map((group) => {
              if (!group.card) return null
              const card = group.card
              return (
                <li
                  key={group.id}
                  className="deck-row"
                  data-category={cardCategory(card)}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData(
                      DRAG_MIME,
                      JSON.stringify({ card, source: zone } satisfies DragPayload),
                    )
                    event.dataTransfer.effectAllowed = 'move'
                  }}
                >
                  <button
                    type="button"
                    className="deck-row__card"
                    onClick={() => onOpen(card)}
                    aria-label={`${cardDisplayName(card)} details`}
                  >
                    <Image
                      className="deck-row__thumb"
                      src={cardImageUrl(card.id, true)}
                      alt=""
                      width={25}
                      height={25}
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                    />
                    <span className="deck-row__name">{cardDisplayName(card)}</span>
                  </button>
                  <BanlistBadge
                    status={banStatus(card, format)}
                    points={format === 'genesys' ? genesysCost(card) : undefined}
                    compact
                  />
                  <QuantityStepper
                    size="sm"
                    count={group.count}
                    max={copyLimit(card, format)}
                    addDisabled={!canAdd(state, card, zone)}
                    onIncrement={() => onIncrement(zone, card)}
                    onDecrement={() => onDecrement(zone, group.id)}
                    label={cardDisplayName(card)}
                  />
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}

export default DeckZoneComponent
