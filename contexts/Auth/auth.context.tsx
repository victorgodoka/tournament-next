'use client'

import {
  createContext,
  type Dispatch,
  useContext,
  type FC,
  type ReactNode,
  useReducer,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from 'react'
import { useRouter } from 'next/navigation'
import {
  createGuestUser,
  isAuthenticatedUser,
  isValidStoredUser,
  LOGOUT_ANIMATION_MS,
} from './auth.const'
import { authReducer } from './auth.reducer'
import { trackLogout } from '@lib/gtm'
import * as AuthManager from './auth.manager'
import { setAuthRedirectFrom } from './auth.redirect'
import type { LogoutOptions, User, UserActions } from './auth.types'

export const AuthContext = createContext<{
  user: User
  isLoading: boolean
  isLoggingOut: boolean
  justLoggedOut: boolean
  error: string | null
  clearError: () => void
  logout: (options?: LogoutOptions) => void
  dispatch: Dispatch<UserActions>
} | null>(null)

export const useAuthContext = () => {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuthContext must be used inside the AuthProvider')
  }

  return context
}

const readStoredUser = (): User | null => {
  try {
    const storedUser = localStorage.getItem('user')
    if (!storedUser) return null

    const parsed: unknown = JSON.parse(storedUser)
    return isValidStoredUser(parsed) ? parsed : null
  } catch {
    return null
  }
}

export const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [justLoggedOut, setJustLoggedOut] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const logoutTimerRef = useRef<number | null>(null)
  const enterTimerRef = useRef<number | null>(null)

  const [user, dispatch] = useReducer(authReducer, createGuestUser())

  const clearLogoutTimer = useCallback(() => {
    if (logoutTimerRef.current !== null) {
      window.clearTimeout(logoutTimerRef.current)
      logoutTimerRef.current = null
    }
  }, [])

  const finishLogout = useCallback((options?: LogoutOptions) => {
    trackLogout()
    dispatch({ type: 'LOGOUT' })
    AuthManager.logout()
    localStorage.removeItem('user')
    setIsLoggingOut(false)
    setJustLoggedOut(true)

    if (options?.from) {
      setAuthRedirectFrom(options.from)
    }

    router.replace('/')

    if (enterTimerRef.current !== null) {
      window.clearTimeout(enterTimerRef.current)
    }

    enterTimerRef.current = window.setTimeout(() => {
      setJustLoggedOut(false)
      enterTimerRef.current = null
    }, LOGOUT_ANIMATION_MS)
  }, [router])

  const logout = useCallback((options?: LogoutOptions) => {
    if (isLoggingOut) return

    clearLogoutTimer()

    if (options?.animate === false) {
      finishLogout(options)
      return
    }

    setIsLoggingOut(true)

    logoutTimerRef.current = window.setTimeout(() => {
      logoutTimerRef.current = null
      finishLogout(options)
    }, LOGOUT_ANIMATION_MS)
  }, [clearLogoutTimer, finishLogout, isLoggingOut])

  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      try {
        const stored = readStoredUser()
        let activeUser = createGuestUser()

        if (stored) {
          dispatch({ type: 'SET_USER', payload: stored })
          activeUser = stored
        }

        if (!isAuthenticatedUser(activeUser)) {
          return
        }

        await AuthManager.verifyToken()
      } catch {
        if (!cancelled) {
          setError('Failed to restore your session.')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    bootstrap()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (isLoading) return

    try {
      if (!isAuthenticatedUser(user)) {
        localStorage.removeItem('user')
      } else {
        localStorage.setItem('user', JSON.stringify(user))
      }
    } catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- surfacing a failure of the external write this effect performs
      setError('Failed to save user data.')
    }
  }, [user, isLoading])

  useEffect(() => {
    return () => {
      clearLogoutTimer()
      if (enterTimerRef.current !== null) {
        window.clearTimeout(enterTimerRef.current)
      }
    }
  }, [clearLogoutTimer])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const contextValue = useMemo(
    () => ({
      user,
      isLoading,
      isLoggingOut,
      justLoggedOut,
      error,
      clearError,
      dispatch,
      logout,
    }),
    [user, isLoading, isLoggingOut, justLoggedOut, error, clearError, logout],
  )

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}
