'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@iconify/react'
import { Button } from '@ui/button'
import { useAuth } from '@hooks/index'
import { takeReturnTo } from '@app/deck-editor/drafts'
import { signIn } from '@utils/auth'

/** After a failed attempt an older session may still be valid, so only bounce to /welcome when there is no error to show. */
export const SignIn = ({ redirectIfSignedIn }: { redirectIfSignedIn: boolean }) => {
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user && redirectIfSignedIn) router.replace(takeReturnTo() ?? '/welcome')
  }, [user, redirectIfSignedIn, router])

  return (
    <div className="border-t border-line mt-8 pt-8">
      <Button variant="discord" size="lg" onClick={signIn}>
        <Icon aria-hidden className="text-2xl" icon="bi:discord" />
        Sign in with Discord
      </Button>
    </div>
  )
}
