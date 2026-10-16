// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_POOL_QUERY, type PoolQuery } from '@utils/cards'
import type { CardData } from '@utils/deck/types'
import { useCardPool } from './use-card-pool'

const queryCards = vi.hoisted(() => vi.fn())
vi.mock('@utils/cards', async (original) => ({ ...(await original<typeof import('@utils/cards')>()), queryCards }))

const card = (id: number) => ({ id, name: `c${id}` }) as CardData
const page = (ids: number[], total: number) => Promise.resolve({ cards: ids.map(card), total })

beforeEach(() => {
  vi.useFakeTimers()
  queryCards.mockReset()
})
afterEach(() => vi.useRealTimers())

const settle = () => act(async () => {})

describe('useCardPool', () => {
  it('loads page 1, appends page 2 on more(), and hands every page to onPage', async () => {
    queryCards.mockReturnValueOnce(page([1, 2], 3)).mockReturnValueOnce(page([3], 3))
    const onPage = vi.fn()
    const { result } = renderHook(() => useCardPool(EMPTY_POOL_QUERY, onPage))
    expect(result.current.loading).toBe(true)
    await settle()
    expect(result.current).toMatchObject({ total: 3, loading: false, error: false })
    act(() => result.current.more())
    await settle()
    expect(result.current.cards.map((c) => c.id)).toEqual([1, 2, 3])
    expect(queryCards.mock.calls.map((c) => c[1])).toEqual([1, 2])
    expect(onPage).toHaveBeenCalledTimes(2)
    act(() => result.current.more()) // all loaded: no third request
    expect(queryCards).toHaveBeenCalledTimes(2)
  })

  it('waits 250 ms after typing, aborting the request it replaces', async () => {
    queryCards.mockImplementation(() => new Promise(() => {}))
    const { rerender } = renderHook(({ q }) => useCardPool(q), { initialProps: { q: EMPTY_POOL_QUERY as PoolQuery } })
    const first = queryCards.mock.calls[0]![2] as AbortSignal
    rerender({ q: { ...EMPTY_POOL_QUERY, text: 'as' } })
    rerender({ q: { ...EMPTY_POOL_QUERY, text: 'ash' } })
    expect(queryCards).toHaveBeenCalledTimes(1)
    act(() => vi.advanceTimersByTime(250))
    expect(queryCards).toHaveBeenCalledTimes(2)
    expect(queryCards.mock.calls[1]![0].text).toBe('ash')
    expect(first.aborted).toBe(true)
  })

  it('starts again from page 1 when a filter changes, without waiting', async () => {
    queryCards.mockReturnValue(page([1], 9))
    const { result, rerender } = renderHook(({ q }) => useCardPool(q), { initialProps: { q: EMPTY_POOL_QUERY as PoolQuery } })
    await settle()
    act(() => result.current.more())
    await settle()
    rerender({ q: { ...EMPTY_POOL_QUERY, kind: ['spell'] } })
    expect(queryCards.mock.calls.at(-1)!.slice(0, 2)).toEqual([{ ...EMPTY_POOL_QUERY, kind: ['spell'] }, 1])
    await settle()
    expect(result.current.cards.map((c) => c.id)).toEqual([1])
  })

  it('reports a failure and retries the same page', async () => {
    queryCards.mockReturnValueOnce(Promise.reject(new Error('down'))).mockReturnValueOnce(page([1], 1))
    const { result } = renderHook(() => useCardPool(EMPTY_POOL_QUERY))
    await settle()
    expect(result.current).toMatchObject({ error: true, loading: false })
    act(() => result.current.retry())
    expect(result.current.loading).toBe(true)
    await settle()
    expect(result.current).toMatchObject({ error: false, total: 1 })
  })
})
