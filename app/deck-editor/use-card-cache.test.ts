// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CardData } from '@utils/deck/types'
import { useCardCache } from './use-card-cache'

const cardsByIds = vi.hoisted(() => vi.fn())
vi.mock('@utils/cards', () => ({ cardsByIds }))

const card = (id: number, alternateArts: number[] = []) => ({ id, name: `c${id}`, alternateArts }) as unknown as CardData

/** A lookup the test settles by hand. */
const deferred = () => {
  let resolve!: (m: Map<number, CardData>) => void
  let reject!: (e: Error) => void
  const promise = new Promise<Map<number, CardData>>((res, rej) => ((resolve = res), (reject = rej)))
  return { promise, resolve, reject }
}

beforeEach(() => cardsByIds.mockReset())

describe('useCardCache', () => {
  it('dedupes in-flight ids, keys results under the asked passcode, and settles pending ids', async () => {
    const first = deferred()
    const second = deferred()
    cardsByIds.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { result } = renderHook(() => useCardCache())

    let a!: Promise<void>, b!: Promise<void>
    act(() => {
      a = result.current.ensure([1, 2, 2])
      b = result.current.ensure([2, 3])
    })
    expect(cardsByIds.mock.calls.map(([ids]) => ids)).toEqual([[1, 2], [3]])
    expect([1, 2, 3].map(result.current.isPending)).toEqual([true, true, true])

    const original = card(10, [2]) // passcode 2 is an alternate artwork of card 10
    await act(async () => {
      first.resolve(new Map([[1, card(1)], [2, original]]))
      second.resolve(new Map()) // 3 does not exist
      await Promise.all([a, b])
    })
    expect(result.current.cards.get(2)).toBe(original)
    expect(result.current.cards.get(1)?.id).toBe(1)
    expect([1, 2, 3].map(result.current.isPending)).toEqual([false, false, false])
    expect(result.current.cards.has(3)).toBe(false)

    // Known and known-absent ids are not asked again.
    await act(() => result.current.ensure([1, 2, 3]))
    expect(cardsByIds).toHaveBeenCalledTimes(2)
  })

  it('marks ids failed after an error and retries them on the next ensure', async () => {
    cardsByIds.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(new Map([[7, card(7)]]))
    const { result } = renderHook(() => useCardCache())

    await act(() => expect(result.current.ensure([7])).rejects.toThrow('offline'))
    expect(result.current.failed.has(7)).toBe(true)
    expect(result.current.isPending(7)).toBe(false)

    await act(() => result.current.ensure([7]))
    expect(cardsByIds).toHaveBeenCalledTimes(2)
    expect(result.current.failed.has(7)).toBe(false)
    expect(result.current.cards.get(7)?.id).toBe(7)
  })

  it('remember adds cards and gives a new map identity only when something changed', () => {
    const { result } = renderHook(() => useCardCache())
    const c = card(5)
    act(() => result.current.remember([c]))
    const before = result.current.cards
    expect(before.get(5)).toBe(c)
    act(() => result.current.remember([c]))
    expect(result.current.cards).toBe(before)
  })
})
