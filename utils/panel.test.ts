import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSeries, deleteSeries, getPanelDeck, listPanelDecks, listSeries, listStaples, resetStaple, setStaple, startAnalyticsSync, updateApiAccount, updateSeries, updateSettings } from './panel'

afterEach(() => vi.unstubAllGlobals())

const stub = (body: unknown, status = 200) => {
  const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => new Response(status === 204 ? null : JSON.stringify(body), { status }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}
const url = (mock: ReturnType<typeof stub>) => new URL(String(mock.mock.calls[0]![0]), 'http://api.test')
const init = (mock: ReturnType<typeof stub>) => mock.mock.calls[0]![1]!

describe('deck classification', () => {
  it('asks for a season and unwraps the decks', async () => {
    const mock = stub({ decks: [{ key: '1' }] })
    expect(await listPanelDecks(14)).toEqual([{ key: '1' }])
    expect(url(mock).pathname).toBe('/panel/analytics/decks')
    expect(url(mock).searchParams.get('season')).toBe('14')
  })

  it('encodes a key and asks for Unknown as "-"', async () => {
    const mock = stub({ setcodes: [] })
    await getPanelDeck(14, '482>65537')
    expect(url(mock).pathname).toBe('/panel/analytics/decks/482%3E65537')
    const empty = stub({ setcodes: [] })
    await getPanelDeck(14, '')
    expect(url(empty).pathname).toBe('/panel/analytics/decks/-')
  })

  it('lists, sets and resets staples', async () => {
    const list = stub({ staples: [{ card: 1 }] })
    expect(await listStaples(14)).toEqual([{ card: 1 }])
    expect(url(list).searchParams.get('season')).toBe('14')
    const put = stub({ card: 5, source: 'manual', enabled: false })
    await setStaple(5, false)
    expect(url(put).pathname).toBe('/panel/staples/5')
    expect(init(put).method).toBe('PUT')
    expect(JSON.parse(String(init(put).body))).toEqual({ enabled: false })
    const del = stub(null, 204)
    expect(await resetStaple(5)).toBeUndefined()
    expect(init(del).method).toBe('DELETE')
  })
})

describe('job', () => {
  it('reports a dispatch without a token as unavailable', async () => {
    const mock = stub({ status: 'unavailable', from: '2026-10-01', to: '2026-10-01', ladder: null }, 202)
    const answer = await startAnalyticsSync({ from: '2026-10-01' })
    expect(answer.status).toBe('unavailable')
    expect(url(mock).pathname).toBe('/panel/analytics/sync')
  })
})

describe('settings and keys', () => {
  it('patches only what it is given', async () => {
    const mock = stub({})
    await updateSettings({ 'analytics.tiers': { t1Gap: 0.005 } })
    expect(init(mock).method).toBe('PATCH')
    expect(JSON.parse(String(init(mock).body))).toEqual({ 'analytics.tiers': { t1Gap: 0.005 } })
  })

  it('updates an account by Discord id', async () => {
    const mock = stub({})
    await updateApiAccount('123456789012345678', { blocked: true })
    expect(url(mock).pathname).toBe('/panel/api-keys/123456789012345678')
    expect(JSON.parse(String(init(mock).body))).toEqual({ blocked: true })
  })
})

describe('series', () => {
  const input = { name: 'A', description: '', archetype: null, archetypes: [4], cards: [1], mentions: [], cover: null }

  it('lists, creates, updates and deletes', async () => {
    const list = stub({ series: [{ id: 1 }] })
    expect(await listSeries()).toEqual([{ id: 1 }])
    expect(url(list).pathname).toBe('/panel/series')
    const post = stub({ id: 2 }, 201)
    await createSeries(input)
    expect(init(post).method).toBe('POST')
    expect(JSON.parse(String(init(post).body))).toEqual(input)
    const patch = stub({ id: 2 })
    await updateSeries(2, input)
    expect(url(patch).pathname).toBe('/panel/series/2')
    expect(init(patch).method).toBe('PATCH')
    const del = stub(null, 204)
    await deleteSeries(2)
    expect(url(del).pathname).toBe('/panel/series/2')
    expect(init(del).method).toBe('DELETE')
  })
})
