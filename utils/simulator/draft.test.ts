import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Deck } from '@utils/deck/types'
import { DRAFT_KEY, draftStorage, parseSession, readDraft, writeDraft } from './draft'
import { emptySession } from './session'
import type { Action, SavedRef, Session } from './types'

const deck: Deck = { main: [101, 102, 103, 104, 105, 106, 107, 108, 109, 110], extra: [201, 202, 203], side: [] }

// shuffle → draw 9, 8, 7 → 9 to m0 (set), 8 under it, 7 to s0 → flip, counter, negate, activate → extra 10 to m1 → end turn
const actions: Action[] = [
  { t: 'shuffle', order: [9, 8, 7, 6, 5, 4, 3, 2, 1, 0] },
  { t: 'draw', n: 3 },
  { t: 'move', card: 9, to: 'm0', face: 'down', pos: 'def' },
  { t: 'move', card: 8, to: 'm0' },
  { t: 'move', card: 7, to: 's0', at: 'top' },
  { t: 'flip', card: 9, face: 'up', pos: 'atk' },
  { t: 'counter', card: 9, delta: 2 },
  { t: 'negate', card: 9, on: true },
  { t: 'activate', card: 7, targets: [9] },
  { t: 'move', card: 10, to: 'm1' },
  { t: 'endTurn' },
  { t: 'lp', side: 'rival', delta: -1000 },
  { t: 'phase', to: 'battle' },
  { t: 'move', card: 1, to: 'm1', how: 'special' },
]
const combo: SavedRef = { id: '0123456789abcdef', title: 'Snake-Eye line', revision: 3, saved: 'deadbeef' }
const session: Session = { deck, name: 'Combo', actions, cursor: 9, start: 2, deckId: 'abcdefabcdefabcd', combo, counterTypes: [] }

/** A map-backed stand-in for localStorage. */
const memory = () => {
  const data = new Map<string, string>()
  return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) }
}

/** A payload as it would sit in storage, with the fields to tamper with replaced. */
const payload = (o: Record<string, unknown> = {}) => ({ v: 2, ...session, ...o })
/** What a draft written before the saved combos looked like. */
const v1 = (o: Record<string, unknown> = {}) => ({ v: 1, deck, name: 'Combo', actions, cursor: 9, start: 2, ...o })
/** A tampered log, with the cursor and start put back at 0 so only the log is at fault. */
const log = (...a: unknown[]) => payload({ actions: a, cursor: 0, start: 0 })

afterEach(() => vi.unstubAllGlobals())

