import { EMPTY_DECK } from '@utils/deck/types'
import type { Deck } from '@utils/deck/types'
import { LIMITS } from './types'
import type { Action, Session } from './types'

export type SessionEvent =
  | { type: 'load'; deck: Deck; name: string }
  | { type: 'reset' }
  | { type: 'act'; actions: Action[] }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'seek'; cursor: number }
  | { type: 'setStart'; start: number }

export const emptySession = (): Session => ({ deck: EMPTY_DECK, name: '', actions: [], cursor: 0, start: 0 })

/** A whole number in 0..max; NaN counts as 0. */
const clamp = (n: number, max: number) => Math.min(max, Math.max(0, Math.trunc(n) || 0))

/** Pure; every no-op returns the very same session so a `useReducer` bails out of the render. */
export function sessionReducer(s: Session, e: SessionEvent): Session {
  switch (e.type) {
    case 'load':
      return { ...emptySession(), deck: e.deck, name: e.name.slice(0, LIMITS.name) }
    case 'reset':
      return s.actions.length === 0 && s.cursor === 0 && s.start === 0 ? s : { ...s, actions: [], cursor: 0, start: 0 }
    case 'act': {
      const actions = [...s.actions.slice(0, s.cursor), ...e.actions]
      if (e.actions.length === 0 || actions.length > LIMITS.actions) return s
      return { ...s, actions, cursor: actions.length, start: Math.min(s.start, s.cursor) }
    }
    case 'undo':
      return s.cursor > 0 ? { ...s, cursor: s.cursor - 1 } : s
    case 'redo':
      return s.cursor < s.actions.length ? { ...s, cursor: s.cursor + 1 } : s
    case 'seek': {
      const cursor = clamp(e.cursor, s.actions.length)
      return cursor === s.cursor ? s : { ...s, cursor }
    }
    case 'setStart': {
      const start = clamp(e.start, s.actions.length)
      return start === s.start ? s : { ...s, start }
    }
  }
}
