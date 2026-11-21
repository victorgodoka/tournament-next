import { afterEach, describe, expect, it, vi } from 'vitest'
import * as panel from './panel'
import { createFilter, createSeries, deckCount, deleteSeries, DEFAULT_CLASSIFICATION, EMPTY_RULES, getDeck, getDeckAlongside, getSeasonUnder, getVersionChanges, ignoreSetcode, listIgnored, resetArchetypeStaples, setArchetypeStaples, unignoreSetcode, listDecks, previewFilter, getPanelDeck, listPanelDecks, listSeries, listStaples, resetStaple, setStaple, startAnalyticsSync, updateApiAccount, updateSeries, updateSettings } from './panel'

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
  const input = { name: 'A', description: '', archetype: null, archetypes: [{ code: 4, only: true }], cards: [{ id: 1, only: false }], mentions: [], filters: [2], cover: null }

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

describe('identified decks (read only) and filters', () => {
  it('reads the decks of the picked seasons, a lead and what it plays alongside', async () => {
    const list = stub({ decks: [] })
    await listDecks({ tcg: 14 })
    expect(url(list).pathname + url(list).search).toBe('/panel/decks?tcg=14')
    const one = stub({})
    await getDeck(65561, 14)
    expect(url(one).pathname + url(one).search).toBe('/panel/decks/65561?season=14')
    const along = stub({})
    await getDeckAlongside(65561, 14)
    expect(url(along).pathname + url(along).search).toBe('/panel/decks/65561/alongside?season=14')
  })

  it('reads the sets under the minimum and the name changes', async () => {
    const under = stub({ sets: [] })
    await getSeasonUnder(14)
    expect(url(under).pathname + url(under).search).toBe('/panel/decks/under?season=14')
    const changes = stub({ added: [], removed: [] })
    await getVersionChanges(7)
    expect(url(changes).pathname + url(changes).search).toBe('/panel/decks/changes?days=7')
  })

  it('stages and undoes the staples of a whole setcode', async () => {
    const put = stub({ code: 392, cards: [1, 2] })
    expect(await setArchetypeStaples(392)).toEqual({ code: 392, cards: [1, 2] })
    expect(url(put).pathname).toBe('/panel/staples/archetype/392')
    expect(init(put).method).toBe('PUT')
    const del = stub(null, 204)
    await resetArchetypeStaples(392)
    expect(url(del).pathname).toBe('/panel/staples/archetype/392')
    expect(init(del).method).toBe('DELETE')
  })

  it('lists, ignores and stops ignoring a setcode', async () => {
    const list = stub({ archetypes: [{ code: 392, name: 'Mulcharmy', updatedAt: '' }] })
    expect(await listIgnored()).toEqual([{ code: 392, name: 'Mulcharmy', updatedAt: '' }])
    expect(url(list).pathname).toBe('/panel/ignored-archetypes')
    const put = stub({ archetypes: [] })
    await ignoreSetcode(392)
    expect(url(put).pathname).toBe('/panel/ignored-archetypes/392')
    expect(init(put).method).toBe('PUT')
    const del = stub(null, 204)
    await unignoreSetcode(392)
    expect(url(del).pathname).toBe('/panel/ignored-archetypes/392')
    expect(init(del).method).toBe('DELETE')
  })

  it('counts the pure deck only when it has lists', () => {
    const ladder = (pureLists: number) => ({ lists: 10, share: 0.1, winRate: null, duelists: 3, secondaryLists: 0, pureLists })
    expect(deckCount({ versions: 2, tcg: ladder(0), genesys: null })).toBe(2)
    expect(deckCount({ versions: 2, tcg: ladder(0), genesys: ladder(4) })).toBe(3)
    expect(deckCount({ versions: 0, tcg: null, genesys: null })).toBe(0)
  })

  it('has no call for variations, ignoring, review or a third name: the build names decks by itself', () => {
    for (const name of ['setVariation', 'setVariationCover', 'getDeckThird', 'getReviewCount', 'setIgnore', 'ignoreArchetype', 'unignoreArchetype']) {
      expect(name in panel, name).toBe(false)
    }
  })

  it('defaults the classification settings to the four rates and sends versionShare', async () => {
    expect(DEFAULT_CLASSIFICATION).toEqual({ stapleShare: 0.1, stapleForeign: 0.5, lowValueShare: 0.02, versionShare: 0.005 })
    const patch = stub({})
    await updateSettings({ 'analytics.classification': { versionShare: 0.01 } })
    expect(JSON.parse(String(init(patch).body))).toEqual({ 'analytics.classification': { versionShare: 0.01 } })
  })

  it('previews a filter without saving and creates one', async () => {
    const preview = stub({ cards: [] })
    await previewFilter({ rules: EMPTY_RULES, excluded: [] }, 60)
    expect(url(preview).pathname).toBe('/panel/filters/preview')
    expect(JSON.parse(url(preview).searchParams.get('rules')!)).toEqual(EMPTY_RULES)
    expect(url(preview).searchParams.get('excluded')).toBe('[]')
    expect(url(preview).searchParams.get('offset')).toBe('60')
    expect(init(preview).method ?? 'GET').toBe('GET')
    const post = stub({ id: 1 }, 201)
    await createFilter({ name: 'LIGHT Fiend', description: '', rules: EMPTY_RULES, excluded: [] })
    expect(url(post).pathname).toBe('/panel/filters')
  })
})
