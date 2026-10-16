'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useAuth } from '@hooks/index'
import { useReturnTo } from '@utils/return-to'

/**
 * The Discord callback always lands here. A page that sent the user to sign in (the deck editor's
 * Save) left its path behind: once signed in, go back to it. Signed out, the path stays for later.
 */
export const ReturnAfterSignIn = () => {
  const { user } = useAuth()
  const router = useRouter()
  const returnTo = useReturnTo()

  useEffect(() => {
    if (!user) return
    const path = returnTo()
    if (path) router.replace(path)
  }, [user, router, returnTo])

  return null
}
