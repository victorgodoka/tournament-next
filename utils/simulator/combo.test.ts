import { describe, expect, it } from 'vitest'
import type { SharedCombo } from '@utils/combos'
import type { Deck } from '@utils/deck/types'
import { comboSession, hashPayload, operateFrom, payloadOf, sessionOf } from './combo'
import type { Action, ComboPayload, SavedRef, Session } from './types'

const deck: Deck = { main: [101, 102, 103, 104, 105, 106, 107, 108, 109, 110], extra: [201, 202], side: [] }
const actions: Action[] = [{ t: 'draw', n: 3 }, { t: 'move', card: 9, to: 'm0' }, { t: 'move', card: 8, to: 's0' }, { t: 'endTurn' }]
const payload: ComboPayload = { deck, name: 'Dragão', actions, start: 3 }
const ref: SavedRef = { id: '0123456789abcdef', title: 'Dragão line', revision: 2, saved: '58984804' }

describe('payloadOf', () => {
  it('is the session minus cursor, deckId and combo, built in the order the hash depends on', () => {
    const s: Session = { ...payload, cursor: 2, deckId: 'abcdefabcdefabcd', combo: ref, counterTypes: [] }
    expect(payloadOf(s)).toEqual(payload)
    expect(Object.keys(payloadOf(s))).toEqual(['deck', 'name', 'actions', 'start'])
  })
})

describe('hashPayload', () => {
  it('is FNV-1a 32 over the UTF-16 code units of the JSON, as 8 lowercase hex characters', () => {
    // worked out by a separate implementation (Python) over the same text
    const p: ComboPayload = {
      deck: { main: [101, 102, 103], extra: [201], side: [] },
      name: 'Dragão',
      actions: [{ t: 'draw', n: 2 }, { t: 'move', card: 0, to: 'm0' }],
      start: 1,
    }
    expect(hashPayload(p)).toBe('58984804')
    expect(hashPayload(payload)).toMatch(/^[0-9a-f]{8}$/)
  })

  it('is stable and changes when a caption, a step or the start changes', () => {
    const same = hashPayload(payload)
    expect(hashPayload({ ...payload, actions: [...actions] })).toBe(same)
    const noted = (note: string) => ({ ...payload, actions: actions.map((a, i) => (i === 1 ? { ...a, note } : a)) })
    expect(hashPayload(noted('Summon'))).not.toBe(same)
    expect(hashPayload(noted('Summon'))).not.toBe(hashPayload(noted('Set')))
    expect(hashPayload({ ...payload, actions: actions.slice(0, 3) })).not.toBe(same)
    expect(hashPayload({ ...payload, start: 2 })).not.toBe(same)
  })

  it('pads to 8 characters', () => {
    // a hash below 0x10000000 would lose its leading zeros without padStart; some payload among these has one
    const p = Array.from({ length: 5000 }, (_, i): ComboPayload => ({ ...payload, name: `n${i}` })).find((x) => hashPayload(x).startsWith('0'))!
    expect(hashPayload(p)).toHaveLength(8)
  })
})

describe('sessionOf', () => {
  it('rebuilds a session at the end of the log, tied to the combo and deck', () => {
    const s = sessionOf(payload, ref, 'abcdefabcdefabcd')
    expect(s).toEqual({ deck, name: 'Dragão', actions, cursor: 4, start: 3, deckId: 'abcdefabcdefabcd', combo: ref, counterTypes: [] })
    expect(sessionOf(payload, null, null)).toMatchObject({ deckId: null, combo: null })
  })

  it('accepts a payload whose keys came back in another order (jsonb does that)', () => {
    const reordered = JSON.parse(
      '{"start":1,"name":"Dragão","actions":[{"n":1,"t":"draw"},{"to":"m0","card":9,"t":"move"}],"deck":{"side":[],"extra":[201,202],"main":[101,102,103,104,105,106,107,108,109,110]}}',
    ) as ComboPayload
    expect(sessionOf(reordered, null, null)).toEqual({ deck, name: 'Dragão', actions: [{ t: 'draw', n: 1 }, { t: 'move', card: 9, to: 'm0' }], cursor: 2, start: 1, deckId: null, combo: null, counterTypes: [] })
  })

  it('is null when the log is damaged: an action invalid at its step', () => {
    const bad: ComboPayload = { ...payload, actions: [{ t: 'draw', n: 1 }, { t: 'flip', card: 0, face: 'down', pos: 'atk' }], start: 0 }
    expect(sessionOf(bad, null, null)).toBeNull()
  })

  it('is null for a card beyond the deck, an unknown action, a long caption, a start past the log', () => {
    expect(sessionOf({ ...payload, actions: [{ t: 'draw', n: 1 }, { t: 'move', card: 12, to: 'hand' }], start: 0 }, null, null)).toBeNull()
    expect(sessionOf({ ...payload, actions: [{ t: 'teleport' } as unknown as Action], start: 0 }, null, null)).toBeNull()
    expect(sessionOf({ ...payload, actions: [{ t: 'endTurn', note: 'x'.repeat(101) }], start: 0 }, null, null)).toBeNull()
    expect(sessionOf({ ...payload, start: 5 }, null, null)).toBeNull()
  })

  it('is null for a damaged tie and for a payload that is not shaped like one', () => {
    expect(sessionOf(payload, { ...ref, saved: 'xyz' }, null)).toBeNull()
    expect(sessionOf(payload, null, 'nope')).toBeNull()
    expect(sessionOf({ ...payload, actions: undefined } as unknown as ComboPayload, null, null)).toBeNull()
  })
})

describe('comboSession', () => {
  const shared = (p: ComboPayload): SharedCombo => ({ id: ref.id, title: 'Dragão line', deckId: 'abcdefabcdefabcd', owner: { id: 'u1', name: 'Me' }, payload: p, visibility: 'private', revision: 2, updatedAt: '2026-10-19T00:00:00Z' })

  it('opens the combo tied to itself, with the hash of the session as parsed', () => {
    const s = comboSession(shared(payload))!
    expect(s).toMatchObject({ deck, actions, cursor: 4, start: 3, deckId: 'abcdefabcdefabcd' })
    expect(s.combo).toEqual({ id: ref.id, title: 'Dragão line', revision: 2, saved: hashPayload(payloadOf(s)), visibility: 'private' })
  })

  it('hashes the same whatever order the server returned the keys in (jsonb reorders them)', () => {
    const reordered = JSON.parse(JSON.stringify({ start: 3, actions, name: 'Dragão', deck: { side: [], extra: deck.extra, main: deck.main } })) as ComboPayload
    expect(comboSession(shared(reordered))!.combo!.saved).toBe(comboSession(shared(payload))!.combo!.saved)
  })

  it('is null when the payload is damaged', () => {
    expect(comboSession(shared({ ...payload, start: 9 }))).toBeNull()
  })
})

describe('operateFrom', () => {
  it('keeps the first k steps, the cursor at k, start pulled back to k, and no ties', () => {
    const s = operateFrom(payload, 2)
    expect(s).toEqual({ deck, name: 'Dragão', actions: actions.slice(0, 2), cursor: 2, start: 2, deckId: null, combo: null, counterTypes: [] })
  })

  it('leaves start alone when it is already before k, and takes the whole log at its length', () => {
    expect(operateFrom({ ...payload, start: 1 }, 2).start).toBe(1)
    const all = operateFrom(payload, actions.length)
    expect(all.actions).toEqual(actions)
    expect(all.cursor).toBe(actions.length)
    expect(operateFrom(payload, 0)).toMatchObject({ actions: [], cursor: 0, start: 0 })
  })
})
