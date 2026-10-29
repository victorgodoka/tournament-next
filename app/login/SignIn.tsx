'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@ui/icon'
import { Button } from '@ui/button'
import { useAuth } from '@hooks/index'
import { signIn } from '@utils/auth'
import { useReturnTo } from '@utils/return-to'

/** After a failed attempt an older session may still be valid, so only bounce to /welcome when there is no error to show. */
export const SignIn = ({ redirectIfSignedIn }: { redirectIfSignedIn: boolean }) => {
  const { user } = useAuth()
  const router = useRouter()
  const returnTo = useReturnTo()

  useEffect(() => {
    if (user && redirectIfSignedIn) router.replace(returnTo() ?? '/welcome')
  }, [user, redirectIfSignedIn, router, returnTo])

  return (
    <div className="border-t border-line mt-8 pt-8">
      <Button variant="discord" size="lg" onClick={signIn}>
        <Icon name="discord" size={24} />
        Sign in with Discord
      </Button>
    </div>
  )
}
