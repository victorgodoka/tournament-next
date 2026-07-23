'use client'

import { useEffect, useRef } from 'react'
import type { Card } from '@lib/cards.types'
import { cardDisplayName, cardImageUrl, isExtra } from '@lib/cards.utils'
import IconComponent from '@components/icon/icon.component'
import { CARD_PLACEHOLDER_SRC } from '@app/profile/profile.const'
import { BAN_LABEL, FORMATS } from './deck-editor.const'
import type { DeckFormat, DeckZone, EditorState } from './deck-editor.types'
import { banStatus, canAdd, genesysCost, totalCopies } from './deck-editor.utils'
import ShimmerImage from '@components/shimmer/shimmer.component'

interface CardDetailModalProps {
  card: Card | null
  state: EditorState
  onClose: () => void
  onAdd: (zone: DeckZone, card: Card) => void
}

/** A labelled stat cell, shown only when the value is present. */
function Stat({ label, value }: { label: string; value: string | number | undefined | null }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <div className="neuron__stat">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

const CardDetailModal = ({ card, state, onClose, onAdd }: CardDetailModalProps) => {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (card && !dialog.open) dialog.showModal()
    if (!card && dialog.open) dialog.close()
  }, [card])

  if (!card) return null

  const extra = isExtra(card)
  const inDeck = totalCopies(state, card.id)
  const tags = [...card.type_tags, ...card.genre_tags]
  const zones: DeckZone[] = extra ? ['extra', 'side'] : ['main', 'side']

  return (
    <dialog
      ref={ref}
      className="neuron"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
    >
      <div className="neuron__inner">
        <header className="neuron__head">
          <h2 className="neuron__name">{cardDisplayName(card)}</h2>
          <button type="button" className="neuron__close" onClick={onClose} aria-label="Close card details">
            <IconComponent icon="mdi:close" width={20} height={20} />
          </button>
        </header>

        <div className="neuron__body">
          <div className="neuron__art">
            <ShimmerImage
              src={cardImageUrl(card.id)}
              alt={cardDisplayName(card)}
              width={192}
              height={280}
              loading="lazy"
              decoding="async"
            />
            {inDeck > 0 && <span className="neuron__in-deck">{inDeck} in deck</span>}
          </div>

          <div className="neuron__details">
            <p className="neuron__typeline">
              {[card.type_primary, card.race, card.attribute].filter(Boolean).join(' · ')}
            </p>

            <dl className="neuron__stats">
              <Stat label="ATK" value={card.atk} />
              <Stat label="DEF" value={card.def} />
              <Stat label="Level / Rank" value={card.level} />
              {card.leftScale != null && <Stat label="Scale" value={`${card.leftScale} / ${card.rightScale}`} />}
              <Stat label="Passcode" value={card.id} />
            </dl>

            {card.desc_en && <p className="neuron__desc">{card.desc_en}</p>}

            {tags.length > 0 && (
              <ul className="neuron__tags">
                {tags.map((tag) => (
                  <li key={tag}>{tag}</li>
                ))}
              </ul>
            )}

            <div className="neuron__banlist">
              <span className="neuron__banlist-title">Banlist</span>
              {FORMATS.map((f) => (
                <BanRow key={f.value} card={card} format={f.value} label={f.label} />
              ))}
            </div>

            {card.sets.length > 0 && (
              <p className="neuron__sets">
                <strong>Sets:</strong>{' '}
                {card.sets.slice(0, 8).map((s) => s.code).join(', ')}
                {card.sets.length > 8 ? '…' : ''}
              </p>
            )}
          </div>
        </div>

        <footer className="neuron__actions">
          {zones.map((zone) => (
            <button
              key={zone}
              type="button"
              className="neuron__add"
              disabled={!canAdd(state, card, zone)}
              onClick={() => onAdd(zone, card)}
            >
              <IconComponent icon="mdi:plus" width={16} height={16} />
              Add to {zone === 'main' ? 'Main' : zone === 'extra' ? 'Extra' : 'Side'}
            </button>
          ))}
        </footer>
      </div>
    </dialog>
  )
}

function BanRow({ card, format, label }: { card: Card; format: DeckFormat; label: string }) {
  const status = banStatus(card, format)
  const points = format === 'genesys' ? genesysCost(card) : 0
  return (
    <span className={`neuron__ban neuron__ban--${status}`}>
      {label}: {BAN_LABEL[status]}
      {points ? ` · ${points}pt` : ''}
    </span>
  )
}

export default CardDetailModal
