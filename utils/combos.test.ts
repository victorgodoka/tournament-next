// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ComboApiError, ComboConflictError, comboUrl, deleteCombo, getCombo, listMyCombos, saveCombo, updateCombo, type ComboInput } from './combos'

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

const input: ComboInput = { title: 'Snake-Eye loop', deckId: 'a1b2c3d4e5f60718', payload: { deck: { main: [1], extra: [], side: [] }, name: 'x', actions: [], start: 0 } }

afterEach(() => vi.unstubAllGlobals())

describe('combos client', () => {
  it('saveCombo POSTs title, deckId and payload to /combos', async () => {
    const fetchMock = stub(reply(201, { id: 'abc', revision: 1 }))
    await expect(saveCombo(input)).resolves.toEqual({ id: 'abc', revision: 1 })
    const { url, init } = call(fetchMock)
    expect(url).toMatch(/\/combos$/)
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify(input))
    expect(init.headers).toMatchObject({ 'content-type': 'application/json' })
    expect(init).toMatchObject({ credentials: 'include', cache: 'no-store' })
  })

  it('a null deckId is sent as null, an absent one too', async () => {
    let fetchMock = stub(reply(201, { id: 'abc', revision: 1 }))
    await saveCombo({ ...input, deckId: null })
    expect(JSON.parse(String(call(fetchMock).init.body))).toHaveProperty('deckId', null)
    fetchMock = stub(reply(200, { id: 'abc', revision: 2 }))
    await updateCombo('abc', { ...input, deckId: undefined } as unknown as ComboInput, 1)
    expect(JSON.parse(String(call(fetchMock).init.body))).toHaveProperty('deckId', null)
  })

  it('updateCombo PATCHes the whole combo plus baseRevision', async () => {
    const fetchMock = stub(reply(200, { id: 'abc', revision: 4 }))
    await expect(updateCombo('abc', input, 3)).resolves.toEqual({ id: 'abc', revision: 4 })
    const { url, init } = call(fetchMock)
    expect(url).toMatch(/\/combos\/abc$/)
    expect(init.method).toBe('PATCH')
    expect(init.body).toBe(JSON.stringify({ ...input, baseRevision: 3 }))
    expect(init.headers).toMatchObject({ 'content-type': 'application/json' })
    expect(init).toMatchObject({ credentials: 'include', cache: 'no-store' })
  })

  it('deleteCombo resolves on 204 with no body and no content-type', async () => {
    const fetchMock = stub(reply(204))
    await expect(deleteCombo('abc')).resolves.toBeUndefined()
    const { url, init } = call(fetchMock)
    expect(url).toMatch(/\/combos\/abc$/)
    expect(init.method).toBe('DELETE')
    expect(init.headers).toBeUndefined()
    expect(init.body).toBeUndefined()
    expect(init).toMatchObject({ credentials: 'include', cache: 'no-store' })
  })

  it('listMyCombos encodes the cursor only when given', async () => {
    const page = { combos: [{ id: 'abc', title: 't', deckName: 'd', steps: 3, updatedAt: '2026-10-19T00:00:00.000Z' }], nextCursor: '1_ab&c' }
    let fetchMock = stub(reply(200, page))
    await expect(listMyCombos()).resolves.toEqual(page)
    expect(call(fetchMock).url).toMatch(/\/combos\/mine$/)
    expect(call(fetchMock).init).toMatchObject({ credentials: 'include', cache: 'no-store' })
    fetchMock = stub(reply(200, { combos: [], nextCursor: null }))
    await listMyCombos('1_ab&c')
    expect(call(fetchMock).url).toMatch(/\/combos\/mine\?cursor=1_ab%26c$/)
  })

  it('getCombo GETs the combo with credentials and no-store', async () => {
    const shared = { id: 'abc', title: 't', deckId: null, owner: { id: '1', name: 'Yugi' }, payload: input.payload, revision: 2, updatedAt: '2026-10-19T00:00:00.000Z' }
    const fetchMock = stub(reply(200, shared))
    await expect(getCombo('abc')).resolves.toEqual(shared)
    const { url, init } = call(fetchMock)
    expect(url).toMatch(/\/combos\/abc$/)
    expect(init.method).toBeUndefined()
    expect(init).toMatchObject({ credentials: 'include', cache: 'no-store' })
  })

  it('getCombo: 404 gives null, other errors throw', async () => {
    stub(reply(404, { error: 'NOT_FOUND' }))
    expect(await getCombo('abc')).toBeNull()
    stub(reply(500))
    await expect(getCombo('abc')).rejects.toBeInstanceOf(ComboApiError)
  })

  it('ids are path-encoded', async () => {
    const fetchMock = stub(reply(204))
    await deleteCombo('a/b')
    expect(call(fetchMock).url).toMatch(/\/combos\/a%2Fb$/)
  })

  it('409 CONFLICT rejects with ComboConflictError carrying the current revision', async () => {
    stub(reply(409, { error: 'CONFLICT', message: 'stale', details: { revision: 7 } }))
    const error = await updateCombo('abc', input, 3).catch((e) => e)
    expect(error).toBeInstanceOf(ComboConflictError)
    expect(error).toBeInstanceOf(ComboApiError)
    expect(error.status).toBe(409)
    expect(error.code).toBe('CONFLICT')
    expect(error.revision).toBe(7)
  })

  it('409 LIMIT rejects with a plain ComboApiError coded LIMIT', async () => {
    stub(reply(409, { error: 'LIMIT', message: '500 combos' }))
    const error = await saveCombo(input).catch((e) => e)
    expect(error).toBeInstanceOf(ComboApiError)
    expect(error).not.toBeInstanceOf(ComboConflictError)
    expect(error.status).toBe(409)
    expect(error.code).toBe('LIMIT')
  })

  it('a 409 CONFLICT without a numeric details.revision is a plain ComboApiError', async () => {
    stub(reply(409, { error: 'CONFLICT' }))
    const error = await updateCombo('abc', input, 3).catch((e) => e)
    expect(error).toBeInstanceOf(ComboApiError)
    expect(error).not.toBeInstanceOf(ComboConflictError)
  })

  it('401, 400 and 413 reject with ComboApiError keeping status, code and details', async () => {
    stub(reply(401, { error: 'UNAUTHENTICATED', message: 'no session' }))
    let error = await listMyCombos().catch((e) => e)
    expect(error).toBeInstanceOf(ComboApiError)
    expect([error.status, error.code]).toEqual([401, 'UNAUTHENTICATED'])
    stub(reply(400, { error: 'BAD_REQUEST', message: 'title', details: { field: 'title' } }))
    error = await saveCombo(input).catch((e) => e)
    expect([error.status, error.code, error.details]).toEqual([400, 'BAD_REQUEST', { field: 'title' }])
    stub(reply(413, { error: 'PAYLOAD_TOO_LARGE' }))
    error = await saveCombo(input).catch((e) => e)
    expect([error.status, error.code]).toEqual([413, 'PAYLOAD_TOO_LARGE'])
  })

  it('an error body that is not JSON still rejects with the status', async () => {
    stub(new Response('<html>', { status: 502 }))
    const error = await listMyCombos().catch((e) => e)
    expect(error).toBeInstanceOf(ComboApiError)
    expect(error.status).toBe(502)
    expect(error.code).toBeUndefined()
  })

  it('comboUrl is the share link on the current origin', () => {
    expect(comboUrl('abc')).toBe(`${location.origin}/simulator/c/abc`)
  })
})
