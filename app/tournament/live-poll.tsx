'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** The API's own advice for a running tournament: re-read it every 30 s until it finishes. */
const POLL_MS = 30_000

/** Renders nothing; the one piece of the tournament page that has to run in the browser. */
export const LivePoll = () => {
  const router = useRouter()

  useEffect(() => {
    // A hidden tab is nobody watching: polling it re-renders the route on the server for
    // no reader, and `router.refresh()` is not cacheable. Catch up on the way back instead.
    const refresh = () => document.visibilityState === 'visible' && router.refresh()
    const id = setInterval(refresh, POLL_MS)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [router])

  return null
}
