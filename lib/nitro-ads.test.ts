import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FLOATING_OUTSTREAM_AD_OPTIONS } from './nitro-ads.const'
import {
  NITRO_LOADED_EVENT,
  createNitroPlacement,
  refreshNitroAdsOnNavigate,
  removeNitroPlacement,
  waitForNitroAds,
} from './nitro-ads'
import type { NitroAdInstance } from './nitro-ads.types'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('waitForNitroAds', () => {
  beforeEach(() => {
    delete window.nitroAds
  })

  it('rejects when window is unavailable', async () => {
    const originalWindow = globalThis.window

    vi.stubGlobal(
      'window',
      undefined as unknown as Window & typeof globalThis,
    )

    await expect(waitForNitroAds()).rejects.toThrow(
      'NitroAds is only available in the browser',
    )

    vi.stubGlobal('window', originalWindow)
  })

  it('resolves immediately when createAd is already available', async () => {
    const api = {
      createAd: vi.fn(),
      queue: [],
    }
    window.nitroAds = api

    await expect(waitForNitroAds()).resolves.toBe(api)
  })

  it('resolves when the loaded event fires with a usable API', async () => {
    const promise = waitForNitroAds()

    window.nitroAds = {
      createAd: vi.fn(),
      queue: [],
    }
    document.dispatchEvent(new Event(NITRO_LOADED_EVENT))

    await expect(promise).resolves.toBe(window.nitroAds)
  })

  it('rejects when the loaded event fires without createAd', async () => {
    const promise = waitForNitroAds()

    window.nitroAds = {
      queue: [],
    } as unknown as NonNullable<Window['nitroAds']>
    document.dispatchEvent(new Event(NITRO_LOADED_EVENT))

    await expect(promise).rejects.toThrow(
      'NitroAds loaded event fired without a usable API',
    )
  })

  it('rejects after the configured timeout', async () => {
    vi.useFakeTimers()

    const promise = waitForNitroAds()
    const rejection = expect(promise).rejects.toThrow(
      'Timed out waiting for NitroAds to load',
    )

    await vi.advanceTimersByTimeAsync(15_000)
    await rejection
  })
})

describe('createNitroPlacement', () => {
  beforeEach(() => {
    delete window.nitroAds
  })

  it('throws when window is unavailable', async () => {
    const originalWindow = globalThis.window

    vi.stubGlobal(
      'window',
      undefined as unknown as Window & typeof globalThis,
    )

    await expect(
      createNitroPlacement('slot-1', FLOATING_OUTSTREAM_AD_OPTIONS),
    ).rejects.toThrow('NitroAds is only available in the browser')

    vi.stubGlobal('window', originalWindow)
  })

  it('waits for NitroAds when createAd is not yet available', async () => {
    const ad: NitroAdInstance = { onNavigate: vi.fn() }
    const promise = createNitroPlacement('slot-1', FLOATING_OUTSTREAM_AD_OPTIONS)

    window.nitroAds = {
      createAd: vi.fn().mockReturnValue(ad),
      queue: [],
    }
    document.dispatchEvent(new Event(NITRO_LOADED_EVENT))

    await expect(promise).resolves.toBe(ad)
    expect(window.nitroAds.createAd).toHaveBeenCalledWith(
      'slot-1',
      FLOATING_OUTSTREAM_AD_OPTIONS,
    )
  })

  it('returns the ad instance from createAd', async () => {
    const ad: NitroAdInstance = { onNavigate: vi.fn() }
    window.nitroAds = {
      createAd: vi.fn().mockReturnValue(ad),
      queue: [],
    }

    await expect(
      createNitroPlacement('slot-1', FLOATING_OUTSTREAM_AD_OPTIONS),
    ).resolves.toBe(ad)
  })

  it('returns null when createAd resolves to null', async () => {
    window.nitroAds = {
      createAd: vi.fn().mockResolvedValue(null),
      queue: [],
    }

    await expect(
      createNitroPlacement('slot-1', FLOATING_OUTSTREAM_AD_OPTIONS),
    ).resolves.toBeNull()
  })

  it('rejects when createAd never settles', async () => {
    vi.useFakeTimers()

    window.nitroAds = {
      createAd: vi.fn().mockReturnValue(new Promise(() => {})),
      queue: [],
    }

    const promise = createNitroPlacement(
      'slot-1',
      FLOATING_OUTSTREAM_AD_OPTIONS,
      1_000,
    )

    const rejection = expect(promise).rejects.toThrow(
      'Timed out creating NitroAds placement "slot-1"',
    )

    await vi.advanceTimersByTimeAsync(1_000)
    await rejection
  })
})

describe('removeNitroPlacement', () => {
  beforeEach(() => {
    delete window.nitroAds
    document.body.replaceChildren()
  })

  it('calls removeAd when the API provides it', () => {
    const removeAd = vi.fn()
    window.nitroAds = {
      createAd: vi.fn(),
      removeAd,
      queue: [],
    }

    removeNitroPlacement('slot-1')

    expect(removeAd).toHaveBeenCalledWith('slot-1')
  })

  it('clears slot children when removeAd is unavailable', () => {
    const slot = document.createElement('aside')
    slot.id = 'slot-1'
    slot.append(document.createElement('div'))
    document.body.append(slot)

    removeNitroPlacement('slot-1')

    expect(slot.childElementCount).toBe(0)
  })
})

describe('refreshNitroAdsOnNavigate', () => {
  beforeEach(() => {
    delete window.nitroAds
  })

  it('calls the global onNavigate handler when available', () => {
    const onNavigate = vi.fn()
    window.nitroAds = {
      createAd: vi.fn(),
      onNavigate,
      queue: [],
    }

    refreshNitroAdsOnNavigate('/next-page')

    expect(onNavigate).toHaveBeenCalledWith('/next-page')
  })

  it('does not call onNavigate when the handler is unavailable', () => {
    const onNavigate = vi.fn()
    window.nitroAds = {
      createAd: vi.fn(),
      queue: [],
    }

    refreshNitroAdsOnNavigate()

    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('returns without throwing when window is unavailable', () => {
    const originalWindow = globalThis.window

    vi.stubGlobal(
      'window',
      undefined as unknown as Window & typeof globalThis,
    )

    expect(() => refreshNitroAdsOnNavigate()).not.toThrow()

    vi.stubGlobal('window', originalWindow)
  })
})
