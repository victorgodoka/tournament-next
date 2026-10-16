import { describe, expect, it } from 'vitest'
import type { CardData, CardMap, Deck } from '@utils/deck/types'
import { editorReducer, HISTORY_LIMIT, initialEditorState, LAST_ADDED, type EditorState } from './deck-editor.reducer'

const card = (id: number, over: Partial<CardData> = {}): CardData =>
  ({ id, name: `c${id}`, kind: 'spell', monsterTypes: [], alias: null, ruleId: null, level: null, ...over }) as unknown as CardData
const cards: CardMap = new Map([1, 2, 3, 4, 5, 6, 7].map((id) => [id, card(id, { ruleId: id })]))
const fusion = card(900, { kind: 'monster', monsterTypes: ['fusion'] })
const cardsX: CardMap = new Map([...cards, [900, fusion]])

const add = (state: EditorState, c: CardData, map: CardMap = cards) => editorReducer(state, { type: 'add', card: c, cards: map })

describe('editorReducer', () => {
  it('initial state', () => {
    expect(initialEditorState()).toEqual({
      deck: { main: [], extra: [], side: [] },
      past: [],
      future: [],
      name: '',
      format: null,
      deckId: null,
      revision: null,
      dirty: false,
      lastAdded: [],
      rejected: null,
    })
  })

  it('add pushes history, clears future, sets dirty, prepends lastAdded', () => {
    let s = add(initialEditorState(), cards.get(1)!)
    s = add(s, cards.get(2)!)
    expect(s.deck.main).toEqual([1, 2])
    expect(s.past).toHaveLength(2)
    expect(s.dirty).toBe(true)
    expect(s.lastAdded).toEqual([2, 1])
    const u = editorReducer(s, { type: 'undo' })
    expect(u.future).toHaveLength(1)
    expect(add(u, cards.get(3)!).future).toEqual([])
  })

  it('caps lastAdded', () => {
    let s = initialEditorState()
    for (const id of [1, 2, 3, 4, 5, 6, 7]) s = add(s, cards.get(id)!)
    expect(s.lastAdded).toHaveLength(LAST_ADDED)
    expect(s.lastAdded[0]).toBe(7)
  })

  it('undo restores and redo reapplies', () => {
    const s = add(add(initialEditorState(), cards.get(1)!), cards.get(2)!)
    const u = editorReducer(s, { type: 'undo' })
    expect(u.deck.main).toEqual([1])
    expect(u.future).toHaveLength(1)
    expect(u.dirty).toBe(true)
    const r = editorReducer(u, { type: 'redo' })
    expect(r.deck.main).toEqual([1, 2])
    expect(r.future).toEqual([])
  })

  it('empty undo/redo return the same state', () => {
    const s = initialEditorState()
    expect(editorReducer(s, { type: 'undo' })).toBe(s)
    expect(editorReducer(s, { type: 'redo' })).toBe(s)
  })

  it('rejected add leaves deck/past/dirty alone and sets rejected; next success clears it', () => {
    let s = initialEditorState()
    for (let i = 0; i < 3; i++) s = add(s, cards.get(1)!)
    const r = add(s, cards.get(1)!)
    expect(r.deck).toBe(s.deck)
    expect(r.past).toBe(s.past)
    expect(r.dirty).toBe(s.dirty)
    expect(r.lastAdded).toBe(s.lastAdded)
    expect(r.rejected).toEqual({ cardId: 1, reason: 'copies' })
    expect(add(r, cards.get(2)!).rejected).toBeNull()
  })

  it('101 changes leave past.length === HISTORY_LIMIT', () => {
    let s: EditorState = { ...initialEditorState(), deck: { main: [1, 2], extra: [], side: [] } }
    for (let i = 0; i < HISTORY_LIMIT + 1; i++) s = editorReducer(s, { type: 'reorder', zone: 'main', from: i % 2, to: (i + 1) % 2 })
    expect(s.past).toHaveLength(HISTORY_LIMIT)
  })

  it('remove, move, reorder', () => {
    let s = add(add(initialEditorState(), cards.get(1)!), cards.get(2)!)
    s = editorReducer(s, { type: 'reorder', zone: 'main', from: 0, to: 1 })
    expect(s.deck.main).toEqual([2, 1])
    s = editorReducer(s, { type: 'move', from: 'main', id: 1, to: 'side', cards })
    expect(s.deck).toEqual({ main: [2], extra: [], side: [1] })
    s = editorReducer(s, { type: 'remove', zone: 'main', id: 2 })
    expect(s.deck.main).toEqual([])
    expect(editorReducer(s, { type: 'remove', zone: 'main', id: 99 })).toBe(s)
  })

  it('rejected move sets rejected', () => {
    let s = add(initialEditorState(), cards.get(1)!)
    s = add(s, fusion, cardsX)
    const r = editorReducer(s, { type: 'move', from: 'extra', id: 900, to: 'main', cards: cardsX })
    expect(r.rejected).toEqual({ cardId: 900, reason: 'zone' })
    expect(r.deck).toBe(s.deck)
  })

  it('sort is a single history step over all zones', () => {
    const s0: EditorState = { ...initialEditorState(), deck: { main: [3, 1, 2], extra: [], side: [7, 5] } }
    const s = editorReducer(s0, { type: 'sort', cards })
    expect(s.deck.main).toEqual([1, 2, 3])
    expect(s.deck.side).toEqual([5, 7])
    expect(s.past).toHaveLength(1)
    expect(s.dirty).toBe(true)
    expect(editorReducer(s, { type: 'sort', cards })).toBe(s)
  })

  it('rename/format set dirty without touching history', () => {
    const s = editorReducer(initialEditorState(), { type: 'rename', name: 'X' })
    expect(s.name).toBe('X')
    expect(s.dirty).toBe(true)
    expect(s.past).toEqual([])
    const f = editorReducer(s, { type: 'format', format: 4 })
    expect(f.format).toBe(4)
    expect(f.dirty).toBe(true)
    expect(f.past).toEqual([])
  })

  it('load resets history and takes dirty from the action', () => {
    const dirty = add(initialEditorState(), cards.get(1)!)
    const deck: Deck = { main: [2], extra: [], side: [] }
    const l = editorReducer(dirty, { type: 'load', deck, name: 'N', format: 1, deckId: 'd', revision: 3 })
    expect(l).toMatchObject({ deck, name: 'N', format: 1, deckId: 'd', revision: 3, dirty: false, past: [], future: [], lastAdded: [], rejected: null })
    const d = editorReducer(dirty, { type: 'load', deck, name: 'N', format: null, deckId: null, revision: null, dirty: true })
    expect(d.dirty).toBe(true)
  })

  it('saved sets ids and clears dirty', () => {
    const s = editorReducer(add(initialEditorState(), cards.get(1)!), { type: 'saved', deckId: 'abc', revision: 2 })
    expect(s).toMatchObject({ deckId: 'abc', revision: 2, dirty: false })
    // Edits made while the request was in flight stay unsaved.
    expect(editorReducer(s, { type: 'saved', deckId: 'abc', revision: 3, dirty: true }).dirty).toBe(true)
  })
})
