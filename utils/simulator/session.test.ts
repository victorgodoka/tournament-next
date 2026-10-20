import { describe, expect, it } from 'vitest'
import type { Deck } from '@utils/deck/types'
import { emptySession, sessionReducer } from './session'
import type { SessionEvent } from './session'
import type { Action, SavedRef, Session } from './types'
import { LIMITS } from './types'

const deck: Deck = { main: [101, 102, 103], extra: [201], side: [] }
const [a, b, c, d] = [1, 2, 3, 4].map((n): Action => ({ t: 'draw', n })) as [Action, Action, Action, Action]
const session = (o: Partial<Session> = {}): Session => ({ ...emptySession(), ...o })
const ref: SavedRef = { id: '0123456789abcdef', title: 'Line', revision: 1, saved: 'deadbeef' }
const DECK_ID = 'abcdefabcdefabcd'

describe('simulator session', () => {
  it('emptySession: empty deck, no name, no actions, cursor and start at 0, no deck id, no saved combo', () => {
    expect(emptySession()).toEqual({ deck: { main: [], extra: [], side: [] }, name: '', actions: [], cursor: 0, start: 0, deckId: null, combo: null, counterTypes: [] })
  })

  it('counterType adds a trimmed kind once, ignores an empty one and stops at the limit', () => {
    const one = sessionReducer(session(), { type: 'counterType', name: '  Spell ' })
    expect(one.counterTypes).toEqual(['Spell'])
    expect(sessionReducer(one, { type: 'counterType', name: 'Spell' })).toBe(one)
    expect(sessionReducer(one, { type: 'counterType', name: '   ' })).toBe(one)
    expect(sessionReducer(one, { type: 'counterType', name: 'x'.repeat(30) }).counterTypes[1]).toBe('x'.repeat(LIMITS.kind))
    const full = session({ counterTypes: Array.from({ length: LIMITS.kinds }, (_, i) => `k${i}`) })
    expect(sessionReducer(full, { type: 'counterType', name: 'more' })).toBe(full)
  })

  it('act drops the future and advances the cursor', () => {
    const next = sessionReducer(session({ actions: [a, b, c], cursor: 1 }), { type: 'act', actions: [d] })
    expect(next.actions).toEqual([a, d])
    expect(next.cursor).toBe(2)
  })

  it('note sets the caption of one step, capped at 100, and an empty one clears it', () => {
    const s = session({ actions: [a, b], cursor: 2 })
    const noted = sessionReducer(s, { type: 'note', index: 1, note: 'Ash on this' })
    expect(noted.actions[1]).toEqual({ ...b, note: 'Ash on this' })
    expect(noted.actions[0]).toBe(a)
    expect(sessionReducer(s, { type: 'note', index: 0, note: 'x'.repeat(150) }).actions[0]!.note).toHaveLength(LIMITS.note)
    expect(sessionReducer(noted, { type: 'note', index: 1, note: '' }).actions[1]!.note).toBeUndefined()
    expect(sessionReducer(s, { type: 'note', index: 5, note: 'nowhere' })).toBe(s)
    expect(sessionReducer(noted, { type: 'note', index: 1, note: 'Ash on this' })).toBe(noted)
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

  it('load trims the name to 80, starts empty, keeps the given deck id and drops the saved combo', () => {
    const loaded = sessionReducer(session({ actions: [a], cursor: 1, start: 1, name: 'old', combo: ref, deckId: 'bbbbbbbbbbbbbbbb' }), { type: 'load', deck, name: 'x'.repeat(100), deckId: DECK_ID })
    expect(loaded.name).toBe('x'.repeat(LIMITS.name))
    expect(loaded.deck).toBe(deck)
    expect(loaded.actions).toEqual([])
    expect(loaded.cursor).toBe(0)
    expect(loaded.start).toBe(0)
    expect(loaded.deckId).toBe(DECK_ID)
    expect(loaded.combo).toBeNull()
    expect(sessionReducer(loaded, { type: 'load', deck, name: 'pasted', deckId: null }).deckId).toBeNull()
  })

  it('reset keeps deck, name and deck id, clears the log and the saved combo', () => {
    const s = session({ deck, name: 'combo', actions: [a, b], cursor: 2, start: 1, deckId: DECK_ID, combo: ref })
    expect(sessionReducer(s, { type: 'reset' })).toEqual({ deck, name: 'combo', actions: [], cursor: 0, start: 0, deckId: DECK_ID, combo: null, counterTypes: [] })
    const fresh = session({ deck, name: 'combo', deckId: DECK_ID })
    expect(sessionReducer(fresh, { type: 'reset' })).toBe(fresh)
    // a saved combo with no steps is still something to let go of
    expect(sessionReducer(session({ deck, combo: ref }), { type: 'reset' }).combo).toBeNull()
  })

  it('saved sets and clears the tie to a saved combo, and changes nothing else', () => {
    const s = session({ deck, name: 'combo', actions: [a, b], cursor: 1, start: 1, deckId: DECK_ID })
    const tied = sessionReducer(s, { type: 'saved', combo: ref })
    expect(tied).toEqual({ ...s, combo: ref })
    expect(tied.actions).toBe(s.actions)
    const bumped = sessionReducer(tied, { type: 'saved', combo: { ...ref, revision: 2, saved: '00000001' } })
    expect(bumped.combo).toEqual({ ...ref, revision: 2, saved: '00000001' })
    expect(sessionReducer(bumped, { type: 'saved', combo: null })).toEqual(s)
    expect(sessionReducer(tied, { type: 'saved', combo: ref })).toBe(tied)
    expect(sessionReducer(s, { type: 'saved', combo: null })).toBe(s)
  })

  it('unlink lets go of the saved combo only when its id is the one named, and is the same session otherwise', () => {
    const tied = session({ deck, name: 'combo', actions: [a, b], cursor: 1, start: 1, deckId: DECK_ID, combo: ref })
    const unlinked = sessionReducer(tied, { type: 'unlink', id: ref.id })
    expect(unlinked).toEqual({ ...tied, combo: null })
    expect(unlinked.actions).toBe(tied.actions)
    expect(sessionReducer(tied, { type: 'unlink', id: 'ffffffffffffffff' })).toBe(tied) // another combo was deleted
    expect(sessionReducer(unlinked, { type: 'unlink', id: ref.id })).toBe(unlinked) // tied to nothing
  })

  it('open replaces the whole session', () => {
    const opened = session({ deck, name: 'other', actions: [c], cursor: 1, start: 0, deckId: DECK_ID, combo: ref })
    const next = sessionReducer(session({ actions: [a, b], cursor: 2, name: 'mine', combo: { ...ref, id: 'ffffffffffffffff' } }), { type: 'open', session: opened })
    expect(next).toBe(opened)
  })

  it('act, undo, redo, seek, setStart and note keep the deck id and the saved combo', () => {
    const s = session({ actions: [a, b], cursor: 1, deckId: DECK_ID, combo: ref })
    const events: SessionEvent[] = [{ type: 'act', actions: [c] }, { type: 'redo' }, { type: 'undo' }, { type: 'seek', cursor: 2 }, { type: 'setStart', start: 1 }, { type: 'note', index: 0, note: 'hi' }]
    for (const e of events) {
      const next = sessionReducer(s, e)
      expect(next.deckId, e.type).toBe(DECK_ID)
      expect(next.combo, e.type).toBe(ref)
    }
  })
})
