'use client'

import { useState } from 'react'
import { Button, Eyebrow, TabBar, tabPanelProps } from '@ui/index'
import { useAuth } from '@hooks/index'
import { can } from '@utils/articles'
import { signIn } from '@utils/auth'
import type { Banlist } from '@utils/wiki'
import { FormatsPanel } from './FormatsPanel'
import { OpsPanel } from './OpsPanel'
import { ShopPanel } from './ShopPanel'
import { StaffPanel } from './StaffPanel'
import { TournamentsPanel } from './TournamentsPanel'

type TabId = 'tournaments' | 'formats' | 'shop' | 'ops' | 'staff'

/** A locked door, said plainly. The API refuses these routes anyway; this only saves the round trip. */
const Locked = ({ title, blurb, action }: { title: string; blurb: string; action?: React.ReactNode }) => (
  <div className="mx-auto w-full max-w-[560px] border border-line-strong bg-surface-100 p-7 text-center lg:p-11">
    <h2 className="text-ink display-4">{title}</h2>
    <p className="mt-3 text-ink-dim body-sm">{blurb}</p>
    {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
  </div>
)

export const AdminPanel = ({ banlists }: { banlists: Banlist[] }) => {
  const { user } = useAuth()
  const [active, setActive] = useState<TabId>('tournaments')

  const admin = can(user, 'system.manage')
  const staff = can(user, 'user.manage')

  if (user === undefined) {
    return (
      <div className="mx-auto w-full max-w-page px-gutter py-section">
        <Locked title="Checking your session" blurb="One moment." />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-page px-gutter py-section">
        <Locked
          title="Sign in first"
          blurb="The panel reads and writes as you. Sign in with the Discord account that carries the admin role."
          action={
            <Button size="sm" onClick={signIn}>
              Sign in
            </Button>
          }
        />
      </div>
    )
  }

  if (!admin && !staff) {
    return (
      <div className="mx-auto w-full max-w-page px-gutter py-section">
        <Locked
          title="Not your door"
          blurb="This account has no panel permission. Everything under /panel needs system.manage; the wiki staff list needs user.manage."
          action={
            <Button href="/" variant="secondary" size="sm">
              Back home
            </Button>
          }
        />
      </div>
    )
  }

  const tabs = [
    ...(admin
      ? ([
          { id: 'tournaments', label: 'Tournaments' },
          { id: 'formats', label: 'Formats' },
          { id: 'shop', label: 'Shop' },
          { id: 'ops', label: 'Ranked ops' },
        ] as const)
      : []),
    ...(staff ? ([{ id: 'staff', label: 'Wiki staff' }] as const) : []),
  ]

  // An account with only `user.manage` lands on the one tab it can use.
  const current = tabs.some((tab) => tab.id === active) ? active : (tabs[0]?.id ?? 'staff')

  return (
    <div className="mx-auto w-full max-w-page px-gutter py-section">
      <Eyebrow meta={user.profile.username ?? user.id}>Admin panel</Eyebrow>
      <h1 className="mt-5 text-ink display-1">Control room</h1>
      <p className="mt-4 max-w-[62ch] text-ink-dim lead">
        The panel only controls what the panel created. Schedules and formats are ours and fully editable; the tournament
        that actually ran lives in the game server and is read-only here — it can only be found and linked.
      </p>

      <div className="mt-9 border border-line-strong bg-surface-000">
        <TabBar tabs={tabs} active={current} onSelect={setActive} label="Panel sections" idPrefix="admin" />

        <div {...tabPanelProps('admin', current)}>
          {current === 'tournaments' ? <TournamentsPanel banlists={banlists} /> : null}
          {current === 'formats' ? <FormatsPanel banlists={banlists} /> : null}
          {current === 'shop' ? <ShopPanel /> : null}
          {current === 'ops' ? <OpsPanel /> : null}
          {current === 'staff' ? <StaffPanel /> : null}
        </div>
      </div>
    </div>
  )
}
