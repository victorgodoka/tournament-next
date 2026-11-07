import { afterEach, describe, expect, it, vi } from 'vitest'
import { listAllArticles } from './articles'

afterEach(() => vi.unstubAllGlobals())

describe('complete wiki index', () => {
  it('follows cursor pages beyond 100 rows, forwarding filters and the viewer session', async () => {
    const rows = Array.from({ length: 130 }, (_, id) => ({ id, slug: `article-${id}` }))
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json({ articles: rows.slice(0, 100), nextCursor: 'next-page' }))
      .mockResolvedValueOnce(Response.json({ articles: rows.slice(100), nextCursor: null }))
    vi.stubGlobal('fetch', fetcher)

    const result = await listAllArticles({ author: '42', sort: 'updated', order: 'asc' }, 'session=viewer')

    expect(result.articles).toEqual(rows)
    expect(result.nextCursor).toBeNull()
    expect(fetcher).toHaveBeenCalledTimes(2)
    const secondCall = fetcher.mock.calls[1]!
    const url = new URL(secondCall[0], 'https://example.test')
    expect(Object.fromEntries(url.searchParams)).toEqual({ author: '42', sort: 'updated', order: 'asc', limit: '100', cursor: 'next-page' })
    expect(secondCall[1]).toMatchObject({ cache: 'no-store', headers: { cookie: 'session=viewer' } })
  })

  it('deduplicates rows repeated across cursor boundaries', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(Response.json({ articles: [{ id: 1 }], nextCursor: 'next' }))
      .mockResolvedValueOnce(Response.json({ articles: [{ id: 1 }, { id: 2 }], nextCursor: null })))
    expect((await listAllArticles()).articles).toEqual([{ id: 1 }, { id: 2 }])
  })

  it('rejects repeated cursors instead of looping or reporting partial counts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => Response.json({ articles: [], nextCursor: 'stuck' })))
    await expect(listAllArticles()).rejects.toMatchObject({ code: 'INVALID_CURSOR' })
  })

  it('fails the complete read if a later page fails', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(Response.json({ articles: [{ id: 1 }], nextCursor: 'next' }))
      .mockResolvedValueOnce(Response.json({ error: 'UNAVAILABLE' }, { status: 503 })))
    await expect(listAllArticles()).rejects.toMatchObject({ status: 503 })
  })
})
