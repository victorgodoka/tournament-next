import { describe, expect, it } from 'vitest'
import type { Deck } from '@utils/deck/types'
import { emptySession, sessionReducer } from './session'
import type { Action, Session } from './types'
import { LIMITS } from './types'

const deck: Deck = { main: [101, 102, 103], extra: [201], side: [] }
const [a, b, c, d] = [1, 2, 3, 4].map((n): Action => ({ t: 'draw', n })) as [Action, Action, Action, Action]
const session = (o: Partial<Session> = {}): Session => ({ ...emptySession(), ...o })

describe('simulator session', () => {
  it('emptySession: empty deck, no name, no actions, cursor and start at 0', () => {
    expect(emptySession()).toEqual({ deck: { main: [], extra: [], side: [] }, name: '', actions: [], cursor: 0, start: 0 })
  })

  it('act drops the future and advances the cursor', () => {
    const next = sessionReducer(session({ actions: [a, b, c], cursor: 1 }), { type: 'act', actions: [d] })
    expect(next.actions).toEqual([a, d])
    expect(next.cursor).toBe(2)
  })

  it('act appends several actions at once', () => {
    const next = sessionReducer(session({ actions: [a], cursor: 1 }), { type: 'act', actions: [b, c] })
    expect(next.actions).toEqual([a, b, c])
    expect(next.cursor).toBe(3)
  })

  it('act pulls start back to the cursor, never forward', () => {
    expect(sessionReducer(session({ actions: [a, b, c], cursor: 1, start: 3 }), { type: 'act', actions: [d] }).start).toBe(1)
    expect(sessionReducer(session({ actions: [a, b, c], cursor: 2, start: 0 }), { type: 'act', actions: [d] }).start).toBe(0)
  })

  it('act with no actions is a no-op and keeps the future', () => {
    const s = session({ actions: [a, b], cursor: 1 })
    expect(sessionReducer(s, { type: 'act', actions: [] })).toBe(s)
  })

  it('act refuses to pass LIMITS.actions', () => {
    const full = Array.from({ length: LIMITS.actions }, () => a)
    const s = session({ actions: full, cursor: LIMITS.actions })
    expect(sessionReducer(s, { type: 'act', actions: [d] })).toBe(s)
    expect(sessionReducer(s, { type: 'act', actions: [] })).toBe(s)
    // dropping the future makes room: 1999 kept + 1 new is exactly the limit
    const room = sessionReducer(session({ actions: full, cursor: LIMITS.actions - 1 }), { type: 'act', actions: [d] })
    expect(room.actions).toHaveLength(LIMITS.actions)
    expect(room.actions[LIMITS.actions - 1]).toBe(d)
    expect(room.cursor).toBe(LIMITS.actions)
  })

  it('undo and redo stay within 0..length and no-op at the ends', () => {
    const s = session({ actions: [a, b], cursor: 1 })
    expect(sessionReducer(s, { type: 'undo' }).cursor).toBe(0)
    expect(sessionReducer(s, { type: 'redo' }).cursor).toBe(2)
    const start = session({ actions: [a, b], cursor: 0 })
    const end = session({ actions: [a, b], cursor: 2 })
    expect(sessionReducer(start, { type: 'undo' })).toBe(start)
    expect(sessionReducer(end, { type: 'redo' })).toBe(end)
    const empty = emptySession()
    expect(sessionReducer(empty, { type: 'undo' })).toBe(empty)
    expect(sessionReducer(empty, { type: 'redo' })).toBe(empty)
  })

  it('undo and redo keep the actions', () => {
    const s = session({ actions: [a, b], cursor: 1 })
    expect(sessionReducer(s, { type: 'undo' }).actions).toBe(s.actions)
  })

  it('seek and setStart clamp to 0..actions.length', () => {
    const s = session({ actions: [a, b, c], cursor: 1, start: 1 })
    expect(sessionReducer(s, { type: 'seek', cursor: 2 }).cursor).toBe(2)
    expect(sessionReducer(s, { type: 'seek', cursor: 99 }).cursor).toBe(3)
    expect(sessionReducer(s, { type: 'seek', cursor: -5 }).cursor).toBe(0)
    expect(sessionReducer(s, { type: 'setStart', start: 2 }).start).toBe(2)
    expect(sessionReducer(s, { type: 'setStart', start: 99 }).start).toBe(3)
    expect(sessionReducer(s, { type: 'setStart', start: -5 }).start).toBe(0)
    expect(sessionReducer(s, { type: 'seek', cursor: 1 })).toBe(s)
    expect(sessionReducer(s, { type: 'setStart', start: 1 })).toBe(s)
    expect(sessionReducer(s, { type: 'seek', cursor: 99 }).start).toBe(1)
  })

  it('load trims the name to 80 and starts empty', () => {
    const loaded = sessionReducer(session({ actions: [a], cursor: 1, start: 1, name: 'old' }), { type: 'load', deck, name: 'x'.repeat(100) })
    expect(loaded.name).toBe('x'.repeat(LIMITS.name))
    expect(loaded.deck).toBe(deck)
    expect(loaded.actions).toEqual([])
    expect(loaded.cursor).toBe(0)
    expect(loaded.start).toBe(0)
  })

  it('reset keeps deck and name and clears the log', () => {
    const s = session({ deck, name: 'combo', actions: [a, b], cursor: 2, start: 1 })
    expect(sessionReducer(s, { type: 'reset' })).toEqual({ deck, name: 'combo', actions: [], cursor: 0, start: 0 })
    const fresh = session({ deck, name: 'combo' })
    expect(sessionReducer(fresh, { type: 'reset' })).toBe(fresh)
  })
})
