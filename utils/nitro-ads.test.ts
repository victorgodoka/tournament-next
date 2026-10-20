// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FLOATING_AD_OPTIONS } from './nitro-ads.const'
import {
  NITRO_LOADED_EVENT,
  createNitroPlacement,
  removeNitroHost,
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
      createNitroPlacement('slot-1', FLOATING_AD_OPTIONS),
    ).rejects.toThrow('NitroAds is only available in the browser')

    vi.stubGlobal('window', originalWindow)
  })

  it('waits for NitroAds when createAd is not yet available', async () => {
    const ad: NitroAdInstance = { onNavigate: vi.fn() }
    const promise = createNitroPlacement('slot-1', FLOATING_AD_OPTIONS)

    window.nitroAds = {
      createAd: vi.fn().mockReturnValue(ad),
      queue: [],
    }
    document.dispatchEvent(new Event(NITRO_LOADED_EVENT))

    await expect(promise).resolves.toBe(ad)
    expect(window.nitroAds.createAd).toHaveBeenCalledWith(
      'slot-1',
      FLOATING_AD_OPTIONS,
    )
  })

  it('returns the ad instance from createAd', async () => {
    const ad: NitroAdInstance = { onNavigate: vi.fn() }
    window.nitroAds = {
      createAd: vi.fn().mockReturnValue(ad),
      queue: [],
    }

    await expect(
      createNitroPlacement('slot-1', FLOATING_AD_OPTIONS),
    ).resolves.toBe(ad)
  })

  it('returns null when createAd resolves to null', async () => {
    window.nitroAds = {
      createAd: vi.fn().mockResolvedValue(null),
      queue: [],
    }

    await expect(
      createNitroPlacement('slot-1', FLOATING_AD_OPTIONS),
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
      FLOATING_AD_OPTIONS,
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

  it('never empties the element when removeAd is missing', () => {
    // The article format targets the wiki article itself: an emptying fallback would wipe it.
    const slot = document.createElement('div')
    slot.id = 'slot-1'
    slot.innerHTML = '<p>body</p>'
    document.body.append(slot)
    window.nitroAds = { createAd: vi.fn(), queue: [] }

    removeNitroPlacement('slot-1')

    expect(slot.querySelector('p')).toBeTruthy()
  })
})

describe('removeNitroHost', () => {
  beforeEach(() => {
    document.body.replaceChildren()
  })

  it('removes the wrapper Nitro hangs off body around a rail and its close button', () => {
    const wrapper = document.createElement('div')
    wrapper.innerHTML = '<div id="slot-1"></div><div id="slot-1-close"></div>'
    document.body.append(document.createElement('main'), wrapper)

    removeNitroHost('slot-1')

    expect(wrapper.isConnected).toBe(false)
    expect(document.querySelector('main')).toBeTruthy()
  })

  it('removes a slot Nitro put straight on body', () => {
    const anchor = document.createElement('div')
    anchor.id = 'slot-1'
    document.body.append(anchor)

    removeNitroHost('slot-1')

    expect(anchor.isConnected).toBe(false)
  })

  it('does nothing when Nitro never created the slot', () => {
    document.body.append(document.createElement('main'))

    removeNitroHost('slot-1')

    expect(document.body.childElementCount).toBe(1)
  })
})
