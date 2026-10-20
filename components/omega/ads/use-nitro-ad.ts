'use client'

import { useEffect, useRef, useState } from 'react'
import {
  createNitroPlacement,
  removeNitroPlacement,
} from '@utils/nitro-ads'
import type { NitroAdInstance, NitroAdOptions } from '@utils/nitro-ads.types'

interface UseNitroAdOptions {
  enabled?: boolean
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
  options: NitroAdOptions,
  { enabled = true }: UseNitroAdOptions = {},
) {
  const adInstanceRef = useRef<NitroAdInstance | null>(null)
  // Blocked script or timeout: the caller can show something in the empty slot.
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!enabled) {
      removeNitroPlacement(slotId)
      adInstanceRef.current = null
      return
    }

    let cancelled = false
    const cancelIdle = scheduleIdleWork(() => {
      if (cancelled) return

      setFailed(false)
      createNitroPlacement(slotId, options)
        .then((ad) => {
          if (!cancelled) {
            adInstanceRef.current = ad
          }
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
      removeNitroPlacement(slotId)
      adInstanceRef.current = null
    }
  }, [enabled, options, slotId])

  return { failed }
}
