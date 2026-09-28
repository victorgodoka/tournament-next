import Link from 'next/link'
import { twMerge } from 'tailwind-merge'

export type SideNavItem = {
  href: string
  label: React.ReactNode
  /** Cyan mono figure on the right: what's waiting there. */
  count?: React.ReactNode
  current?: boolean
}

export type SideNavGroup = { label: string; items: SideNavItem[] }

type SideNavProps = {
  /** Names the navigation landmark. */
  label: string
  groups: SideNavGroup[]
  /** Above the groups: the wordmark and whatever tags it. */
  brand?: React.ReactNode
  /** Pinned to the bottom, over a hairline: who is signed in. */
  footer?: React.ReactNode
  className?: string
}

/**
 * The column of a workspace: grouped links under mono heads. The current link sits on ground-cyan
 * with the selected bar. Below 1024px it becomes a block on top of the page with the groups side by side.
 */
export const SideNav = ({ label, groups, brand, footer, className }: SideNavProps) => (
  <aside
    className={twMerge(
      'flex shrink-0 flex-col border-line bg-surface-100 py-6 lg:sticky lg:top-0 lg:h-dvh lg:w-62 lg:overflow-y-auto lg:border-r lg:pb-5',
      'border-b',
      className,
    )}
  >
    {brand ? <div className="flex items-center gap-2.5 px-5 pb-3">{brand}</div> : null}
    <nav aria-label={label} className="flex flex-wrap lg:flex-col lg:flex-nowrap">
      {groups.map((group) => (
        <div key={group.label} className="flex min-w-50 flex-col">
          <p className="px-5 pt-5 pb-2 text-ink-muted signal-sm">{group.label}</p>
          {group.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={item.current ? 'page' : undefined}
              className={twMerge(
                'flex h-9 items-center gap-2.5 px-5 text-sm text-ink-dim hover:bg-surface-200 hover:text-ink',
                item.current && 'bg-ground-cyan text-ink shadow-selected hover:bg-ground-cyan',
              )}
            >
              <span className="flex-1">{item.label}</span>
              {item.count != null ? <span className="text-cyan signal-sm">{item.count}</span> : null}
            </Link>
          ))}
        </div>
      ))}
    </nav>
    {footer ? (
      <>
        <div className="flex-1" />
        <div className="mt-6 flex items-center gap-3 border-t border-line px-5 pt-4">{footer}</div>
      </>
    ) : null}
  </aside>
)
