'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useAuthContext } from './auth.context'
import { AUTH_EXPIRED_EVENT, isAuthenticatedUser } from './auth.const'

const AuthSessionGuard = () => {
  const { logout, user } = useAuthContext()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const hasHandledRef = useRef(false)
  const currentPathRef = useRef('/')

  useEffect(() => {
    const query = searchParams.toString()
    currentPathRef.current = query ? `${pathname}?${query}` : pathname
  }, [pathname, searchParams])

  useEffect(() => {
    if (isAuthenticatedUser(user)) {
      hasHandledRef.current = false
    }
  }, [user.id])

  useEffect(() => {
    const handleExpiredToken = () => {
      if (hasHandledRef.current) return
      hasHandledRef.current = true
      logout({ from: currentPathRef.current, animate: false })
    }

    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpiredToken)

    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpiredToken)
    }
  }, [logout])

  return null
}

export default AuthSessionGuard
