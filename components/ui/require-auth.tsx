'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@contexts/auth/auth.context'

/**
 * Members-only routes. The gate lives in the client because the session cookie is scoped to the
 * API host and SSR rarely sees it; the API still refuses anyone without a session.
 */
export const RequireAuth = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user === null) router.replace('/login')
  }, [user, router])

  return user ? children : null
}
