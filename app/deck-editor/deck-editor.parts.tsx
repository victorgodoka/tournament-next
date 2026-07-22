'use client'

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
