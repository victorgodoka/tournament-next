'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { twMerge } from 'tailwind-merge'
import { NAVBAR_ITEMS, type NavbarItem } from '@utils/const'
import { CELL, CELL_IDLE, CELL_ON, MOBILE_ITEM, PANEL, PANEL_ITEM, PANEL_RULE } from './bar'
import Logo from '@ui/logo/logo.component'

interface NavbarProps extends React.HTMLAttributes<HTMLElement> {
  items?: typeof NAVBAR_ITEMS
}

/** `▾`, rotated when its menu is open. */
const Caret = ({ isOpen }: { isOpen: boolean }) => (
  <span aria-hidden className={twMerge("text-[9px] leading-none", isOpen && "rotate-180")}>▾</span>
)

const isCurrent = (pathname: string, to: string) => (to === '/' ? pathname === '/' : pathname.startsWith(to))

/** Whether any link under this entry is the page we are on, so a collapsed menu still lights up. */
const isActive = (pathname: string, { to, children }: NavbarItem) =>
  to ? isCurrent(pathname, to) : !!children?.some((child) => isCurrent(pathname, child.to))

/**
 * One top-level entry. Plain `to` entries are links; entries with `children` become a dropdown that
 * closes on Escape or as soon as focus leaves the whole group.
 */
const NavbarCell = ({ entry, pathname }: { entry: NavbarItem; pathname: string }) => {
  const [isOpen, setIsOpen] = useState(false)
  const active = isActive(pathname, entry)

  if (entry.to) {
    return (
      <Link
        href={entry.to}
        aria-current={active ? 'page' : undefined}
        className={twMerge(CELL, "border-r border-line", active ? CELL_ON : CELL_IDLE)}
      >
        {entry.item}
      </Link>
    )
  }

  return (
    <div
      className="relative flex"
      onKeyDown={(e) => e.key === 'Escape' && setIsOpen(false)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setIsOpen(false)}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className={twMerge(CELL, "cursor-pointer border-r border-line", isOpen ? "bg-gold text-gold-on" : active ? CELL_ON : CELL_IDLE)}
      >
        {entry.item}
        <Caret isOpen={isOpen} />
      </button>

      {isOpen ? (
        <div role="menu" className={twMerge(PANEL, "left-0")}>
          {entry.children?.map((child) => (
            <Link key={child.to} href={child.to} role="menuitem" onClick={() => setIsOpen(false)} className={PANEL_ITEM}>
              {child.item}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export const Navbar = ({ className, items, ...props }: NavbarProps) => {
  items = items ?? NAVBAR_ITEMS
  const drawer = useRef<HTMLDialogElement>(null)
  const pathname = usePathname()

  return (
    <>
      <Link href="/" className="flex min-h-16 shrink-0 items-center gap-3 pl-6">
        <Logo width='36' height='36' type='shadow' />
      </Link>

      <nav aria-label="Main" className={twMerge("flex min-w-0 flex-1 items-stretch", className)} {...props}>
        <div className="hidden min-[1081px]:flex">
          {items.map((entry) => (
            <NavbarCell key={entry.item} entry={entry} pathname={pathname} />
          ))}
        </div>

        <button
          type="button"
          aria-haspopup="dialog"
          aria-label="Open menu"
          onClick={() => drawer.current?.showModal()}
          className={twMerge(CELL, CELL_IDLE, "ml-auto cursor-pointer border-l border-line font-bold min-[1081px]:hidden")}
        >
          <span aria-hidden className="flex flex-col gap-0.75">
            <span className="block h-0.5 w-4.25 bg-current" />
            <span className="block h-0.5 w-4.25 bg-current" />
            <span className="block h-0.5 w-4.25 bg-current" />
          </span>
          Menu
        </button>

        {/* Native <dialog> for the free focus trap, Escape and backdrop, restyled as a full-width
            sheet under the bar. It appears and disappears; nothing in this system slides. */}
        <dialog
          ref={drawer}
          aria-label="Menu"
          onClick={(e) => e.target === drawer.current && drawer.current?.close()}
          className="fixed inset-x-0 top-16 m-0 max-h-[calc(100dvh-4rem)] w-full max-w-none border-b border-line-strong bg-surface-000 text-ink shadow-offset-void backdrop:bg-scrim"
        >
          {NAVBAR_ITEMS.map((entry) =>
            entry.to ? (
              <Link
                key={entry.item}
                href={entry.to}
                onClick={() => drawer.current?.close()}
                aria-current={isActive(pathname, entry) ? 'page' : undefined}
                className={twMerge(MOBILE_ITEM, "font-bold", isActive(pathname, entry) && "text-gold")}
              >
                {entry.item}
              </Link>
            ) : (
              <div key={entry.item}>
                <p className={twMerge(PANEL_RULE, "px-5 pt-3.25 pb-2")}>{entry.item}</p>
                {entry.children?.map((child) => (
                  <Link key={child.to} href={child.to} onClick={() => drawer.current?.close()} className={MOBILE_ITEM}>
                    {child.item}
                  </Link>
                ))}
              </div>
            ),
          )}
        </dialog>
      </nav>
    </>
  )
}
