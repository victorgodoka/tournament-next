'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Avatar, Breadcrumbs, Button, Chip, SideNav, type SideNavGroup } from '@ui/index'
import { useAuth, useResource } from '@hooks/index'
import { can } from '@utils/articles'
import { signIn } from '@utils/auth'
import { listTournaments } from '@utils/panel'
import { ANALYTICS_ENABLED, BATTLEPASS_ENABLED, SHOP_ENABLED } from '@utils/const'

type NavItem = { href: string; label: string }

const NAV: { label: string; items: NavItem[] }[] = [
  { label: 'Schedule', items: [{ href: '/admin/tournaments', label: 'Tournaments' }, { href: '/admin/formats', label: 'Formats' }] },
  {
    label: 'Economy',
    items: [
      ...(SHOP_ENABLED ? [{ href: '/admin/shop', label: 'Shop catalog' }] : []),
      { href: '/admin/rewards', label: 'Rewards' },
      ...(BATTLEPASS_ENABLED ? [{ href: '/admin/battlepass', label: 'Battlepass' }] : []),
    ],
  },
  ...(ANALYTICS_ENABLED
    ? [{
        label: 'Analytics',
        items: [
          { href: '/admin/analytics/sweep', label: 'Season sweep' },
          { href: '/admin/analytics/explorations', label: 'Explorations' },
          { href: '/admin/analytics/periods', label: 'Periods' },
        ],
      }]
    : []),
  {
    label: 'Cards',
    items: [
      { href: '/admin/cards/categories', label: 'Card categories' },
      { href: '/admin/cards/series', label: 'Series' },
      { href: '/admin/cards/ignored', label: 'Ignored archetypes' },
    ],
  },
  {
    label: 'Staff',
    items: [
      { href: '/admin/staff#settings', label: 'Settings' },
      { href: '/admin/staff#analysts', label: 'Analysts' },
      { href: '/admin/activity', label: 'Activity log' },
    ],
  },
  {
    label: 'Other tools',
    items: [
      { href: '/admin/tools', label: 'Ranked ops' },
      { href: '/admin/staff#editors', label: 'Wiki editors' },
      { href: '/admin/tools#wallet', label: 'Wallet credit' },
    ],
  },
]

/** Last crumb for the screens under a nav item. */
const SUB: Record<string, string> = { new: 'New', player: 'Duelist', types: 'Types & categories', prices: 'Base prices' }

const pathOf = (href: string) => href.split('#')[0]!

/** The nav item a path lives under: the longest matching prefix, first of equals (hash links share a path). */
const locate = (pathname: string) => {
  let best: { group: string; item: NavItem } | null = null
  for (const group of NAV) {
    for (const item of group.items) {
      const path = pathOf(item.href)
      if ((pathname === path || pathname.startsWith(`${path}/`)) && (!best || path.length > pathOf(best.item.href).length)) {
        best = { group: group.label, item }
      }
    }
  }
  return best
}

const Locked = ({ title, blurb, action }: { title: string; blurb: string; action?: React.ReactNode }) => (
  <main className="grid min-h-dvh place-items-center px-gutter">
    <div className="cut notch flex max-w-140 flex-col items-center gap-4 p-7 text-center [--cut:var(--cut-lg)] lg:p-11">
      <h1 className="text-ink display-2">{title}</h1>
      <p className="text-ink-dim body">{blurb}</p>
      {action}
    </div>
  </main>
)

export const AdminShell = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname()
  const { user } = useAuth()
  const admin = can(user, 'system.manage')
  const upcoming = useResource(admin ? 'upcoming' : null, (signal) => listTournaments({ upcoming: true, limit: 200 }, signal))

  if (user === undefined) return <Locked title="Checking your session" blurb="One moment." />
  if (!user) {
    return (
      <Locked
        title="Sign in first"
        blurb="The panel reads and writes as you. Sign in with the Discord account that carries the admin role."
        action={<Button onClick={signIn}>Sign in</Button>}
      />
    )
  }
  if (!admin) {
    return (
      <Locked
        title="Not your door"
        blurb="Everything in the panel needs system.manage, which only admins have."
        action={<Button href="/" variant="secondary">Back home</Button>}
      />
    )
  }

  const here = locate(pathname)
  const groups: SideNavGroup[] = NAV.map((group) => ({
    label: group.label,
    items: group.items.map((item) => ({
      ...item,
      current: here?.item === item,
      count: item.href === '/admin/tournaments' ? upcoming.data?.length : undefined,
    })),
  }))

  const rest = here ? pathname.slice(pathOf(here.item.href).length).split('/').filter(Boolean) : []
  const last = rest.at(-1)
  const crumbs = [
    { label: 'Panel', href: '/admin' },
    ...(here ? [{ label: here.group }, { label: here.item.label, href: pathOf(here.item.href) }] : []),
    ...(last ? [{ label: SUB[last] ?? (/^\d+$/.test(last) ? `#${last}` : decodeURIComponent(last)) }] : []),
  ]
  const name = user.profile.username ?? user.id

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <SideNav
        label="Panel"
        groups={groups}
        brand={
          <>
            <span className="text-ink brandmark text-sm">Omega Hub</span>
            <Chip tone="gold">Panel</Chip>
          </>
        }
        footer={
          <>
            <Avatar name={name} src={user.profile.avatarUrl} cosmetics={user.cosmetics} className="size-9 text-lg" />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-sm font-bold text-ink">{name}</span>
              <span className="text-ink-muted signal-sm">Admin · system.manage</span>
            </span>
          </>
        }
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-h-16 shrink-0 flex-wrap items-center gap-4 border-b border-line px-gutter py-3">
          <Breadcrumbs items={crumbs} className="flex-1" />
          {here?.item.href === '/admin/activity' ? null : (
            <span className="flex items-center gap-4">
              <span className="text-ink-muted signal-sm">Every change is logged</span>
              <Link href="/admin/activity" className="signal-strong">Activity log</Link>
            </span>
          )}
        </div>
        <main className="flex flex-col gap-8 px-gutter py-10">{children}</main>
      </div>
    </div>
  )
}
