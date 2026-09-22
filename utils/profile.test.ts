import { afterEach, describe, expect, it, vi } from 'vitest'
import { getMatches, MATCH_PAGE_SIZE } from './profile'

const capture = () => {
  const fetchMock = vi.fn(async (input: string) => {
    void input
    return new Response(JSON.stringify({ matches: [], nextCursor: null }))
  })
  vi.stubGlobal('fetch', fetchMock)
  // `API_URL` is empty without NEXT_PUBLIC_API_URL, so the path is relative: give it a base to parse against.
  return () => new URL(fetchMock.mock.calls[0]![0], 'http://api.test')
}

afterEach(() => vi.unstubAllGlobals())

describe('getMatches', () => {
  it('asks for a full page and no filter by default', async () => {
    const url = capture()
    await getMatches('187263901827563520')
    expect(url().pathname).toBe('/profiles/187263901827563520/matches')
    expect(url().searchParams.get('limit')).toBe(String(MATCH_PAGE_SIZE))
    expect(url().searchParams.has('cursor')).toBe(false)
    expect(url().searchParams.has('format')).toBe(false)
  })

  it('passes the cursor and the ladder filter through unchanged', async () => {
    const url = capture()
    await getMatches('187263901827563520', { cursor: 'WyIzMjAxNTEwIixudWxsXQ', format: 'genesys' })
    expect(url().searchParams.get('cursor')).toBe('WyIzMjAxNTEwIixudWxsXQ')
    expect(url().searchParams.get('format')).toBe('genesys')
  })
})
