'use client'

import { useEffect, useRef } from 'react'
import {
  createNitroPlacement,
  removeNitroPlacement,
} from '@lib/nitro-ads'
import type { NitroAdOptions } from '@lib/nitro-ads.types'

interface UseNitroAdOptions {
  enabled?: boolean
}

export function useNitroAd(
  slotId: string,
  options: NitroAdOptions,
  { enabled = true }: UseNitroAdOptions = {},
) {
  const createdRef = useRef(false)

  useEffect(() => {
    if (!enabled) {
      removeNitroPlacement(slotId)
      createdRef.current = false
      return
    }

    if (createdRef.current) return

    let cancelled = false

    createNitroPlacement(slotId, options)
      .then(() => {
        if (!cancelled) {
          createdRef.current = true
        }
      })
      .catch(() => {
        createdRef.current = false
      })

    return () => {
      cancelled = true
      removeNitroPlacement(slotId)
      createdRef.current = false
    }
  }, [enabled, options, slotId])
}