describe('simulator draft', () => {
  it('round-trips a session', () => {
    const store = memory()
    writeDraft(store, session)
    expect(JSON.parse(store.data.get(DRAFT_KEY)!)).toMatchObject({ v: 2, name: 'Combo', cursor: 9, start: 2, deckId: 'abcdefabcdefabcd', combo })
    expect(readDraft(store)).toEqual(session)
    expect(parseSession(payload())).toEqual(session)
  })

  it('round-trips a session with no deck id and no saved combo', () => {
    const store = memory()
    const loose = { ...session, deckId: null, combo: null }
    writeDraft(store, loose)
    expect(readDraft(store)).toEqual(loose)
  })

  it('reads a v1 draft, which had neither, with deckId and combo null', () => {
    const store = memory()
    store.data.set(DRAFT_KEY, JSON.stringify(v1()))
    expect(readDraft(store)).toEqual({ ...session, deckId: null, combo: null })
    // a v1 draft never had these fields, so whatever sits there is not read
    expect(parseSession(v1({ deckId: 'abcdefabcdefabcd', combo }))).toEqual({ ...session, deckId: null, combo: null })
    // and a v1 draft is still replayed in full
    expect(parseSession(v1({ cursor: 99 }))).toBeNull()
    expect(parseSession(v1({ actions: [{ t: 'draw', n: 1 }, { t: 'flip', card: 0, face: 'down', pos: 'atk' }], cursor: 0, start: 0 }))).toBeNull()
  })

  it('refuses a damaged deck id or saved combo in a v2 draft', () => {
    const tied = (c: Record<string, unknown>) => payload({ combo: { ...combo, ...c } })
    const bad: [string, unknown][] = [
      ['deckId "nope"', payload({ deckId: 'nope' })],
      ['deckId in capitals', payload({ deckId: 'ABCDEFABCDEFABCD' })],
      ['deckId a number', payload({ deckId: 7 })],
      ['deckId missing', payload({ deckId: undefined })],
      ['combo missing', payload({ combo: undefined })],
      ['combo a string', payload({ combo: 'saved' })],
      ['combo an array', payload({ combo: [combo] })],
      ['combo.saved "xyz"', tied({ saved: 'xyz' })],
      ['combo.saved in capitals', tied({ saved: 'DEADBEEF' })],
      ['combo.saved 9 characters', tied({ saved: 'deadbeef0' })],
      ['combo.saved a number', tied({ saved: 12345678 })],
      ['combo.id short', tied({ id: 'abc' })],
      ['combo.id a number', tied({ id: 1234567890123456 })],
      ['combo.title empty', tied({ title: '' })],
      ['combo.title 81 chars', tied({ title: 'x'.repeat(81) })],
      ['combo.title not a string', tied({ title: 7 })],
      ['combo.revision 0', tied({ revision: 0 })],
      ['combo.revision 1.5', tied({ revision: 1.5 })],
      ['combo.revision a string', tied({ revision: '1' })],
      ['combo without a revision', tied({ revision: undefined })],
    ]
    for (const [label, draft] of bad) expect(parseSession(draft), label).toBeNull()
    expect(parseSession(tied({ title: 'x'.repeat(80) }))).not.toBeNull()
    expect(parseSession(tied({ title: 'x' }))).not.toBeNull()
    expect(parseSession(tied({ revision: 1 }))).not.toBeNull()
  })

  it('keeps a step caption up to 100 characters and refuses a longer or non-text one', () => {
    const noted = { ...session, actions: session.actions.map((a, i) => (i === 1 ? { ...a, note: 'Normal Summon' } : a)) }
    expect(parseSession({ v: 2, ...noted })).toEqual(noted)
    const withNote = (note: unknown) => payload({ actions: session.actions.map((a, i) => (i === 1 ? { ...a, note } : a)) })
    expect(parseSession(withNote('x'.repeat(100)))).not.toBeNull()
    expect(parseSession(withNote('x'.repeat(101)))).toBeNull()
    expect(parseSession(withNote(42))).toBeNull()
  })

  it('round-trips the empty session', () => {
    const store = memory()
    writeDraft(store, emptySession())
    expect(readDraft(store)).toEqual(emptySession())
  })

  it('missing key and corrupted JSON give null', () => {
    const store = memory()
    expect(readDraft(store)).toBeNull()
    store.data.set(DRAFT_KEY, '{"v":1,"deck":')
    expect(readDraft(store)).toBeNull()
    store.data.set(DRAFT_KEY, 'null')
    expect(readDraft(store)).toBeNull()
  })

  it('rejects a tampered draft', () => {
    const tampered: [string, unknown][] = [
      ['not an object', null],
      ['an array', [session]],
      ['v 3', payload({ v: 3 })],
      ['v 0', payload({ v: 0 })],
      ['no v', { ...session }],
      ['card id 13', log({ t: 'draw', n: 1 }, { t: 'move', card: 13, to: 'hand' })],
      ['card id -1', log({ t: 'draw', n: 1 }, { t: 'move', card: -1, to: 'hand' })],
      ['card id 1.5', log({ t: 'draw', n: 1 }, { t: 'move', card: 1.5, to: 'hand' })],
      ['card id as a string', log({ t: 'draw', n: 1 }, { t: 'move', card: '0', to: 'hand' })],
      ['zone m9', log({ t: 'draw', n: 1 }, { t: 'move', card: 0, to: 'm9' })],
      ['zone not a string', log({ t: 'draw', n: 1 }, { t: 'move', card: 0, to: 7 })],
      ['at middle', log({ t: 'draw', n: 1 }, { t: 'move', card: 0, to: 'm0', at: 'middle' })],
      ['face sideways', log({ t: 'draw', n: 1 }, { t: 'move', card: 0, to: 'm0', face: 'sideways' })],
      ['pos upside down', log({ t: 'draw', n: 1 }, { t: 'move', card: 0, to: 'm0', pos: 'inverted' })],
      ['flip without a pos', log({ t: 'draw', n: 1 }, { t: 'move', card: 0, to: 'm0' }, { t: 'flip', card: 0, face: 'up' })],
      ['negate with a non-boolean', log({ t: 'draw', n: 1 }, { t: 'move', card: 0, to: 'm0' }, { t: 'negate', card: 0, on: 'yes' })],
      ['counter delta 0', log({ t: 'draw', n: 1 }, { t: 'move', card: 0, to: 'm0' }, { t: 'counter', card: 0, delta: 0 })],
      ['counter delta 100', log({ t: 'draw', n: 1 }, { t: 'move', card: 0, to: 'm0' }, { t: 'counter', card: 0, delta: 100 })],
      ['counter delta 1.5', log({ t: 'draw', n: 1 }, { t: 'move', card: 0, to: 'm0' }, { t: 'counter', card: 0, delta: 1.5 })],
      ['draw 0', log({ t: 'draw', n: 0 })],
      ['draw 61', log({ t: 'draw', n: 61 })],
      ['draw 2.5', log({ t: 'draw', n: 2.5 })],
      ['activate targets not an array', log({ t: 'activate', card: 0, targets: 0 })],
      ['activate target 13', log({ t: 'activate', card: 0, targets: [13] })],
      ['shuffle order not an array', log({ t: 'shuffle', order: 'abc' })],
      ['shuffle id 13', log({ t: 'shuffle', order: [13, 1, 2, 3, 4, 5, 6, 7, 8, 9] })],
      ['shuffle with a repeat (shape ok, not a permutation)', log({ t: 'shuffle', order: [0, 0, 2, 3, 4, 5, 6, 7, 8, 9] })],
      ['unknown action', log({ t: 'teleport', card: 0 })],
      ['action not an object', log('draw')],
      ['actions not an array', payload({ actions: 'draw' })],
      ['cursor past the log', payload({ cursor: actions.length + 1 })],
      ['cursor -1', payload({ cursor: -1 })],
      ['cursor 1.5', payload({ cursor: 1.5 })],
      ['start past the log', payload({ start: actions.length + 1 })],
      ['start not a number', payload({ start: '0' })],
      ['61 main cards', payload({ deck: { main: Array.from({ length: 61 }, (_, i) => 1000 + i), extra: [], side: [] }, actions: [], cursor: 0, start: 0 })],
      ['16 extra cards', payload({ deck: { main: [], extra: Array.from({ length: 16 }, (_, i) => 1000 + i), side: [] }, actions: [], cursor: 0, start: 0 })],
      ['passcode 0', payload({ deck: { main: [0], extra: [], side: [] }, actions: [], cursor: 0, start: 0 })],
      ['deck missing side', payload({ deck: { main: [101], extra: [] }, actions: [], cursor: 0, start: 0 })],
      ['deck not an object', payload({ deck: 'ydke://!!!', actions: [], cursor: 0, start: 0 })],
      ['name 81 chars', payload({ name: 'x'.repeat(81) })],
      ['name not a string', payload({ name: 7 })],
      ['second move into an occupied s0', log({ t: 'draw', n: 2 }, { t: 'move', card: 0, to: 's0' }, { t: 'move', card: 1, to: 's0' })],
      ['move to the slot the card is already in', log({ t: 'draw', n: 1 }, { t: 'move', card: 0, to: 'm0' }, { t: 'move', card: 0, to: 'm0' })],
      ['flip a card still in hand', log({ t: 'draw', n: 1 }, { t: 'flip', card: 0, face: 'down', pos: 'atk' })],
    ]
    for (const [label, bad] of tampered) expect(parseSession(bad), label).toBeNull()
  })

  it('stops at the first action that fails, wherever it sits in the log', () => {
    const bad = payload({ actions: [...actions.slice(0, 5), { t: 'move', card: 8, to: 's0' }, ...actions.slice(5)] })
    expect(parseSession(bad)).toBeNull()
  })

  it('holds the limits exactly: 80 chars of name, 2000 actions', () => {
    const turns = (n: number) => Array.from({ length: n }, (): Action => ({ t: 'endTurn' }))
    expect(parseSession(payload({ name: 'x'.repeat(80), actions: [], cursor: 0, start: 0 }))).not.toBeNull()
    expect(parseSession(payload({ actions: turns(2000), cursor: 2000, start: 2000 }))).not.toBeNull()
    expect(parseSession(payload({ actions: turns(2001), cursor: 0, start: 0 }))).toBeNull()
  })

  it('keeps only the session fields', () => {
    const parsed = parseSession({ ...payload(), role: 'admin', actions: [...actions.slice(0, 2), { ...actions[2]!, extra: 1 }], cursor: 3 })!
    expect(Object.keys(parsed).sort()).toEqual(['actions', 'combo', 'counterTypes', 'cursor', 'deck', 'deckId', 'name', 'start'])
    expect(parsed.actions[2]).toEqual(actions[2])
    expect(Object.keys(parseSession(payload({ combo: { ...combo, role: 'admin' } }))!.combo!).sort()).toEqual(['id', 'revision', 'saved', 'title'])
  })

  it('keeps the counter kinds, once each, and refuses a damaged list', () => {
    expect(parseSession(payload({ counterTypes: ['Spell', 'Ice', 'Spell'] }))!.counterTypes).toEqual(['Spell', 'Ice'])
    expect(parseSession(payload({ counterTypes: ['x'.repeat(21)] }))).toBeNull()
    expect(parseSession(payload({ counterTypes: [''] }))).toBeNull()
    expect(parseSession(payload({ counterTypes: 'Spell' }))).toBeNull()
    expect(parseSession(payload({ counterTypes: Array.from({ length: 21 }, (_, i) => `k${i}`) }))).toBeNull()
  })

  it('reads a counter kind, a destroy and a tag, and refuses their damaged forms', () => {
    const at = (a: unknown) => parseSession(payload({ actions: [{ t: 'draw', n: 1 }, { t: 'move', card: 0, to: 'm0' }, a], cursor: 3, start: 0 }))
    expect(at({ t: 'counter', card: 0, delta: 1, kind: 'Spell' })!.actions[2]).toEqual({ t: 'counter', card: 0, delta: 1, kind: 'Spell' })
    expect(at({ t: 'counter', card: 0, delta: 1, kind: '' })).toBeNull()
    expect(at({ t: 'counter', card: 0, delta: 1, kind: 3 })).toBeNull()
    expect(at({ t: 'move', card: 0, to: 'gy', destroy: true })!.actions[2]).toEqual({ t: 'move', card: 0, to: 'gy', destroy: true })
    expect(at({ t: 'move', card: 0, to: 'gy', destroy: 1 })).toBeNull()
    expect(at({ t: 'move', card: 0, to: 'hand', destroy: true })).toBeNull()
    expect(at({ t: 'tag', card: 0, text: 'Negates once' })!.actions[2]).toEqual({ t: 'tag', card: 0, text: 'Negates once' })
    expect(at({ t: 'tag', card: 0, text: '' })!.actions[2]).toEqual({ t: 'tag', card: 0, text: '' })
    expect(at({ t: 'tag', card: 0, text: 'x'.repeat(41) })).toBeNull()
    expect(at({ t: 'tag', card: 0 })).toBeNull()
  })

  it('null storage reads null and writes nothing', () => {
    expect(readDraft(null)).toBeNull()
    expect(() => writeDraft(null, session)).not.toThrow()
  })

  it('a throwing getItem reads null and a throwing setItem does not throw', () => {
    const boom = () => {
      throw new DOMException('denied', 'SecurityError')
    }
    expect(readDraft({ getItem: boom })).toBeNull()
    expect(() => writeDraft({ setItem: boom }, session)).not.toThrow()
  })

  it('draftStorage gives window.localStorage, or null when the browser refuses it', () => {
    const store = memory()
    vi.stubGlobal('window', { localStorage: store })
    expect(draftStorage()).toBe(store)
    vi.stubGlobal('window', {
      get localStorage(): Storage {
        throw new DOMException('denied', 'SecurityError')
      },
    })
    expect(draftStorage()).toBeNull()
  })
})
