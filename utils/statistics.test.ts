import { afterEach, describe, expect, it, vi } from 'vitest'
import { getArchetypeIndex, getDeepDive, requestDeepDive } from '@utils/statistics'

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
