import type { NitroAdOptions } from './nitro-ads.types'

const NITRO_LOADED_EVENT = 'nitroAds.loaded'

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
    }, 15_000)

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
): Promise<void> {
  const nitroAds = window.nitroAds?.createAd
    ? window.nitroAds
    : await waitForNitroAds()

  await Promise.resolve(nitroAds.createAd(slotId, options))
}

export function removeNitroPlacement(slotId: string): void {
  const nitroAds = window.nitroAds
  nitroAds?.removeAd?.(slotId)

  const slot = document.getElementById(slotId)
  if (slot && !nitroAds?.removeAd) {
    slot.replaceChildren()
  }
}
