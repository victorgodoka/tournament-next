'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isAuthenticatedUser } from '@contexts/Auth/auth.const'
import { useAuthContext } from '@contexts/Auth/auth.context'
import * as AuthManager from '@contexts/Auth/auth.manager'
import { consumeAuthRedirectFrom } from '@contexts/Auth/auth.redirect'
import { getPlayer } from '../app/discord/discord.api'
import { completeDiscordLogin, parseOAuthCallbackFromUrl } from '@lib/discord-oauth'
import { trackLogin, trackLoginError } from '@lib/gtm'

export type DiscordLoadingState =
  | 'authenticating'
  | 'fetching-profile'
  | 'redirecting'
  | 'error'

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
        fail(callback.message)
        return
      }

      if (callback.kind === 'none') {
        // No fresh OAuth redirect to handle. A still-valid app session is
        // verified independently (via the httpOnly cookie) by
        // AuthSessionGuard on every page load, so there's nothing to resume
        // here — just send an already-authenticated visitor on their way.
        if (isAuthenticatedUser(userRef.current)) {
          router.push(redirectPath)
          return
        }
        fail('Invalid authentication parameters. Please try logging in again.', 3000)
        return
      }

      try {
        setLoadingState('authenticating')

        const loginInput =
          callback.kind === 'code'
            ? { code: callback.code }
            : { accessToken: callback.tokens.accessToken, tokenType: callback.tokens.tokenType }

        const loginResult = await completeDiscordLogin(loginInput)
        if (!loginResult.ok) {
          throw new Error(loginResult.message)
        }

        if (cancelled) return

        setLoadingState('fetching-profile')

        const playerResponse = await getPlayer(loginResult.user.id)
        if (!playerResponse.ok) {
          throw new Error(playerResponse.message || 'Failed to fetch user profile data.')
        }

        if (cancelled) return

        const profile = playerResponse.data ?? null

        dispatch({
          type: 'SET_USER',
          payload: {
            id: loginResult.user.id,
            username: loginResult.user.username,
            displayname:
              profile?.displayname || loginResult.user.global_name || loginResult.user.username,
            avatar: profile?.avatar || loginResult.user.avatar || '',
            profile: profile || undefined,
          },
        })

        trackLogin()
        setLoadingState('redirecting')
        scheduleRedirect(redirectPath, 1000)
      } catch (error) {
        if (cancelled) return

        await AuthManager.logout()
        dispatch({ type: 'LOGOUT' })
        fail(
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred during login.',
        )
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
