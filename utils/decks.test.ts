import { afterEach, describe, expect, it, vi } from 'vitest'
import { DeckApiError, DeckConflictError, createDeck, deleteDeck, getDeck, getRevision, listMyDecks, listRevisions, restoreRevision, updateDeck } from './decks'

const reply = (status: number, body?: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status })
const stub = (res: Response) => {
  const fetchMock = vi.fn().mockResolvedValue(res)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}
const call = (fetchMock: ReturnType<typeof vi.fn>) => {
  const [url, init] = fetchMock.mock.calls[0]!
  return { url: String(url), init: init as RequestInit }
}

afterEach(() => vi.unstubAllGlobals())

describe('decks client', () => {
  it('409 with details.latest rejects with DeckConflictError carrying latest', async () => {
    stub(reply(409, { error: 'CONFLICT', message: 'stale', details: { latest: { id: 'a', revision: 5 } } }))
    const error = await updateDeck('a', { name: 'x' }, 4).catch((e) => e)
    expect(error).toBeInstanceOf(DeckConflictError)
    expect(error).toBeInstanceOf(DeckApiError)
    expect(error.status).toBe(409)
    expect(error.latest.revision).toBe(5)
  })

  it('401 rejects with DeckApiError', async () => {
    stub(reply(401, { error: 'UNAUTHENTICATED', message: 'no session' }))
    const error = await listMyDecks().catch((e) => e)
    expect(error).toBeInstanceOf(DeckApiError)
    expect(error).not.toBeInstanceOf(DeckConflictError)
    expect(error.status).toBe(401)
    expect(error.code).toBe('UNAUTHENTICATED')
  })

  it('a 409 without details.latest is a plain DeckApiError', async () => {
    stub(reply(409, { error: 'CONFLICT' }))
    const error = await deleteDeck('a').catch((e) => e)
    expect(error).toBeInstanceOf(DeckApiError)
    expect(error).not.toBeInstanceOf(DeckConflictError)
  })

  it('400 keeps details', async () => {
    stub(reply(400, { error: 'BAD_REQUEST', message: 'unknown', details: { unknown: [1] } }))
    const error = await createDeck({ name: 'x', format: null, main: [1], extra: [], side: [] }).catch((e) => e)
    expect(error.details).toEqual({ unknown: [1] })
  })

  it('getDeck: 404 gives null, other errors throw, cookie is forwarded', async () => {
    stub(reply(404, { error: 'NOT_FOUND' }))
    expect(await getDeck('a')).toBeNull()
    stub(reply(500))
    await expect(getDeck('a')).rejects.toBeInstanceOf(DeckApiError)
    const fetchMock = stub(reply(200, { id: 'a' }))
    expect(await getDeck('a', 'sid=1')).toEqual({ id: 'a' })
    const { url, init } = call(fetchMock)
    expect(url).toMatch(/\/decks\/a$/)
    expect(init).toMatchObject({ credentials: 'include', cache: 'no-store', headers: { cookie: 'sid=1' } })
  })

  it('updateDeck sends the patch with baseRevision and force', async () => {
    const fetchMock = stub(reply(200, { id: 'a', revision: 5 }))
    await updateDeck('a', { name: 'x' }, 4)
    const { url, init } = call(fetchMock)
    expect(url).toMatch(/\/decks\/a$/)
    expect(init.method).toBe('PATCH')
    expect(init.body).toBe('{"name":"x","baseRevision":4,"force":false}')
    expect(init.headers).toMatchObject({ 'content-type': 'application/json' })
    expect(init).toMatchObject({ credentials: 'include', cache: 'no-store' })
  })

  it('updateDeck force: true', async () => {
    const fetchMock = stub(reply(200, {}))
    await updateDeck('a', { name: 'x' }, 4, true)
    expect(call(fetchMock).init.body).toBe('{"name":"x","baseRevision":4,"force":true}')
  })

  it('createDeck POSTs JSON to /decks', async () => {
    const fetchMock = stub(reply(201, { id: 'a' }))
    const input = { name: 'x', format: null, main: [1], extra: [], side: [] }
    await createDeck(input)
    const { url, init } = call(fetchMock)
    expect(url).toMatch(/\/decks$/)
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify(input))
  })

  it('listMyDecks encodes the cursor only when given', async () => {
    let fetchMock = stub(reply(200, { decks: [], nextCursor: null }))
    await listMyDecks()
    expect(call(fetchMock).url).toMatch(/\/decks\/mine$/)
    fetchMock = stub(reply(200, { decks: [], nextCursor: null }))
    await listMyDecks('1_ab&c')
    expect(call(fetchMock).url).toMatch(/\/decks\/mine\?cursor=1_ab%26c$/)
  })

  it('deleteDeck resolves on 204 with no body and no content-type', async () => {
    const fetchMock = stub(reply(204))
    await expect(deleteDeck('a')).resolves.toBeUndefined()
    const { init } = call(fetchMock)
    expect(init.method).toBe('DELETE')
    expect(init.headers).toBeUndefined()
    expect(init.body).toBeUndefined()
  })

  it('restoreRevision POSTs with no body and no content-type', async () => {
    const fetchMock = stub(reply(200, { id: 'a' }))
    await restoreRevision('a', 2)
    const { url, init } = call(fetchMock)
    expect(url).toMatch(/\/decks\/a\/revisions\/2\/restore$/)
    expect(init.method).toBe('POST')
    expect(init.headers).toBeUndefined()
    expect(init.body).toBeUndefined()
  })

  it('listRevisions and getRevision hit the revision routes', async () => {
    let fetchMock = stub(reply(200, { revisions: [] }))
    await listRevisions('a')
    expect(call(fetchMock).url).toMatch(/\/decks\/a\/revisions$/)
    fetchMock = stub(reply(200, { revision: 3 }))
    await getRevision('a', 3)
    expect(call(fetchMock).url).toMatch(/\/decks\/a\/revisions\/3$/)
  })

  it('encodes the id in the path', async () => {
    const fetchMock = stub(reply(200, {}))
    await getDeck('a/b')
    expect(call(fetchMock).url).toMatch(/\/decks\/a%2Fb$/)
  })
})
