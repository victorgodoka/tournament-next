// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FLOATING_AD_OPTIONS } from '@utils/nitro-ads.const'
import * as nitroAds from '@utils/nitro-ads'
import type { NitroAdOptions } from '@utils/nitro-ads.types'
import { useNitroAd } from './use-nitro-ad'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useNitroAd', () => {
  beforeEach(() => {
    vi.spyOn(nitroAds, 'createNitroPlacement').mockResolvedValue({})
    vi.spyOn(nitroAds, 'removeNitroPlacement').mockImplementation(() => {})
  })

  async function runScheduledWork() {
    await act(async () => {
      await vi.runAllTimersAsync()
    })
  }

  it('creates a placement after idle scheduling', async () => {
    vi.useFakeTimers()

    renderHook(() => useNitroAd('slot-1', FLOATING_AD_OPTIONS))
    await runScheduledWork()

    expect(nitroAds.createNitroPlacement).toHaveBeenCalledWith(
      'slot-1',
      FLOATING_AD_OPTIONS,
    )
  })

  it('creates a placement through requestIdleCallback when available', async () => {
    const idleCallbacks: Array<() => void> = []
    const requestIdleCallback = vi
      .fn()
      .mockImplementation((callback: () => void) => {
        idleCallbacks.push(callback)
        return 1
      })
    const cancelIdleCallback = vi.fn()

    vi.stubGlobal('requestIdleCallback', requestIdleCallback)
    vi.stubGlobal('cancelIdleCallback', cancelIdleCallback)

    renderHook(() => useNitroAd('slot-1', FLOATING_AD_OPTIONS))

    expect(requestIdleCallback).toHaveBeenCalled()

    await act(async () => {
      idleCallbacks[0]?.()
      await Promise.resolve()
    })

    expect(nitroAds.createNitroPlacement).toHaveBeenCalledWith(
      'slot-1',
      FLOATING_AD_OPTIONS,
    )
  })

  it('does not create a placement when unmounted before scheduling runs', async () => {
    vi.useFakeTimers()

    const { unmount } = renderHook(() =>
      useNitroAd('slot-1', FLOATING_AD_OPTIONS),
    )

    unmount()
    await runScheduledWork()

    expect(nitroAds.createNitroPlacement).not.toHaveBeenCalled()
  })

  it('cancels requestIdleCallback work on unmount', async () => {
    const cancelIdleCallback = vi.fn()
    vi.stubGlobal(
      'requestIdleCallback',
      vi.fn().mockReturnValue(42),
    )
    vi.stubGlobal('cancelIdleCallback', cancelIdleCallback)

    const { unmount } = renderHook(() =>
      useNitroAd('slot-1', FLOATING_AD_OPTIONS),
    )

    unmount()

    expect(cancelIdleCallback).toHaveBeenCalledWith(42)
    expect(nitroAds.createNitroPlacement).not.toHaveBeenCalled()
  })

  it('removes the placement on cleanup', async () => {
    vi.useFakeTimers()

    const { unmount } = renderHook(() =>
      useNitroAd('slot-1', FLOATING_AD_OPTIONS),
    )
    await runScheduledWork()

    unmount()

    expect(nitroAds.removeNitroPlacement).toHaveBeenCalledWith('slot-1')
  })

  it('skips creation and removes the placement when disabled', async () => {
    vi.useFakeTimers()

    renderHook(() =>
      useNitroAd('slot-1', FLOATING_AD_OPTIONS, { enabled: false }),
    )
    await runScheduledWork()

    expect(nitroAds.createNitroPlacement).not.toHaveBeenCalled()
    expect(nitroAds.removeNitroPlacement).toHaveBeenCalledWith('slot-1')
  })

  it('recreates the placement when enabled toggles off and on', async () => {
    vi.useFakeTimers()

    const { rerender } = renderHook(
      ({ enabled }) =>
        useNitroAd('slot-1', FLOATING_AD_OPTIONS, { enabled }),
      { initialProps: { enabled: true } },
    )

    await runScheduledWork()
    expect(nitroAds.createNitroPlacement).toHaveBeenCalledTimes(1)

    act(() => {
      rerender({ enabled: false })
    })
    expect(nitroAds.removeNitroPlacement).toHaveBeenCalledWith('slot-1')

    act(() => {
      rerender({ enabled: true })
    })
    await runScheduledWork()
    expect(nitroAds.createNitroPlacement).toHaveBeenCalledTimes(2)
  })

  it('recreates the placement when the slot id changes', async () => {
    vi.useFakeTimers()

    const { rerender } = renderHook(
      ({ slotId }) => useNitroAd(slotId, FLOATING_AD_OPTIONS),
      { initialProps: { slotId: 'slot-1' } },
    )

    await runScheduledWork()
    expect(nitroAds.createNitroPlacement).toHaveBeenCalledWith(
      'slot-1',
      FLOATING_AD_OPTIONS,
    )

    act(() => {
      rerender({ slotId: 'slot-2' })
    })
    expect(nitroAds.removeNitroPlacement).toHaveBeenCalledWith('slot-1')

    await runScheduledWork()
    expect(nitroAds.createNitroPlacement).toHaveBeenCalledWith(
      'slot-2',
      FLOATING_AD_OPTIONS,
    )
  })

  it('recreates the placement when options change', async () => {
    vi.useFakeTimers()

    const updatedOptions = {
      ...FLOATING_AD_OPTIONS,
      report: {
        ...FLOATING_AD_OPTIONS.report,
        position: 'bottom-right' as const,
      },
    }

    const { rerender } = renderHook(
      ({ options }: { options: NitroAdOptions }) => useNitroAd('slot-1', options),
      { initialProps: { options: FLOATING_AD_OPTIONS as NitroAdOptions } },
    )

    await runScheduledWork()
    expect(nitroAds.createNitroPlacement).toHaveBeenCalledWith(
      'slot-1',
      FLOATING_AD_OPTIONS,
    )

    act(() => {
      rerender({ options: updatedOptions })
    })
    expect(nitroAds.removeNitroPlacement).toHaveBeenCalledWith('slot-1')

    await runScheduledWork()
    expect(nitroAds.createNitroPlacement).toHaveBeenCalledWith(
      'slot-1',
      updatedOptions,
    )
  })

  it('logs creation failures in development', async () => {
    vi.useFakeTimers()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubEnv('NODE_ENV', 'development')
    vi.spyOn(nitroAds, 'createNitroPlacement').mockRejectedValue(
      new Error('blocked'),
    )

    renderHook(() => useNitroAd('slot-1', FLOATING_AD_OPTIONS))
    await runScheduledWork()

    expect(warn).toHaveBeenCalledWith(
      '[NitroAds] Failed to create placement "slot-1"',
      expect.any(Error),
    )
  })

  it('removes a placement that Nitro creates after the reader left', async () => {
    vi.useFakeTimers()
    let resolve!: (ad: object) => void
    vi.spyOn(nitroAds, 'createNitroPlacement').mockReturnValue(new Promise((r) => { resolve = r }))
    const remove = vi.fn()

    const { unmount } = renderHook(() => useNitroAd('slot-1', FLOATING_AD_OPTIONS, { remove }))
    await runScheduledWork()
    unmount()
    expect(remove).toHaveBeenCalledTimes(1)

    await act(async () => resolve({}))
    expect(remove).toHaveBeenCalledTimes(2)
  })

  it('reports failed when creation rejects', async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(nitroAds, 'createNitroPlacement').mockRejectedValue(new Error('blocked'))

    const { result } = renderHook(() => useNitroAd('slot-1', FLOATING_AD_OPTIONS))
    expect(result.current.failed).toBe(false)
    await runScheduledWork()

    expect(result.current.failed).toBe(true)
  })

  it('does not log creation failures in production', async () => {
    vi.useFakeTimers()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubEnv('NODE_ENV', 'production')
    vi.spyOn(nitroAds, 'createNitroPlacement').mockRejectedValue(
      new Error('blocked'),
    )

    renderHook(() => useNitroAd('slot-1', FLOATING_AD_OPTIONS))
    await runScheduledWork()

    expect(warn).not.toHaveBeenCalled()
  })
})
