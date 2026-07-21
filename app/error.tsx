'use client'

import { useEffect } from 'react'
import ErrorPageComponent from '@components/error-page/error-page.component'

/** Route-level error boundary — an unexpected render/data throw gets the
 * styled error surface with a retry instead of Next's unstyled default. */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[RouteError]', error)
  }, [error])

  return <ErrorPageComponent onRetry={reset} />
}
