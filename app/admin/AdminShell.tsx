'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Avatar } from '@ui/avatar'
import { Button } from '@ui/button'
import { Chip } from '@ui/chip'
import { Icon } from '@ui/icon'
import { useAuth } from '@contexts/auth/auth.context'
import { useResource } from '@hooks/index'
import { can } from '@utils/articles'
import { signIn } from '@utils/auth'
import { getReviewCount, listTournaments } from '@utils/panel'
import { readPanelReturn } from '@utils/panel-return'
import { ToastHost } from './shared'
import './admin.css'

type NavItem = { href: string; label: string; count?: 'review' | 'upcoming' }

const NAV: { label: string; items: NavItem[] }[] = [
  { label: '', items: [{ href: '/admin', label: 'Overview' }] },
  {
    label: 'Decks',
    items: [
      { href: '/admin/decks', label: 'Identified decks', count: 'review' },
      { href: '/admin/series', label: 'Series' },
      { href: '/admin/filters', label: 'Filters' },
      { href: '/admin/staples', label: 'Staples' },
    ],
  },
  { label: 'Tournaments', items: [{ href: '/admin/tournaments', label: 'Schedule', count: 'upcoming' }, { href: '/admin/formats', label: 'Formats' }] },
  { label: 'Ranked', items: [{ href: '/admin/statistics/sweep', label: 'Statistics job' }, { href: '/admin/seasons', label: 'Seasons' }] },
  { label: 'People', items: [{ href: '/admin/access', label: 'Access' }, { href: '/admin/api-keys', label: 'API keys' }] },
  { label: 'System', items: [{ href: '/admin/settings', label: 'Settings' }, { href: '/admin/activity', label: 'Activity log' }] },
]

/** The public twin of a panel screen: the mono button on the right of the top bar. */
const TWIN: Record<string, { label: string; href: string }> = {
  '/admin': { label: 'Open site', href: '' },
  '/admin/decks': { label: 'View /statistics', href: '/statistics' },
  '/admin/staples': { label: 'View /statistics', href: '/statistics' },
  '/admin/statistics/sweep': { label: 'View /statistics', href: '/statistics' },
  '/admin/tournaments': { label: 'View /tournaments', href: '/tournaments' },
  '/admin/seasons': { label: 'View /leaderboard', href: '/leaderboard' },
}

/** Last crumb for the screens under a nav item. */
const SUB: Record<string, string> = { new: 'New' }

const pathOf = (href: string) => href.split('#')[0]!

/** The nav item a path lives under: the longest matching prefix, first of equals (hash links share a path). */
const locate = (pathname: string) => {
  let best: { group: string; item: NavItem } | null = null
  for (const group of NAV) {
    for (const item of group.items) {
      const path = pathOf(item.href)
      if ((pathname === path || (path !== '/admin' && pathname.startsWith(`${path}/`))) && (!best || path.length > pathOf(best.item.href).length)) {
        best = { group: group.label, item }
      }
    }
  }
  return best
}

/** The stored path, read (not taken): it holds while the admin moves inside the panel. With none, home. */
const useReturnPath = () => {
  const [path, setPath] = useState('/')
  useEffect(() => {
    const stored = readPanelReturn()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage only exists after mount
    if (stored) setPath(stored)
  }, [])
  return path
}

export const Locked = ({ title, blurb, action }: { title: string; blurb: string; action?: React.ReactNode }) => (
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
  const review = useResource(admin ? 'review' : null, getReviewCount)
  const back = useReturnPath()

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
  const counts = { review: review.data, upcoming: upcoming.data?.length }
  const base = here ? pathOf(here.item.href) : ''
  const rest = here && base !== '/admin' ? pathname.slice(base.length).split('/').filter(Boolean) : []
  const last = rest.at(-1)
  const sub = last ? (SUB[last] ?? (/^\d+$/.test(last) ? `#${last}` : decodeURIComponent(last))) : null
  const twin = TWIN[base]
  const name = user.profile.username ?? user.id

  return (
    <div className="adm">
      <div className="navslot">
        <nav className="snav" aria-label="Panel">
          <div className="brand">
            <span className="wm">Omega Hub</span>
            <Chip tone="gold">Panel</Chip>
          </div>
          <Link className="back cut" href={back}>
            <Icon name="left" size={16} />
            <span className="col-s" style={{ gap: 0 }}>
              <span className="t4" style={{ fontSize: 14 }}>
                Back to site
              </span>
              <span className="lbl-sm" style={{ textTransform: 'none', letterSpacing: 0 }}>
                {back}
              </span>
            </span>
          </Link>
          {NAV.map((group) => (
            <div key={group.label}>
              {group.label ? <div className="grp lbl-sm">{group.label}</div> : null}
              {group.items.map((item) => {
                const on = here?.item === item
                const waiting = item.count ? counts[item.count] : undefined
                return (
                  <Link key={item.href} href={item.href} className={on ? 'nv on' : 'nv'} aria-current={on ? 'page' : undefined}>
                    <span>{item.label}</span>
                    {waiting ? <span className="ct">{waiting}</span> : null}
                  </Link>
                )
              })}
            </div>
          ))}
          <div className="foot">
            <Avatar name={name} src={user.profile.avatarUrl} cosmetics={user.cosmetics} className="size-9 text-lg" />
            <span className="col-s" style={{ gap: 0, minWidth: 0 }}>
              <span className="t4" style={{ fontSize: 14 }}>
                {name}
              </span>
              <span className="lbl-sm">Admin · system.manage</span>
            </span>
          </div>
        </nav>
      </div>
      <div className="adm-main">
        <header className="topbar">
          <nav className="crumbs lbl" aria-label="Breadcrumb">
            <Link href="/admin">Panel</Link>
            {here?.group ? (
              <>
                <span>/</span>
                <span>{here.group}</span>
              </>
            ) : null}
            {here && base !== '/admin' ? (
              <>
                <span>/</span>
                {sub ? <Link href={base}>{here.item.label}</Link> : <b>{here.item.label}</b>}
              </>
            ) : null}
            {sub ? (
              <>
                <span>/</span>
                <b>{sub}</b>
              </>
            ) : null}
          </nav>
          <span className="fx">
            {base === '/admin/activity' ? null : (
              <>
                <span className="lbl-sm">Every change is logged</span>
                <Link className="lbl-strong lnk" href="/admin/activity">
                  Activity log
                </Link>
              </>
            )}
            {twin ? (
              <Button variant="secondary" size="mono" href={twin.href || back}>
                {twin.label}
              </Button>
            ) : null}
          </span>
        </header>
        <ToastHost>
          <main className="page">{children}</main>
        </ToastHost>
      </div>
    </div>
  )
}
