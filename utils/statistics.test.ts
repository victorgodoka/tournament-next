import { afterEach, describe, expect, it, vi } from 'vitest'
import { deckHref, getArchetypeIndex, getDeepDive, growthDays, matchupStatus, requestDeepDive } from '@utils/statistics'

afterEach(() => vi.unstubAllGlobals())

/* API_URL is empty in tests, so the request URL is relative: give it a base to parse. */
const urlOf = (fetchMock: ReturnType<typeof vi.fn>) => new URL(String(fetchMock.mock.calls[0]![0]), 'http://api.test')

describe('deep dive API client', () => {
  it('sends mode and keeps combined order', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ status: 'missing' })))
    vi.stubGlobal('fetch', fetchMock)
    await getDeepDive('tcg-2', 'combined', [451, 207])
    const url = urlOf(fetchMock)
    expect(url.searchParams.get('mode')).toBe('combined')
    expect(url.searchParams.get('key')).toBe('451-207')
  })

  it('sends mode on the archetype index', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ archetypes: [] })))
    vi.stubGlobal('fetch', fetchMock)
    await getArchetypeIndex('tcg-2', 'general')
    const url = urlOf(fetchMock)
    expect(url.searchParams.get('mode')).toBe('general')
    expect(url.searchParams.get('season')).toBe('tcg-2')
  })

  it('sends mode and keeps combined order in the POST body', async () => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => new Response(JSON.stringify({ status: 'running' })))
    vi.stubGlobal('fetch', fetchMock)
    await requestDeepDive('tcg-2', 'combined', [451, 207])
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(body).toEqual({ season: 'tcg-2', mode: 'combined', key: '451-207' })
  })
})

const ci = (lower: number, upper: number) => ({ lower, upper, margin: (upper - lower) / 2 })

describe('matchupStatus', () => {
  it('calls a matchup only when the whole interval is on one side of 50%', () => {
    expect(matchupStatus(ci(0.51, 0.55))).toBe('favorable')
    expect(matchupStatus(ci(0.46, 0.49))).toBe('unfavorable')
    expect(matchupStatus(ci(0.49, 0.58))).toBe('neutral')
    expect(matchupStatus(undefined)).toBe('neutral')
  })
})

describe('growthDays', () => {
  it('is half the synced days, at most 7 and at least 1', () => {
    expect([1, 4, 11, 14, 40].map(growthDays)).toEqual([1, 2, 5, 7, 7])
  })
})

describe('deckHref', () => {
  it('keeps the season over the ladder and leaves the main mode out', () => {
    expect(deckHref([1, 2], { ladder: 'tcg' })).toBe('/statistics/archetypes/1-2?ladder=tcg')
    expect(deckHref([1], { ladder: 'tcg', season: 'tcg-2' }, 'general')).toBe('/statistics/archetypes/1?season=tcg-2&mode=general')
  })
})

describe('the main mode', () => {
  it('sends no mode, so the API reads the ranking key', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ status: 'missing' })))
    vi.stubGlobal('fetch', fetchMock)
    await getDeepDive('tcg-2', 'main', [207, 451])
    const url = urlOf(fetchMock)
    expect(url.searchParams.has('mode')).toBe(false)
    expect(url.searchParams.get('key')).toBe('207-451')
  })
})
