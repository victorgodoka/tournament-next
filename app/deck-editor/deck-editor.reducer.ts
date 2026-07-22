import type { Card } from '@lib/cards.types'
import { ZONE_LIMITS } from './deck-editor.const'
import type { DeckFormat, DeckZone, EditorState } from './deck-editor.types'
import { canAdd, copyLimit, defaultZone, totalCopies, zoneCopies } from './deck-editor.utils'

export type EditorAction =
  | { type: 'add'; card: Card; zone?: DeckZone }
  | { type: 'remove'; zone: DeckZone; id: number }
  | { type: 'setCount'; zone: DeckZone; id: number; count: number }
  | { type: 'move'; from: DeckZone; to: DeckZone; id: number }
  | { type: 'setFormat'; format: DeckFormat }
  | { type: 'clear' }
  | { type: 'hydrate'; state: EditorState }

export function initialState(format: DeckFormat = 'tcg'): EditorState {
  return { format, main: [], extra: [], side: [], cards: {} }
}

const removeOne = (ids: number[], id: number): number[] => {
  const index = ids.indexOf(id)
  if (index === -1) return ids
  return [...ids.slice(0, index), ...ids.slice(index + 1)]
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'add': {
      const zone = action.zone ?? defaultZone(action.card)
      if (!canAdd(state, action.card, zone)) return state
      return {
        ...state,
        cards: { ...state.cards, [action.card.id]: action.card },
        [zone]: [...state[zone], action.card.id],
      }
    }

    case 'remove':
      return { ...state, [action.zone]: removeOne(state[action.zone], action.id) }

    case 'setCount': {
      const card = state.cards[action.id]
      if (!card) return state
      const others = state[action.zone].filter((x) => x !== action.id)
      const copiesElsewhere = totalCopies(state, action.id) - zoneCopies(state[action.zone], action.id)
      const maxByZone = ZONE_LIMITS[action.zone].max - others.length
      const maxByLimit = copyLimit(card, state.format) - copiesElsewhere
      const target = Math.max(0, Math.min(action.count, maxByZone, maxByLimit))
      return {
        ...state,
        [action.zone]: [...others, ...Array<number>(target).fill(action.id)],
      }
    }

    case 'move': {
      const card = state.cards[action.id]
      if (action.from === action.to || zoneCopies(state[action.from], action.id) === 0) return state
      const afterRemove: EditorState = { ...state, [action.from]: removeOne(state[action.from], action.id) }
      if (!card || !canAdd(afterRemove, card, action.to)) return state
      return { ...afterRemove, [action.to]: [...afterRemove[action.to], action.id] }
    }

    case 'setFormat':
      // Keep the cards — validation surfaces any copies now illegal for the
      // new format rather than silently deleting the user's work.
      return { ...state, format: action.format }

    case 'clear':
      return initialState(state.format)

    case 'hydrate':
      return action.state

    default:
      return state
  }
}
