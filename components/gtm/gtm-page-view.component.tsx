'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { trackPageView } from '@lib/gtm'

export function GtmPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    const query = searchParams.toString()
    const path = query ? `${pathname}?${query}` : pathname
    trackPageView(path)
  }, [pathname, searchParams])

  return null
}
