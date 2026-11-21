import { describe, expect, it } from 'vitest'
import { coverSeasonOf } from './covers'

const seasons = { tcg: { id: 14, code: 'tcg-3', label: 'TCG 3', open: true }, genesys: { id: 2, code: 'genesys-1', label: 'Genesys 1', open: true } }
const ladder = { lists: 10, share: 0.1, winRate: null, duelists: 3, secondaryLists: 0, pureLists: 4 }

describe('coverSeasonOf', () => {
  it('reads the candidates from a ladder the deck leads in: TCG first, else Genesys', () => {
    expect(coverSeasonOf({ tcg: ladder, genesys: ladder }, seasons)).toBe(14)
    expect(coverSeasonOf({ tcg: null, genesys: ladder }, seasons)).toBe(2)
  })

  it('has no season to read when the deck leads no list in the shown seasons', () => {
    expect(coverSeasonOf({ tcg: null, genesys: null }, seasons)).toBeUndefined()
    expect(coverSeasonOf({ tcg: ladder, genesys: null }, { tcg: null, genesys: seasons.genesys })).toBeUndefined()
  })
})
