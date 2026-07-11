import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'
import { useAuthContext } from './auth.context'
import { AUTH_EXPIRED_EVENT, isAuthenticatedUser } from './auth.const'

const AuthSessionGuard = () => {
  const { logout, user } = useAuthContext()
  const location = useLocation()
  const hasHandledRef = useRef(false)
  const locationRef = useRef(location)

  useEffect(() => {
    locationRef.current = location
  }, [location])

  useEffect(() => {
    if (isAuthenticatedUser(user)) {
      hasHandledRef.current = false
    }
  }, [user.id])

  useEffect(() => {
    const handleExpiredToken = () => {
      if (hasHandledRef.current) return
      hasHandledRef.current = true

      const current = locationRef.current
      const currentPath = current.pathname + current.search + current.hash
      logout({ from: currentPath, animate: false })
    }

    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpiredToken)

    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpiredToken)
    }
  }, [logout])

  return null
}

export default AuthSessionGuard
