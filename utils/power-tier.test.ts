import { describe, expect, it } from 'vitest'
import { deckFaces, powerRanked } from './power-tier'
import type { StatArchetype } from './statistics'

const deck = (wilsonLower: number | null, metaShare = 0.02, players = 100, tier: 1 | 2 | 3 | 4 | null = 4) =>
  ({ archetype: [wilsonLower ?? 0], name: String(wilsonLower), wilsonLower, metaShare, players, tier }) as StatArchetype

const tiers = (decks: StatArchetype[]) => powerRanked(decks).map((d) => [d.wilsonLower, d.tier])

describe('deckFaces', () => {
  it('gives a deck sharing its face the next most used card', () => {
    const elfnote = { archetype: [1], face: { id: 10, name: 'Patron' }, cards: [{ id: 10, name: 'Patron' }, { id: 11, name: 'Next' }] } as unknown as StatArchetype
    const hybrid = { archetype: [1, 2], face: { id: 10, name: 'Patron' }, cards: [{ id: 10, name: 'Patron' }, { id: 12, name: 'Other' }] } as unknown as StatArchetype
    const faces = deckFaces([elfnote, hybrid])
    expect(faces.get('1')?.id).toBe(10)
    expect(faces.get('1-2')?.id).toBe(12)
  })
})

describe('powerRanked', () => {
  it('orders by the low end of the win rate, not by what the server called the tier', () => {
    expect(tiers([deck(0.5, 0.1, 100, 1), deck(0.55, 0.01, 100, 4)])).toEqual([
      [0.55, 1],
      [0.5, 3],
    ])
  })

  it('keeps two decks in Tier 1 and moves the rest of the band to Tier 1.5', () => {
    expect(tiers([deck(0.54), deck(0.545), deck(0.548), deck(0.542), deck(0.5)])).toEqual([
      [0.548, 1],
      [0.545, 1],
      [0.542, 1.5],
      [0.54, 1.5],
      [0.5, 3],
    ])
  })

  it('puts a deck on a band edge in the better tier, despite float subtraction', () => {
    expect(tiers([deck(0.548), deck(0.538), deck(0.518), deck(0.488), deck(0.458), deck(0.4579)])).toEqual([
      [0.548, 1],
      [0.538, 1],
      [0.518, 2],
      [0.488, 3],
      [0.458, 4],
      [0.4579, null],
    ])
  })

  it('leaves out a fringe deck and a deck too few people play, however well they score', () => {
    expect(tiers([deck(0.6, 0.003), deck(0.61, 0.02, 2), deck(0.5)])).toEqual([[0.5, 1]])
  })

  it('leaves out a deck without a score and survives an empty ladder', () => {
    expect(tiers([deck(null)])).toEqual([])
  })
})
