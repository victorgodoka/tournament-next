import { describe, expect, it } from 'vitest'
import type { Card } from '@lib/cards.types'
import type { BanlistData } from '@lib/cards.types'
import { editorReducer, initialState } from './deck-editor.reducer'
import { banStatus, canAdd, genesysTotal, totalCopies, validateDeck } from './deck-editor.utils'
import type { EditorState } from './deck-editor.types'

const card = (id: number, over: Partial<Card> = {}): Card => ({
  id,
  name_en: `Card ${id}`,
  sets: [],
  type_primary: 'Monster',
  type_tags: [],
  genre_tags: [],
  category_tags: [],
  alias: [],
  ...over,
})

const banlist = (data: BanlistData): Partial<Card> => ({ banlist_data: data })

/** Add a card `n` times through the reducer, threading state. */
const addN = (state: EditorState, c: Card, n: number): EditorState =>
  Array.from({ length: n }).reduce<EditorState>((s) => editorReducer(s, { type: 'add', card: c }), state)

describe('banStatus', () => {
  it('normalises the API casing, and tests semi before limited', () => {
    expect(banStatus(card(1, banlist({ tcg: { status: 'Forbidden' } })), 'tcg')).toBe('forbidden')
    expect(banStatus(card(1, banlist({ tcg: { status: 'Semi-Limited' } })), 'tcg')).toBe('semi-limited')
    expect(banStatus(card(1, banlist({ tcg: { status: 'Limited' } })), 'tcg')).toBe('limited')
    expect(banStatus(card(1), 'tcg')).toBe('unlimited')
  })
})

describe('reducer copy limits', () => {
  it('caps a Limited card at one copy', () => {
    const limited = card(10, banlist({ tcg: { status: 'Limited' } }))
    const state = addN(initialState('tcg'), limited, 3)
    expect(state.main.filter((x) => x === 10)).toHaveLength(1)
  })

  it('never adds a Forbidden card', () => {
    const forbidden = card(11, banlist({ tcg: { status: 'Forbidden' } }))
    const state = editorReducer(initialState('tcg'), { type: 'add', card: forbidden })
    expect(state.main).toHaveLength(0)
    expect(canAdd(state, forbidden, 'main')).toBe(false)
  })

  it('routes Extra-Deck monsters to the extra zone and caps it at 15', () => {
    const fusion = card(12, { type_tags: ['Fusion'] })
    const state = addN(initialState('tcg'), fusion, 20)
    // 15-card extra cap, but a normal 3-copy limit applies first.
    expect(state.extra.filter((x) => x === 12)).toHaveLength(3)
    expect(state.main).toHaveLength(0)
  })
})

describe('rule-shared copy limits', () => {
  it('counts a not-yet-added card against its rule partner already in the deck', () => {
    const original = card(30)
    const reprint = card(31, { rule: 30 })
    const state = addN(initialState('tcg'), original, 2)

    // `reprint` was only ever searched, never added — state.cards has no
    // entry for it, so its `rule` must come from the card object itself.
    expect(totalCopies(state, reprint.id, reprint)).toBe(2)
    expect(canAdd(state, reprint, 'main')).toBe(true)

    const withReprint = editorReducer(state, { type: 'add', card: reprint })
    expect(canAdd(withReprint, original, 'main')).toBe(false)
    expect(canAdd(withReprint, reprint, 'main')).toBe(false)
  })
})

describe('validateDeck', () => {
  it('flags an undersized main deck as illegal', () => {
    const state = addN(initialState('tcg'), card(1), 3)
    const result = validateDeck(state)
    expect(result.isLegal).toBe(false)
    expect(result.issues.some((i) => i.includes('at least 40'))).toBe(true)
  })

  it('is legal at exactly 40 main-deck cards within copy limits', () => {
    let state = initialState('tcg')
    for (let i = 0; i < 20; i++) state = addN(state, card(100 + i), 2) // 20 unique × 2 = 40
    expect(validateDeck(state).counts.main).toBe(40)
    expect(validateDeck(state).isLegal).toBe(true)
  })

  it('tracks Genesys points and flags exceeding the budget', () => {
    const pricey = card(20, banlist({ genesys: { value: 60 } }))
    const state = addN(initialState('genesys'), pricey, 2) // 120 points
    expect(genesysTotal(state)).toBe(120)
    expect(validateDeck(state).issues.some((i) => i.includes('Genesys budget'))).toBe(true)
  })
})
