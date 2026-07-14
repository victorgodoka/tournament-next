import type { NitroAdInstance, NitroAdOptions } from './nitro-ads.types'

export const NITRO_LOADED_EVENT = 'nitroAds.loaded'
export const NITRO_AD_TIMEOUT_MS = 15_000

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(message))
    }, ms)

    promise
      .then((value) => {
        window.clearTimeout(timeoutId)
        resolve(value)
      })
      .catch((error: unknown) => {
        window.clearTimeout(timeoutId)
        reject(error)
      })
  })
}

/**
 * Waits for NitroAds when the bootstrap stub has not run yet.
 * In normal operation the layout stub defines createAd immediately and queues
 * calls until the real script loads.
 */
export function waitForNitroAds(): Promise<NonNullable<Window['nitroAds']>> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('NitroAds is only available in the browser'))
  }

  if (window.nitroAds?.createAd) {
    return Promise.resolve(window.nitroAds)
  }

  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      document.removeEventListener(NITRO_LOADED_EVENT, onLoaded)
      reject(new Error('Timed out waiting for NitroAds to load'))
    }, NITRO_AD_TIMEOUT_MS)

    const onLoaded = () => {
      window.clearTimeout(timeoutId)
      document.removeEventListener(NITRO_LOADED_EVENT, onLoaded)

      if (window.nitroAds?.createAd) {
        resolve(window.nitroAds)
        return
      }

      reject(new Error('NitroAds loaded event fired without a usable API'))
    }

    document.addEventListener(NITRO_LOADED_EVENT, onLoaded, { once: true })
  })
}

export async function createNitroPlacement(
  slotId: string,
  options: NitroAdOptions,
  timeoutMs = NITRO_AD_TIMEOUT_MS,
): Promise<NitroAdInstance | null> {
  if (typeof window === 'undefined') {
    throw new Error('NitroAds is only available in the browser')
  }

  const nitroAds = window.nitroAds?.createAd
    ? window.nitroAds
    : await waitForNitroAds()

  const ad = await withTimeout(
    Promise.resolve(nitroAds.createAd(slotId, options)),
    timeoutMs,
    `Timed out creating NitroAds placement "${slotId}"`,
  )

  return ad ?? null
}

export function removeNitroPlacement(slotId: string): void {
  const nitroAds = window.nitroAds
  nitroAds?.removeAd?.(slotId)

  const slot = document.getElementById(slotId)
  if (slot && !nitroAds?.removeAd) {
    slot.replaceChildren()
  }
}
