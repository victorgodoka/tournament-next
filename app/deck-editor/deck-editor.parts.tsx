'use client'

import { useEffect, useRef, useState } from 'react'
import type { Card } from '@lib/cards.types'
import { cardDisplayName, cardImageUrl } from '@lib/cards.utils'
import IconComponent from '@components/icon/icon.component'
import { BAN_LABEL } from './deck-editor.const'
import type { BanStatus } from './deck-editor.types'

const BAN_ICON: Record<Exclude<BanStatus, 'unlimited'>, string> = {
  forbidden: 'mdi:cancel',
  limited: 'mdi:numeric-1-circle-outline',
  'semi-limited': 'mdi:numeric-2-circle-outline',
}

/** Small banlist indicator — a coloured pill for Forbidden/Limited/Semi, and
 * a point cost for Genesys. Renders nothing for an unrestricted card. */
export function BanlistBadge({
  status,
  points,
  compact = false,
}: {
  status: BanStatus
  points?: number
  compact?: boolean
}) {
  if (status === 'unlimited' && !points) return null

  return (
    <span className="ban-badge-group">
      {status !== 'unlimited' && (
        <span
          className={`ban-badge ban-badge--${status}`}
          title={`${BAN_LABEL[status]} on this banlist`}
        >
          <IconComponent icon={BAN_ICON[status]} width={13} height={13} />
          {!compact && <span className="ban-badge__label">{BAN_LABEL[status]}</span>}
        </span>
      )}
      {points ? (
        <span className="ban-badge ban-badge--points" title={`${points} Genesys points per copy`}>
          <IconComponent icon="mdi:diamond-stone" width={12} height={12} />
          {points}
        </span>
      ) : null}
    </span>
  )
}

/** −  N  + control for adjusting a card's copy count. */
export function QuantityStepper({
  count,
  max,
  onIncrement,
  onDecrement,
  addDisabled = false,
  label,
  size = 'md',
}: {
  count: number
  max?: number
  onIncrement: () => void
  onDecrement: () => void
  addDisabled?: boolean
  label: string
  size?: 'sm' | 'md'
}) {
  return (
    <div className={`stepper stepper--${size}`} role="group" aria-label={label}>
      <button
        type="button"
        className="stepper__btn"
        onClick={onDecrement}
        disabled={count === 0}
        aria-label={`Remove one ${label}`}
      >
        <IconComponent icon="mdi:minus" width={15} height={15} />
      </button>
      <span className="stepper__count" aria-live="polite">
        {count}
        {max !== undefined && <span className="stepper__max">/{max}</span>}
      </span>
      <button
        type="button"
        className="stepper__btn"
        onClick={onIncrement}
        disabled={addDisabled}
        aria-label={`Add one ${label}`}
      >
        <IconComponent icon="mdi:plus" width={15} height={15} />
      </button>
    </div>
  )
}

/** Cosmetic art switcher for a deck row — lets the player pick which of the
 * card's alt arts (`card.alias`) is displayed, without changing the id
 * actually in the deck. Renders nothing for a card with no alt arts. */
export function ArtPicker({
  card,
  selectedId,
  onSelect,
}: {
  card: Card
  selectedId: number
  onSelect: (id: number) => void
}) {
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  if (!card.alias || card.alias.length === 0) return null
  const options = [card.id, ...card.alias]

  return (
    <div className="art-picker" ref={boxRef}>
      <button
        type="button"
        className="art-picker__toggle"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Change art for ${cardDisplayName(card)}`}
        onClick={(event) => {
          event.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        <IconComponent icon="mdi:image-multiple-outline" width={14} height={14} />
      </button>
      {open && (
        <ul className="art-picker__menu" role="listbox">
          {options.map((id) => (
            <li key={id}>
              <button
                type="button"
                role="option"
                aria-selected={id === selectedId}
                className="art-picker__option"
                data-active={id === selectedId || undefined}
                onClick={(event) => {
                  event.stopPropagation()
                  onSelect(id)
                  setOpen(false)
                }}
              >
                <img src={cardImageUrl(id, true)} alt="" width={32} height={32} loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
