'use client'

import Link from 'next/link'
import { Chip } from '@ui/chip'
import { useAuth } from '@contexts/auth/auth.context'
import { can } from '@utils/articles'
import { storePanelReturn } from '@utils/panel-return'

type AdminBarProps = {
  /** The panel screen this public page reads: "Identified decks › Dark Magician". */
  reads: string
  /** The deep link into the panel and what it does: "Edit this deck". */
  href: string
  label: string
}

/**
 * One gold line under the navbar on a public page that has a panel screen. Only admins get the
 * markup; everyone else renders nothing. Both links store the current path first, so "Back to site"
 * in the panel returns here.
 */
export const AdminBar = ({ reads, href, label }: AdminBarProps) => {
  const { user } = useAuth()
  if (!can(user, 'system.manage')) return null
  const remember = () => storePanelReturn(window.location.pathname + window.location.search)
  return (
    <aside aria-label="Admin" className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-gold/40 bg-surface-200 px-gutter py-2 text-sm text-ink-dim">
      <Chip tone="gold">Admin</Chip>
      <span className="min-w-0 flex-1">
        This page reads <b className="text-ink">{reads}</b>. Only admins see this bar.
      </span>
      <Link href={href} onClick={remember} className="signal-strong text-gold hover:text-ink">
        {label}
      </Link>
      <Link href="/admin" onClick={remember} className="signal-strong hover:text-ink">
        Open panel
      </Link>
    </aside>
  )
}
