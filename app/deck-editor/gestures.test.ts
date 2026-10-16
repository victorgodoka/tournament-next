// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LONG_PRESS_MS, swipeCommits, swipeTravel, trayAfterDrag, useLongPress } from './gestures'

const pointer = (pointerType: string, clientX = 0, clientY = 0) => ({ pointerType, clientX, clientY }) as React.PointerEvent
const click = (detail = 1) => ({ type: 'click', detail }) as React.MouseEvent

describe('swipe', () => {
  it('follows leftward travel only while horizontal movement dominates', () => {
    expect(swipeTravel(-30, 5)).toBe(-30)
    expect(swipeTravel(30, 5)).toBe(0)
    expect(swipeTravel(-30, 40)).toBe(0)
  })

  it('commits past 64 px', () => {
    expect(swipeCommits(-64, 0)).toBe(false)
    expect(swipeCommits(-65, 10)).toBe(true)
    expect(swipeCommits(-80, 90)).toBe(false) // a scroll that drifted left
  })
})

describe('trayAfterDrag', () => {
  it('opens past 48 px up and closes past 48 px down', () => {
    expect(trayAfterDrag(false, -49)).toBe(true)
    expect(trayAfterDrag(true, 49)).toBe(false)
  })

  it('stays put on a short drag', () => {
    expect(trayAfterDrag(false, -40)).toBe(false)
    expect(trayAfterDrag(true, 40)).toBe(true)
    expect(trayAfterDrag(true, -100)).toBe(true)
  })
})

describe('useLongPress', () => {
  const vibrate = vi.fn()
  beforeEach(() => {
    vi.useFakeTimers()
    vibrate.mockReset()
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true })
  })
  afterEach(() => vi.useRealTimers())

  it('fires after 450 ms held, ticks, and marks the click that follows as handled', () => {
    const onLong = vi.fn()
    const { result } = renderHook(() => useLongPress())
    act(() => result.current.bind(onLong).onPointerDown(pointer('touch')))
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS - 1))
    expect(onLong).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(onLong).toHaveBeenCalledOnce()
    expect(vibrate).toHaveBeenCalledWith(10)
    expect(result.current.kind(click())).toBe('long')
  })

  it('a release before 450 ms is a tap', () => {
    const onLong = vi.fn()
    const { result } = renderHook(() => useLongPress())
    const handlers = result.current.bind(onLong)
    act(() => handlers.onPointerDown(pointer('pen')))
    act(() => handlers.onPointerUp())
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS))
    expect(onLong).not.toHaveBeenCalled()
    expect(result.current.kind(click())).toBe('tap')
  })

  it('moving more than 10 px cancels; 10 px does not', () => {
    const onLong = vi.fn()
    const { result } = renderHook(() => useLongPress())
    const handlers = result.current.bind(onLong)
    act(() => handlers.onPointerDown(pointer('touch', 100, 100)))
    act(() => handlers.onPointerMove(pointer('touch', 106, 108))) // exactly 10 px
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS))
    expect(onLong).toHaveBeenCalledOnce()

    act(() => handlers.onPointerDown(pointer('touch', 100, 100)))
    act(() => handlers.onPointerMove(pointer('touch', 100, 111)))
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS))
    expect(onLong).toHaveBeenCalledOnce()
  })

  it('leaves mouse and keyboard clicks alone', () => {
    const onLong = vi.fn()
    const { result } = renderHook(() => useLongPress())
    act(() => result.current.bind(onLong).onPointerDown(pointer('mouse')))
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS))
    expect(onLong).not.toHaveBeenCalled()
    expect(result.current.kind(click())).toBe('click')

    act(() => result.current.bind(onLong).onPointerDown(pointer('touch')))
    expect(result.current.kind(click(0))).toBe('click') // Space on a focused tile
  })

  it('clears a pending press on unmount', () => {
    const onLong = vi.fn()
    const { result, unmount } = renderHook(() => useLongPress())
    act(() => result.current.bind(onLong).onPointerDown(pointer('touch')))
    unmount()
    vi.advanceTimersByTime(LONG_PRESS_MS)
    expect(onLong).not.toHaveBeenCalled()
  })
})
