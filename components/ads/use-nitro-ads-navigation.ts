'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { refreshNitroAdsOnNavigate } from '@lib/nitro-ads'

export function useNitroAdsNavigation() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const search = searchParams.toString()

  useEffect(() => {
    refreshNitroAdsOnNavigate()
  }, [pathname, search])
}
