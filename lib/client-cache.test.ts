import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cached, clearCache, FIVE_MINUTES, invalidate } from './client-cache'

describe('client-cache', () => {
  beforeEach(() => {
    clearCache()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('caches a resolved value and does not call the fetcher again within the TTL', async () => {
    const fetcher = vi.fn().mockResolvedValue('value')

    expect(await cached('k', fetcher)).toBe('value')
    expect(await cached('k', fetcher)).toBe('value')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('re-fetches after the TTL expires', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second')

    expect(await cached('k', fetcher, { ttlMs: FIVE_MINUTES })).toBe('first')
    vi.advanceTimersByTime(FIVE_MINUTES + 1)
    expect(await cached('k', fetcher, { ttlMs: FIVE_MINUTES })).toBe('second')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('never expires a permanent entry', async () => {
    const fetcher = vi.fn().mockResolvedValue('value')

    await cached('k', fetcher, { permanent: true })
    vi.advanceTimersByTime(FIVE_MINUTES * 1000)
    await cached('k', fetcher, { permanent: true })

    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('de-duplicates concurrent calls into one in-flight fetch', async () => {
    const fetcher = vi.fn().mockResolvedValue('value')

    const [a, b] = await Promise.all([cached('k', fetcher), cached('k', fetcher)])

    expect(a).toBe('value')
    expect(b).toBe('value')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('does not cache a rejected fetch', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce('recovered')

    await expect(cached('k', fetcher)).rejects.toThrow('boom')
    expect(await cached('k', fetcher)).toBe('recovered')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('clears entries by prefix', async () => {
    const deck = vi.fn().mockResolvedValue('deck')
    const card = vi.fn().mockResolvedValue('card')

    await cached('deck:1', deck)
    await cached('card:1', card)
    clearCache('deck:')

    await cached('deck:1', deck)
    await cached('card:1', card)

    expect(deck).toHaveBeenCalledTimes(2)
    expect(card).toHaveBeenCalledTimes(1)
  })

  it('invalidates a single key', async () => {
    const fetcher = vi.fn().mockResolvedValue('value')

    await cached('k', fetcher)
    invalidate('k')
    await cached('k', fetcher)

    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
