import { describe, expect, it } from 'vitest'
import { emptyDoc, validateDoc, type WikiStatisticsDeck } from './wiki-doc'
import { statisticsDeckHref, statisticsDeckOf } from './wiki-statistics-deck'
import { docWords } from './wiki-seo'
import type { Meta } from './statistics'

const deck: WikiStatisticsDeck = { key: '115>482', name: 'Sky Striker / Angelechy', ladder: 'genesys', faces: [1, 2] }
const doc = () => ({ ...emptyDoc(), title: 'Decks', blocks: [{ id: 'deck', type: 'statistics-deck' as const, deck, caption: 'Open the matchups.' }] })

describe('Statistics Deck contract', () => {
  it('accepts a saved block and an infobox selection without assets or API lookups', () => {
    expect(validateDoc({ ...doc(), infobox: { statisticsDeck: deck, caption: 'Covers', facts: [{ label: 'Ladder', value: 'Genesys' }] } })).toEqual([])
    expect(docWords(doc())).toBeGreaterThan(3)
  })
  it('rejects arbitrary URLs, invalid ladders and repeated or invalid cover passcodes', () => {
    for (const bad of [{ key: 'https://example.com' }, { ladder: 'casual' }, { faces: [1, 1] }, { faces: [-1] }, { faces: [100_000_000] }, { name: '<script>' }]) {
      const d = doc()
      d.blocks[0]!.deck = { ...deck, ...bad } as WikiStatisticsDeck
      expect(validateDoc(d).length).toBeGreaterThan(0)
    }
  })
  it('keeps the two infobox image sources exclusive', () => {
    expect(validateDoc({ ...doc(), infobox: { statisticsDeck: deck, asset: 'old', facts: [] } })).toContain('Choose either a library image or a Statistics Deck for the infobox.')
  })
  it('constructs an internal URL from key and ladder', () => {
    expect(statisticsDeckHref(deck)).toBe('/statistics/archetypes/115%3E482?ladder=genesys')
  })
  it('resolves each hybrid component cover, deduplicating shared artwork', () => {
    const meta = { decks: [{ key: '115', face: 1 }, { key: '482*', face: 2 }, { key: '483', face: 2 }] } as Meta
    expect(statisticsDeckOf({ key: '115>482>483', name: 'Hybrid', face: 9 }, meta, 'tcg').faces).toEqual([1, 2])
    expect(statisticsDeckOf({ key: '99', name: 'Missing', face: 9 }, meta, 'tcg').faces).toEqual([9])
  })
})
