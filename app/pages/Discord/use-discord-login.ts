'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isAuthenticatedUser } from '@contexts/Auth/auth.const'
import { useAuthContext } from '@contexts/Auth/auth.context'
import { AuthManager } from '@contexts/Auth/auth.manager'
import { consumeAuthRedirectFrom } from '@contexts/Auth/auth.redirect'
import { getPlayer, getUser } from './discord.api'
import {
  cleanupOAuthParams,
  clearOAuthHashFromUrl,
  getOAuthParams,
  isDiscordTokenValid,
  persistDiscordToken,
} from './discord.oauth'

export type DiscordLoadingState =
  | 'authenticating'
  | 'fetching-profile'
  | 'generating-token'
  | 'redirecting'
  | 'error'

async function ensureAppSession(userId: string) {
  const jwtResponse = await AuthManager.login(userId)

  if (!jwtResponse.success) {
    throw new Error(jwtResponse.message || 'Failed to create application session.')
  }
}

function hasOAuthParams() {
  const { accessToken, tokenType, expiresIn } = getOAuthParams()
  return Boolean(accessToken && tokenType && expiresIn)
}

export function useDiscordLogin() {
  const router = useRouter()
  const { dispatch, user } = useAuthContext()

  const [loadingState, setLoadingState] = useState<DiscordLoadingState>('authenticating')
  const [errorMessage, setErrorMessage] = useState('')
  const [hasCheckedParams, setHasCheckedParams] = useState(false)

  const userRef = useRef(user)
  const loginStartedRef = useRef(false)
  const redirectPathRef = useRef('/')

  useEffect(() => {
    userRef.current = user
  }, [user])

  useEffect(() => {
    redirectPathRef.current = consumeAuthRedirectFrom('/')
  }, [])

  const redirectTimersRef = useRef<number[]>([])

  const scheduleRedirect = (path: string, delayMs: number) => {
    const timerId = window.setTimeout(() => router.push(path), delayMs)
    redirectTimersRef.current.push(timerId)
  }

  const fail = (message: string, delayMs = 5000) => {
    setLoadingState('error')
    setErrorMessage(message)
    scheduleRedirect('/', delayMs)
  }

  useEffect(() => {
    clearOAuthHashFromUrl()
  }, [])

  useEffect(() => {
    return () => {
      redirectTimersRef.current.forEach((timerId) => window.clearTimeout(timerId))
    }
  }, [])

  useEffect(() => {
    if (!hasCheckedParams) {
      const timerId = window.setTimeout(() => setHasCheckedParams(true), 100)
      return () => window.clearTimeout(timerId)
    }

    if (loginStartedRef.current) return

    let cancelled = false
    loginStartedRef.current = true

    const run = async () => {
      const currentUser = userRef.current
      const oauthReady = hasOAuthParams()
      const redirectPath = redirectPathRef.current

      if (isAuthenticatedUser(currentUser) && !oauthReady) {
        try {
          await ensureAppSession(currentUser.id)
          if (!cancelled) {
            router.push('/')
          }
        } catch (error) {
          if (cancelled) return

          AuthManager.logout()
          dispatch({ type: 'LOGOUT' })
          fail(
            error instanceof Error
              ? error.message
              : 'Failed to restore your application session.',
          )
        }
        return
      }

      if (isAuthenticatedUser(currentUser)) {
        return
      }

      if (!oauthReady) {
        fail('Invalid authentication parameters. Please try logging in again.', 3000)
        return
      }

      const { accessToken, tokenType, expiresIn } = getOAuthParams()

      const completeLogin = async () => {
        try {
          setLoadingState('authenticating')

          const discordResponse = await getUser(accessToken!, tokenType!)
          if (!discordResponse.ok || !discordResponse.data) {
            throw new Error(discordResponse.message || 'Failed to fetch Discord user data.')
          }

          if (cancelled) return

          const discordData = discordResponse.data

          setLoadingState('fetching-profile')

          const playerResponse = await getPlayer(discordData.id)
          if (!playerResponse.ok) {
            throw new Error(playerResponse.message || 'Failed to fetch user profile data.')
          }

          if (cancelled) return

          const profile = playerResponse.data ?? null

          setLoadingState('generating-token')
          await ensureAppSession(discordData.id)

          if (cancelled) return

          persistDiscordToken({
            accessToken: accessToken!,
            tokenType: tokenType!,
            expiresIn: expiresIn!,
          })
          cleanupOAuthParams()

          dispatch({
            type: 'SET_USER',
            payload: {
              id: discordData.id,
              username: discordData.username,
              displayname:
                profile?.displayname || discordData.global_name || discordData.username,
              avatar: profile?.avatar || discordData.avatar || '',
              profile: profile || undefined,
            },
          })

          setLoadingState('redirecting')
          scheduleRedirect(redirectPath, 1000)
        } catch (error) {
          if (cancelled) return

          cleanupOAuthParams()
          AuthManager.logout()
          fail(
            error instanceof Error
              ? error.message
              : 'An unexpected error occurred during login.',
          )
        }
      }

      const resumeExistingSession = async () => {
        try {
          const sessionUser = userRef.current

          if (isAuthenticatedUser(sessionUser)) {
            await ensureAppSession(sessionUser.id)
          }

          if (!cancelled) {
            router.push(redirectPath)
          }
        } catch (error) {
          if (cancelled) return

          AuthManager.logout()
          fail(
            error instanceof Error
              ? error.message
              : 'Failed to restore your application session.',
          )
        }
      }

      if (!isDiscordTokenValid() || !isAuthenticatedUser(currentUser)) {
        await completeLogin()
      } else {
        await resumeExistingSession()
      }
    }

    run()

    return () => {
      cancelled = true
      loginStartedRef.current = false
    }
  }, [dispatch, hasCheckedParams, router])

  return {
    loadingState,
    errorMessage,
  }
}
