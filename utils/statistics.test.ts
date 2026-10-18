import { afterEach, describe, expect, it, vi } from 'vitest'
import { getArchetypeIndex, getDeepDive, requestDeepDive, subRows, type LeanArchetype } from '@utils/statistics'

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

describe('section 03 rows', () => {
  it('subRows: pure first candidate, only mixes the archetype leads', () => {
    const r = (archetype: number[], games: number) => ({ archetype, games }) as LeanArchetype
    const views = { general: [r([9], 7)], generalCount: 1, pure: [r([9], 4)], combined: [r([9, 7], 3), r([7, 9], 2)] }
    expect(subRows(9, views)).toEqual({ pure: r([9], 4), mixes: [r([9, 7], 3)] })
    expect(subRows(7, views)).toEqual({ pure: null, mixes: [r([7, 9], 2)] })
  })
})
