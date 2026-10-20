import { EMPTY_DECK } from '@utils/deck/types'
import type { Deck } from '@utils/deck/types'
import { LIMITS } from './types'
import type { Action, SavedRef, Session } from './types'

export type SessionEvent =
  | { type: 'load'; deck: Deck; name: string; deckId: string | null }
  | { type: 'reset' }
  | { type: 'act'; actions: Action[] }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'seek'; cursor: number }
  | { type: 'setStart'; start: number }
  /** The caption of `actions[index]`: cut to 100 characters, an empty one removes it. */
  | { type: 'note'; index: number; note: string }
  /** Ties the session to a saved combo, or lets go of it. */
  | { type: 'saved'; combo: SavedRef | null }
  /** Lets go of the saved combo `id`, as deleting it does; a session tied to another one, or to none, is left alone. */
  | { type: 'unlink'; id: string }
  /** Replaces the whole session, as opening a saved combo does. */
  | { type: 'open'; session: Session }
  /** A counter kind added by hand: trimmed, cut to its limit; one already there, or an empty one, changes nothing. */
  | { type: 'counterType'; name: string }

export const emptySession = (): Session => ({ deck: EMPTY_DECK, name: '', actions: [], cursor: 0, start: 0, deckId: null, combo: null, counterTypes: [] })

/** A whole number in 0..max; NaN counts as 0. */
const clamp = (n: number, max: number) => Math.min(max, Math.max(0, Math.trunc(n) || 0))

/** Pure; every no-op returns the very same session so a `useReducer` bails out of the render. */
export function sessionReducer(s: Session, e: SessionEvent): Session {
  switch (e.type) {
    case 'load':
      return { ...emptySession(), deck: e.deck, name: e.name.slice(0, LIMITS.name), deckId: e.deckId }
    case 'reset':
      return s.actions.length === 0 && s.cursor === 0 && s.start === 0 && s.combo === null ? s : { ...s, actions: [], cursor: 0, start: 0, combo: null }
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
    case 'note': {
      const action = s.actions[e.index]
      const note = e.note.slice(0, LIMITS.note) || undefined
      if (!action || action.note === note) return s
      const actions = [...s.actions]
      actions[e.index] = { ...action, note }
      return { ...s, actions }
    }
    case 'saved':
      return e.combo === s.combo ? s : { ...s, combo: e.combo }
    case 'unlink':
      return s.combo?.id === e.id ? { ...s, combo: null } : s
    case 'open':
      return e.session
    case 'counterType': {
      const name = e.name.trim().slice(0, LIMITS.kind)
      if (!name || s.counterTypes.includes(name) || s.counterTypes.length >= LIMITS.kinds) return s
      return { ...s, counterTypes: [...s.counterTypes, name] }
    }
  }
}
