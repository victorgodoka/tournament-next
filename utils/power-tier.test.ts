import { describe, expect, it } from 'vitest'
import { deckFaces, powerRanked } from './power-tier'
import type { StatArchetype } from './statistics'

const deck = (wilsonLower: number | null, metaShare = 0.02, players = 100) =>
  ({ archetype: [wilsonLower ?? 0], name: String(wilsonLower), wilsonLower, metaShare, players }) as StatArchetype

const scores = (decks: StatArchetype[]) => powerRanked(decks).map((d) => d.wilsonLower)

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
  it('orders by the low end of the win rate, not by how much a deck is played', () => {
    expect(scores([deck(0.5, 0.1), deck(0.55, 0.01)])).toEqual([0.55, 0.5])
  })

  it('leaves out a fringe deck and a deck too few people play, however well they score', () => {
    expect(scores([deck(0.6, 0.003), deck(0.61, 0.02, 2), deck(0.5)])).toEqual([0.5])
  })

  it('leaves out a deck without a score and survives an empty ladder', () => {
    expect(scores([deck(null)])).toEqual([])
  })

  it('ranks by the adjusted win rate when the server sends it', () => {
    const adjusted = { ...deck(0.5), adjusted: { mean: 0.56, lower: 0.54, upper: 0.58, margin: 0.02 } }
    expect(powerRanked([deck(0.55), adjusted]).map((d) => d.wilsonLower)).toEqual([0.5, 0.55])
  })
})
