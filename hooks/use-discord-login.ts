'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isAuthenticatedUser } from '@contexts/Auth/auth.const'
import { useAuthContext } from '@contexts/Auth/auth.context'
import { AuthManager } from '@contexts/Auth/auth.manager'
import { consumeAuthRedirectFrom } from '@contexts/Auth/auth.redirect'
import { getPlayer, getUser } from '../app/discord/discord.api'
import {
  cleanupOAuthParams,
  exchangeAuthorizationCode,
  getOAuthParams,
  getPersistedDiscordToken,
  hasOAuthParams,
  isDiscordTokenValid,
  parseOAuthCallbackFromUrl,
  persistDiscordToken,
} from '@lib/discord-oauth'
import { trackLogin, trackLoginError } from '@lib/gtm'

export type DiscordLoadingState =
  | 'authenticating'
  | 'fetching-profile'
  | 'generating-token'
  | 'redirecting'
  | 'error'

async function ensureAppSession(discordAccessToken: string, discordTokenType: string) {
  const jwtResponse = await AuthManager.login(discordAccessToken, discordTokenType)

  if (!jwtResponse.success) {
    throw new Error(jwtResponse.message || 'Failed to create application session.')
  }
}

export function useDiscordLogin() {
  const router = useRouter()
  const { dispatch, user } = useAuthContext()

  const [loadingState, setLoadingState] = useState<DiscordLoadingState>('authenticating')
  const [errorMessage, setErrorMessage] = useState('')

  const userRef = useRef(user)
  const loginStartedRef = useRef(false)
  const redirectPathRef = useRef('/')
  const redirectTimersRef = useRef<number[]>([])

  useEffect(() => {
    userRef.current = user
  }, [user])

  useEffect(() => {
    redirectPathRef.current = consumeAuthRedirectFrom('/')
  }, [])

  const scheduleRedirect = useCallback((path: string, delayMs: number) => {
    const timerId = window.setTimeout(() => router.push(path), delayMs)
    redirectTimersRef.current.push(timerId)
  }, [router])

  const fail = useCallback((message: string, delayMs = 5000) => {
    trackLoginError(message)
    setLoadingState('error')
    setErrorMessage(message)
    scheduleRedirect('/', delayMs)
  }, [scheduleRedirect])

  useEffect(() => {
    return () => {
      for (const timerId of redirectTimersRef.current) {
        window.clearTimeout(timerId)
      }
    }
  }, [])

  useEffect(() => {
    if (loginStartedRef.current) return

    let cancelled = false
    loginStartedRef.current = true

    const run = async () => {
      const redirectPath = redirectPathRef.current
      const callback = parseOAuthCallbackFromUrl()

      if (callback.kind === 'error') {
        cleanupOAuthParams()
        fail(callback.message)
        return
      }

      if (callback.kind === 'code') {
        setLoadingState('authenticating')
        const exchange = await exchangeAuthorizationCode(callback.code)

        if (cancelled) return

        if (!exchange.ok) {
          cleanupOAuthParams()
          fail(exchange.message)
          return
        }
      }

      const currentUser = userRef.current
      const oauthReady = hasOAuthParams()

      if (isAuthenticatedUser(currentUser) && !oauthReady) {
        try {
          const persisted = getPersistedDiscordToken()
          if (!persisted) {
            throw new Error('Your Discord session has expired. Please sign in again.')
          }

          await ensureAppSession(persisted.accessToken, persisted.tokenType)
          if (!cancelled) {
            router.push(redirectPath)
          }
        } catch (error) {
          if (cancelled) return

          await AuthManager.logout()
          dispatch({ type: 'LOGOUT' })
          fail(
            error instanceof Error
              ? error.message
              : 'Failed to restore your application session.',
          )
        }
        return
      }

      if (!oauthReady) {
        fail('Invalid authentication parameters. Please try logging in again.', 3000)
        return
      }

      const { accessToken, tokenType, expiresIn } = getOAuthParams()

      if (!accessToken || !tokenType || !expiresIn) {
        fail('Invalid authentication parameters. Please try logging in again.', 3000)
        return
      }

      const completeLogin = async () => {
        try {
          setLoadingState('authenticating')

          const discordResponse = await getUser(accessToken, tokenType)
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
          await ensureAppSession(accessToken, tokenType)

          if (cancelled) return

          persistDiscordToken({ accessToken, tokenType, expiresIn })
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

          trackLogin()
          setLoadingState('redirecting')
          scheduleRedirect(redirectPath, 1000)
        } catch (error) {
          if (cancelled) return

          cleanupOAuthParams()
          await AuthManager.logout()
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
            const persisted = getPersistedDiscordToken()
            if (!persisted) {
              throw new Error('Your Discord session has expired. Please sign in again.')
            }

            await ensureAppSession(persisted.accessToken, persisted.tokenType)
          }

          if (!cancelled) {
            router.push(redirectPath)
          }
        } catch (error) {
          if (cancelled) return

          await AuthManager.logout()
          fail(
            error instanceof Error
              ? error.message
              : 'Failed to restore your application session.',
          )
        }
      }

      if (
        isAuthenticatedUser(currentUser) &&
        oauthReady &&
        !isDiscordTokenValid()
      ) {
        await completeLogin()
        return
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
    }
  }, [dispatch, fail, router, scheduleRedirect])

  return {
    loadingState,
    errorMessage,
  }
}
