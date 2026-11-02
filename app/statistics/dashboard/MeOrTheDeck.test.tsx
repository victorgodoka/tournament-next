import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '@utils/auth'
import { MeOrTheDeck } from './MeOrTheDeck'
import { MeMessage, MeTable, SignInPrompt } from './MeTable'

vi.mock('next/headers', () => ({ headers: vi.fn() }))
vi.mock('@omega/card-art', () => ({ CardArt: () => null }))

const scope = { ladder: 'tcg', window: 'season', band: 'all' } as const
const respond = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status }))

afterEach(() => vi.unstubAllGlobals())

describe('MeOrTheDeck', () => {
  it('asks a signed-out viewer to sign in, with no call to the API', async () => {
    const fetchMock = respond(200, {})
    vi.stubGlobal('fetch', fetchMock)
    const out = await MeOrTheDeck({ session: null, scope, cookie: null })
    expect(out.type).toBe(SignInPrompt)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  const session = { id: '42' } as AuthUser

  it('reads the signed-in viewer with their cookie', async () => {
    const fetchMock = respond(200, { decks: [{ key: '1' }] })
    vi.stubGlobal('fetch', fetchMock)
    const out = await MeOrTheDeck({ session, scope, cookie: 'omega_session=x' })
    expect(out.type).toBe(MeTable)
    expect(String((fetchMock.mock.calls as unknown[][])[0]![0])).toContain('/statistics/players/42?ladder=tcg')
  })

  it('reports an empty record and a failure apart', async () => {
    vi.stubGlobal('fetch', respond(200, { decks: [] }))
    expect((await MeOrTheDeck({ session, scope, cookie: null })).props).toEqual({ text: 'empty' })
    vi.stubGlobal('fetch', respond(500, {}))
    const out = await MeOrTheDeck({ session, scope, cookie: null })
    expect(out.type).toBe(MeMessage)
    expect(out.props).toEqual({ text: 'failed' })
  })
})
