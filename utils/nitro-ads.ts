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

/**
 * Never empties the element itself: the `article` format targets the wiki article, and Nitro's
 * documented removal is taking the container out of the DOM, which React already does.
 */
export function removeNitroPlacement(slotId: string): void {
  window.nitroAds?.removeAd?.(slotId)
}

/**
 * Takes a site-wide placement (rail, anchor, floating, interstitial) off the screen. The live
 * script has no `removeAd`, and these formats need no element of ours: Nitro hangs its own host
 * off <body>, sometimes wrapping the slot and its close button. Removing that host is Nitro's
 * documented removal. Only for ids React never renders: on an in-content slot it would climb to
 * a page wrapper.
 */
export function removeNitroHost(slotId: string): void {
  let host = document.getElementById(slotId)
  while (host?.parentElement && host.parentElement !== document.body) host = host.parentElement
  host?.remove()
}
