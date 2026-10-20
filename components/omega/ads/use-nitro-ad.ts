'use client'

import { useEffect, useRef, useState } from 'react'
import {
  createNitroPlacement,
  removeNitroPlacement,
} from '@utils/nitro-ads'
import type { NitroAdInstance, NitroAdOptions } from '@utils/nitro-ads.types'

interface UseNitroAdOptions {
  enabled?: boolean
  /** How the placement leaves the screen. Site-wide formats pass `removeNitroHost`. */
  remove?: (slotId: string) => void
}

function scheduleIdleWork(work: () => void): () => void {
  if (typeof window.requestIdleCallback === 'function') {
    const idleId = window.requestIdleCallback(work, { timeout: 2_000 })
    return () => window.cancelIdleCallback(idleId)
  }

  const timeoutId = window.setTimeout(work, 0)
  return () => window.clearTimeout(timeoutId)
}

export function useNitroAd(
  slotId: string,
  /** A function is read when the slot asks, once it is laid out; `null` skips the slot. */
  options: NitroAdOptions | (() => NitroAdOptions | null),
  { enabled = true, remove = removeNitroPlacement }: UseNitroAdOptions = {},
) {
  const adInstanceRef = useRef<NitroAdInstance | null>(null)
  // Blocked script or timeout: the caller can show something in the empty slot.
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!enabled) {
      remove(slotId)
      adInstanceRef.current = null
      return
    }

    let cancelled = false
    const cancelIdle = scheduleIdleWork(() => {
      if (cancelled) return
      const resolved = typeof options === 'function' ? options() : options
      if (!resolved) return

      setFailed(false)
      createNitroPlacement(slotId, resolved)
        .then((ad) => {
          // Calls queued before the script loaded resolve late: the reader may be gone by then.
          if (cancelled) remove(slotId)
          else adInstanceRef.current = ad
        })
        .catch((error: unknown) => {
          adInstanceRef.current = null
          if (!cancelled) setFailed(true)
          if (process.env.NODE_ENV !== 'production') {
            console.warn(
              `[NitroAds] Failed to create placement "${slotId}"`,
              error,
            )
          }
        })
    })

    return () => {
      cancelled = true
      cancelIdle()
      remove(slotId)
      adInstanceRef.current = null
    }
  }, [enabled, options, remove, slotId])

  return { failed }
}
