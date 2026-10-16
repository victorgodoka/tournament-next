import { describe, expect, it } from 'vitest'
import { EMPTY_POOL_QUERY, poolParams } from '@utils/cards'
import type { CardData } from '@utils/deck/types'
import type { Banlist } from '@utils/wiki'
import { activeFilterCount, effectiveQuery, resetFilters, tileStatus } from './pool-query'

const list = (id: number, format: string, pointCap: number | null = null): Banlist =>
  ({ id, name: format.toUpperCase(), format, pointCap, bannedTypes: pointCap ? ['pendulum', 'link'] : [], cards: 0 })
const TCG = list(2, 'tcg')
const WCS = list(3, 'wcs')
const GENESYS = list(100, 'genesys', 100)

const card = (banlists: CardData['banlists']) => ({ id: 1, banlists }) as CardData

describe('effectiveQuery', () => {
  it('sends the list, legal-only and the region of a normal list', () => {
    const q = effectiveQuery({ ...EMPTY_POOL_QUERY, status: ['limited'], pointsMin: 5 }, TCG)
    expect(poolParams(q, 1).toString()).toBe('banlist=2&legal=true&status=limited&format=tcg&sort=name&order=asc&page=1&limit=60')
  })

  it('drops status on Genesys and points on normal lists, which the API would 400', () => {
    const q = { ...EMPTY_POOL_QUERY, status: ['limited'], pointsMin: 5 }
    expect(effectiveQuery(q, GENESYS)).toMatchObject({ status: [], pointsMin: 5, format: 'tcg' })
    expect(effectiveQuery(q, TCG).pointsMin).toBeUndefined()
  })

  it('has no region on WCS, so dates and legal-only send no format', () => {
    const q = effectiveQuery({ ...EMPTY_POOL_QUERY, releasedBefore: '2005-04-01' }, WCS)
    expect(q.format).toBeUndefined()
    expect(poolParams(q, 1).has('releasedBefore')).toBe(false)
  })

  it('sends a region for a release window even with legal-only off', () => {
    expect(effectiveQuery({ ...EMPTY_POOL_QUERY, legalOnly: false }, TCG).format).toBeUndefined()
    expect(effectiveQuery({ ...EMPTY_POOL_QUERY, legalOnly: false, releasedAfter: '2020-01-01' }, TCG).format).toBe('tcg')
  })

  it('sends nothing list-bound without a list', () => {
    expect(poolParams(effectiveQuery({ ...EMPTY_POOL_QUERY, status: ['limited'] }, null), 1).toString()).toBe('sort=name&order=asc&page=1&limit=60')
  })
})

describe('activeFilterCount', () => {
  it('counts each drawer field once, a range as one', () => {
    expect(activeFilterCount(EMPTY_POOL_QUERY)).toBe(0)
    expect(activeFilterCount({ ...EMPTY_POOL_QUERY, archetype: 'Sky Striker', types: ['xyz', 'effect'], levelMin: 4, levelMax: 4, atkMax: 2000 })).toBe(4)
    // Quick chips and the search are on screen already.
    expect(activeFilterCount({ ...EMPTY_POOL_QUERY, text: 'ash', kind: ['monster'], extraDeck: true, attribute: ['dark'] })).toBe(0)
  })

  it('ignores a release window that is not sent', () => {
    expect(activeFilterCount({ ...EMPTY_POOL_QUERY, releasedAfter: '2020-01-01' })).toBe(0)
    expect(activeFilterCount({ ...EMPTY_POOL_QUERY, format: 'tcg', releasedAfter: '2020-01-01' })).toBe(1)
  })
})

it('resetFilters keeps the search, quick chips, sort and legal-only', () => {
  const q = { ...EMPTY_POOL_QUERY, text: 'ash', kind: ['monster' as const], sort: 'atk' as const, legalOnly: false, race: ['zombie'], atkMin: 100 }
  expect(resetFilters(q)).toEqual({ ...EMPTY_POOL_QUERY, text: 'ash', kind: ['monster'], sort: 'atk', legalOnly: false })
})

describe('tileStatus', () => {
  it('maps copies 0/1/2 to a badge and 3 to none', () => {
    expect(tileStatus(card([{ name: 'TCG', limitation: 0 }]), TCG)).toBe('forbidden')
    expect(tileStatus(card([{ name: 'TCG', limitation: 1 }]), TCG)).toBe('limited')
    expect(tileStatus(card([{ name: 'TCG', limitation: 2 }]), TCG)).toBe('semi-limited')
    expect(tileStatus(card(null), TCG)).toBeUndefined()
  })

  it('shows Genesys points above 0, and nothing without a list', () => {
    expect(tileStatus(card([{ name: 'GENESYS', limitation: 20 }]), GENESYS)).toEqual({ points: 20 })
    expect(tileStatus(card(null), GENESYS)).toBeUndefined()
    expect(tileStatus(card([{ name: 'TCG', limitation: 0 }]), null)).toBeUndefined()
  })
})
