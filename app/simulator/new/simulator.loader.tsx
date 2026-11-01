'use client'

import dynamic from 'next/dynamic'
import { Locked } from '@app/admin/AdminShell'
import { useAuth } from '@contexts/auth/auth.context'
import { Button } from '@ui/button'
import { can } from '@utils/articles'
import { signIn } from '@utils/auth'

// Client only: it boots from `?d=` and the local draft, which the server can't see.
const Simulator = dynamic(() => import('./simulator.client'), { ssr: false, loading: () => <Locked title="Setting the table" blurb="One moment." /> })

/** Admins only for now. The gate is in the client, as the panel's: the session cookie does not always reach this server. It shuts the page, not the code: Next lists the chunk for everyone. */
export const SimulatorLoader = () => {
  const { user } = useAuth()
  if (user === undefined) return <Locked title="Checking your session" blurb="One moment." />
  if (!user) {
    return <Locked title="Sign in first" blurb="This page is open to admins. Sign in with the Discord account that carries the admin role." action={<Button onClick={signIn}>Sign in</Button>} />
  }
  if (!can(user, 'system.manage')) {
    return <Locked title="Not your door" blurb="This page needs system.manage, which only admins have." action={<Button href="/simulator" variant="secondary">Open the Combo Simulator</Button>} />
  }
  return (
    <main className="min-h-dvh overflow-x-clip">
      <Simulator />
    </main>
  )
}
