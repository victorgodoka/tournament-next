'use client'

import { useMemo } from 'react'
import type { Card } from '@lib/cards.types'
import IconComponent from '@components/icon/icon.component'
import {
  buildCardLookup,
  cardCategory,
  EXTRA_TYPES,
  extraDeckType,
  groupDeckCards,
  type CardCategory,
  type DeckCardGroup,
} from '@lib/cards.utils'
import { FORMATS, GENESYS_POINT_BUDGET } from './deck-editor.const'
import type { DeckFormat, DeckZone, EditorState } from './deck-editor.types'
import type { DeckValidation } from './deck-editor.utils'
import DeckZoneComponent, { type DragPayload } from './deck-zone.component'

interface DeckPanelProps {
  state: EditorState
  validation: DeckValidation
  onFormatChange: (format: DeckFormat) => void
  onOpen: (card: Card) => void
  onIncrement: (zone: DeckZone, card: Card) => void
  onDecrement: (zone: DeckZone, id: number) => void
  onDrop: (target: DeckZone, payload: DragPayload) => void
  onSetArt: (id: number, artId: number) => void
}

const CATEGORY_RANK: Record<CardCategory, number> = { monster: 0, spell: 1, trap: 2 }

const byCategory = (a: DeckCardGroup, b: DeckCardGroup) =>
  CATEGORY_RANK[cardCategory(a.card)] - CATEGORY_RANK[cardCategory(b.card)]

const byExtraType = (a: DeckCardGroup, b: DeckCardGroup) => {
  const rank = (g: DeckCardGroup) => {
    const i = EXTRA_TYPES.indexOf(extraDeckType(g.card) ?? '')
    return i === -1 ? EXTRA_TYPES.length : i
  }
  return rank(a) - rank(b)
}

const DeckPanelComponent = ({
  state,
  validation,
  onFormatChange,
  onOpen,
  onIncrement,
  onDecrement,
  onDrop,
  onSetArt,
}: DeckPanelProps) => {
  const { mainGroups, extraGroups, sideGroups, breakdown } = useMemo(() => {
    const lookup = buildCardLookup(Object.values(state.cards))
    const main = groupDeckCards(state.main, lookup).sort(byCategory)
    const breakdown: Record<CardCategory, number> = { monster: 0, spell: 0, trap: 0 }
    for (const id of state.main) breakdown[cardCategory(state.cards[id])] += 1
    return {
      mainGroups: main,
      extraGroups: groupDeckCards(state.extra, lookup).sort(byExtraType),
      sideGroups: groupDeckCards(state.side, lookup).sort(byCategory),
      breakdown,
    }
  }, [state.main, state.extra, state.side, state.cards])

  const { counts } = validation
  const total = counts.main + counts.extra + counts.side
  const pointPct = Math.min(100, (validation.points / GENESYS_POINT_BUDGET) * 100)

  return (
    <aside className="deck-panel" aria-label="Deck">
      <div className="deck-panel__top">
        <div className="deck-panel__formats" role="tablist" aria-label="Format">
          {FORMATS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={state.format === f.value}
              className={`deck-panel__format${state.format === f.value ? ' deck-panel__format--active' : ''}`}
              onClick={() => onFormatChange(f.value)}
            >
              <IconComponent icon={f.icon} width={15} height={15} />
              {f.label}
            </button>
          ))}
        </div>
        <span className="deck-panel__total">
          <strong>{total}</strong> cards
        </span>
      </div>

      <div className="deck-panel__summary">
        <Summary label="Main" value={counts.main} min={40} max={60} />
        <Summary label="Extra" value={counts.extra} max={15} />
        <Summary label="Side" value={counts.side} max={15} />
      </div>

      <div className="deck-panel__stats">
        <Stat icon="mdi:sword-cross" tone="monster" label="Monsters" value={breakdown.monster} />
        <Stat icon="mdi:auto-fix" tone="spell" label="Spells" value={breakdown.spell} />
        <Stat icon="mdi:shield-outline" tone="trap" label="Traps" value={breakdown.trap} />
      </div>

      {state.format === 'genesys' && (
        <div className={`deck-panel__points${validation.points > GENESYS_POINT_BUDGET ? ' deck-panel__points--over' : ''}`}>
          <div className="deck-panel__points-head">
            <span>Genesys points</span>
            <strong>
              {validation.points} / {GENESYS_POINT_BUDGET}
            </strong>
          </div>
          <div className="deck-panel__points-bar" role="progressbar" aria-valuenow={validation.points} aria-valuemax={GENESYS_POINT_BUDGET}>
            <span style={{ width: `${pointPct}%` }} />
          </div>
        </div>
      )}

      {validation.issues.length > 0 ? (
        <div className="deck-panel__issues" role="status">
          <p className="deck-panel__issues-head">
            <IconComponent icon="mdi:alert-outline" width={16} height={16} />
            Deck Issues
          </p>
          <ul>
            {validation.issues.slice(0, 6).map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
            {validation.issues.length > 6 && <li>+{validation.issues.length - 6} more…</li>}
          </ul>
        </div>
      ) : total > 0 ? (
        <p className="deck-panel__legal">
          <IconComponent icon="mdi:check-decagram" width={16} height={16} />
          Deck is legal for {FORMATS.find((f) => f.value === state.format)?.label}.
        </p>
      ) : null}

      <div className="deck-panel__zones">
        <DeckZoneComponent
          zone="main" label="Main Deck" icon="mdi:cards-outline"
          groups={mainGroups} state={state} format={state.format}
          onOpen={onOpen} onIncrement={onIncrement} onDecrement={onDecrement} onDrop={onDrop}
          onSetArt={onSetArt}
        />
        <DeckZoneComponent
          zone="extra" label="Extra Deck" icon="mdi:star-four-points-outline"
          groups={extraGroups} state={state} format={state.format}
          onOpen={onOpen} onIncrement={onIncrement} onDecrement={onDecrement} onDrop={onDrop}
          onSetArt={onSetArt}
        />
        <DeckZoneComponent
          zone="side" label="Side Deck" icon="mdi:swap-horizontal"
          groups={sideGroups} state={state} format={state.format}
          onOpen={onOpen} onIncrement={onIncrement} onDecrement={onDecrement} onDrop={onDrop}
          onSetArt={onSetArt}
        />
      </div>
    </aside>
  )
}

function Summary({ label, value, min, max }: { label: string; value: number; min?: number; max?: number }) {
  const short = min !== undefined && value < min
  const over = max !== undefined && value > max
  return (
    <div className={`deck-sum${short ? ' deck-sum--short' : ''}${over ? ' deck-sum--over' : ''}`}>
      <span className="deck-sum__label">{label}</span>
      <span className="deck-sum__value">
        {value}
        <span className="deck-sum__range">{min !== undefined ? `${min}–${max}` : `/${max}`}</span>
      </span>
    </div>
  )
}

function Stat({ icon, tone, label, value }: { icon: string; tone: string; label: string; value: number }) {
  return (
    <div className="deck-stat" data-tone={tone} title={label}>
      <IconComponent icon={icon} width={15} height={15} />
      <span className="deck-stat__value">{value}</span>
    </div>
  )
}

export default DeckPanelComponent
