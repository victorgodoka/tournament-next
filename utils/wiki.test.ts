import { describe, expect, it } from 'vitest'
import { legalityRows, tcgDebut, type Banlist, type WikiCard } from './wiki'

const LISTS: Banlist[] = [
  { id: 2, name: 'TCG 18.05.2026', format: 'tcg', pointCap: null, bannedTypes: [], cards: 226 },
  { id: 100, name: 'Genesys', format: 'genesys', pointCap: 100, bannedTypes: ['pendulum', 'link'], cards: 761 },
]

const card = (patch: Partial<WikiCard>): WikiCard =>
  ({ monsterTypes: [], erratas: [], released: { ocg: null, tcg: null }, banlists: null, ...patch }) as WikiCard

describe('legalityRows', () => {
  it('reads an absent entry as unlimited, not as unknown', () => {
    expect(legalityRows(card({}), LISTS)).toEqual([
      { list: 'TCG 18.05.2026', status: 'Unlimited', copies: '3', tone: 'neutral' },
      { list: 'Genesys', status: '0 points', copies: '3', tone: 'neutral' },
    ])
  })

  it('turns limitation into copies on a normal list and points on Genesys', () => {
    const ash = card({ banlists: [{ name: 'TCG 18.05.2026', limitation: 1 }, { name: 'Genesys', limitation: 20 }] })
    expect(legalityRows(ash, LISTS)).toEqual([
      { list: 'TCG 18.05.2026', status: 'Limited', copies: '1', tone: 'indigo' },
      { list: 'Genesys', status: '20 points', copies: '3', tone: 'cyan' },
    ])
  })

  // The trap the API docs warn about: a type ban is never a points entry, so on the card alone a
  // Link monster is indistinguishable from a free one.
  it('catches a Genesys type ban that the card carries no entry for', () => {
    const link = card({ monsterTypes: ['effect', 'link'] })
    expect(legalityRows(link, LISTS)[1]).toEqual({ list: 'Genesys', status: 'Banned type', copies: '0', tone: 'gold' })
  })
})

describe('tcgDebut', () => {
  it('prefers the oldest errata date over the reprint that carries the current text', () => {
    const sangan = card({
      released: { ocg: '1999-11-18', tcg: '2017-07-21' },
      erratas: [{ id: 26202185, description: '…', date: '2002-06-26' }],
    })
    expect(tcgDebut(sangan)).toBe('2002-06-26')
  })

  it('falls back to the release date, and to null when there is none', () => {
    expect(tcgDebut(card({ released: { ocg: '1999-11-18', tcg: '2002-06-26' } }))).toBe('2002-06-26')
    expect(tcgDebut(card({}))).toBeNull()
  })
})
