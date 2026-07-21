import { describe, expect, it } from 'vitest'
import { createCard } from '../test/fixtures/deck.fixture'
import {
  buildCardLookup,
  cardCategory,
  cardImageUrl,
  extraDeckType,
  groupDeckCards,
  isExtra,
} from './cards.utils'

describe('cardImageUrl', () => {
  it('builds a full-art URL from a passcode', () => {
    expect(cardImageUrl(14558127)).toBe(
      'https://ygopro.online/assets/card-images/common/14558127.jpg',
    )
  })
})

describe('isExtra / extraDeckType', () => {
  it('detects the extra-deck subtype from type_tags (the real API shape)', () => {
    const link = createCard({
      type_primary: 'Monster',
      type_tags: ['Monster', 'Effect', 'Link'],
    })
    expect(extraDeckType(link)).toBe('link')
    expect(isExtra(link)).toBe(true)
  })

  it('treats plain main-deck monsters, spells and traps as non-extra', () => {
    expect(isExtra(createCard({ type_primary: 'Monster', type_tags: ['Effect'] }))).toBe(false)
    expect(isExtra(createCard({ type_primary: 'Spell', type_tags: ['Spell'] }))).toBe(false)
    expect(extraDeckType(createCard({ type_primary: 'Trap', type_tags: [] }))).toBeNull()
  })

  it('falls back to type_primary when tags are absent', () => {
    expect(isExtra(createCard({ type_primary: 'Xyz', type_tags: [] }))).toBe(true)
  })
})

describe('cardCategory', () => {
  it('classifies spells and traps, defaulting to monster', () => {
    expect(cardCategory(createCard({ type_primary: 'Spell' }))).toBe('spell')
    expect(cardCategory(createCard({ type_primary: 'Trap' }))).toBe('trap')
    expect(cardCategory(createCard({ type_primary: 'Effect' }))).toBe('monster')
    expect(cardCategory(null)).toBe('monster')
  })
})

describe('buildCardLookup', () => {
  it('indexes cards by id and canonical id', () => {
    const alt = createCard({ id: 999, canonicalId: 14558127 })
    const lookup = buildCardLookup([alt])

    expect(lookup.get(999)).toBe(alt)
    expect(lookup.get(14558127)).toBe(alt)
  })

  it('keeps the primary id when a canonical id collides', () => {
    const primary = createCard({ id: 100 })
    const other = createCard({ id: 200, canonicalId: 100 })
    const lookup = buildCardLookup([primary, other])

    expect(lookup.get(100)).toBe(primary)
  })
})

describe('groupDeckCards', () => {
  it('collapses duplicates into a single entry with a count', () => {
    const ash = createCard({ id: 1, name_en: 'Ash Blossom' })
    const lookup = buildCardLookup([ash])

    const groups = groupDeckCards([1, 1, 1], lookup)

    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ id: 1, count: 3, card: ash })
  })

  it('preserves first-seen order across interleaved ids', () => {
    const lookup = buildCardLookup([
      createCard({ id: 1 }),
      createCard({ id: 2 }),
    ])

    const groups = groupDeckCards([2, 1, 2, 1, 1], lookup)

    expect(groups.map((group) => group.id)).toEqual([2, 1])
    expect(groups.map((group) => group.count)).toEqual([2, 3])
  })

  it('returns a null card when data is missing', () => {
    const groups = groupDeckCards([404], buildCardLookup([]))

    expect(groups[0]).toMatchObject({ id: 404, count: 1, card: null })
  })
})
