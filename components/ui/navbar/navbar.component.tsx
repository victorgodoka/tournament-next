'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Icon } from '@ui/icon'
import { twMerge } from 'tailwind-merge'
import Button from '@ui/button'
import { NAVBAR_ITEMS, type NavbarItem } from '@utils/const'
import { CELL, CELL_IDLE, CELL_ON, MOBILE_ITEM, PANEL, PANEL_ITEM } from './bar'

interface NavbarProps {
  items?: NavbarItem[]
  /** Right-hand actions on the wide bar. */
  end?: React.ReactNode
  /** Stays on the collapsed bar beside the menu button (the avatar). */
  keep?: React.ReactNode
  /** What the drawer shows under the links. */
  drawerExtra?: React.ReactNode
  /** The one action visible at every width; repeats at the foot of the drawer. */
  cta?: React.ReactNode
}

/** The landing's extra link fits a signed-in bar under 1360px only with tighter cells. */
const DENSE_NAV = 'max-[1359px]:gap-0 max-[1359px]:[&>a]:px-2 max-[1359px]:[&>div>button]:px-2'

/** `▾`, rotated when its menu is open. */
const Caret = ({ isOpen }: { isOpen: boolean }) => (
  <span aria-hidden className={twMerge("text-[9px] leading-none", isOpen && "rotate-180")}>▾</span>
)

// Segment match, so `/banlist` doesn't light up on `/banlist-timeline`.
const isCurrent = (pathname: string, to: string) => pathname === to || (to !== '/' && pathname.startsWith(`${to}/`))

/** Whether any link under this entry is the page we are on, so a collapsed menu still lights up. */
const isActive = (pathname: string, { to, children }: NavbarItem) =>
  to ? isCurrent(pathname, to) : !!children?.some((child) => isCurrent(pathname, child.to))

const Brand = () => (
  <Link href="/" aria-label="Omega Hub" className="flex shrink-0 items-center gap-2.5 text-ink wordmark text-[14px]">
    {/* Raster with its own glow: only on space-000 / surface-100 / surface-200, never recolored. */}
    <Image src="/omega-mark.png" alt="" width={30} height={30} priority />
    <span className="hidden sm:inline">Omega Hub</span>
  </Link>
)

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
        className={twMerge(CELL, active ? CELL_ON : CELL_IDLE)}
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
        className={twMerge(CELL, "cursor-pointer", isOpen ? "bg-surface-300 text-ink" : active ? CELL_ON : CELL_IDLE)}
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

/**
 * The SiteNav: mark, mono links and the right-hand actions. Below 1280px the links and `end` fold
 * into a drawer that slides in from the right over a blurred scrim: the bar needs 1097px signed out
 * and 1228px on the landing, which has one link more, before an account cell widens it further.
 */
export const Navbar = ({ items = NAVBAR_ITEMS, end, keep, drawerExtra, cta }: NavbarProps) => {
  const drawer = useRef<HTMLDialogElement>(null)
  const pathname = usePathname()
  const close = () => drawer.current?.close()

  const drawerLink = (key: string, to: string, label: string, current: boolean) => (
    <Link
      key={key}
      href={to}
      onClick={close}
      aria-current={current ? 'page' : undefined}
      className={twMerge(MOBILE_ITEM, current && "pl-3 text-ink shadow-selected [&>svg]:text-cyan")}
    >
      {label}
      <Icon name="right" size={16} className="text-ink-muted" />
    </Link>
  )

  return (
    <>
      <Brand />

      <nav aria-label="Main" className={twMerge("hidden items-stretch gap-1 xl:flex", items.length > NAVBAR_ITEMS.length && DENSE_NAV)}>
        {items.map((entry) => (
          <NavbarCell key={entry.item} entry={entry} pathname={pathname} />
        ))}
      </nav>

      <div className="ml-auto flex min-w-0 items-center gap-4 max-xl:gap-2">
        <div className="hidden min-w-0 items-center gap-4 xl:flex">{end}</div>
        <div className="flex items-center xl:hidden">{keep}</div>
        {cta}
        <Button
          variant="secondary"
          size="icon-sm"
          aria-label="Open menu"
          aria-haspopup="dialog"
          onClick={() => drawer.current?.showModal()}
          className="xl:hidden"
        >
          <Icon name="menu" />
        </Button>
      </div>

      {/* Native <dialog> for the free focus trap, Escape, backdrop and focus return. */}
      <dialog
        id="site-drawer"
        ref={drawer}
        aria-label="Menu"
        onClick={(e) => e.target === drawer.current && close()}
        className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-[min(360px,88vw)] max-w-none flex-col overflow-y-auto border-l border-line-mid bg-surface-100 text-ink shadow-lift [clip-path:polygon(var(--cut-lg)_0,100%_0,100%_100%,0_100%,0_var(--cut-lg))] open:flex backdrop:bg-scrim-soft backdrop:backdrop-blur-[10px] backdrop:backdrop-saturate-120 motion-safe:open:animate-drawer-in motion-safe:backdrop:animate-fade-in"
      >
        <div className="flex min-h-16 items-center justify-between gap-3 border-b border-line px-5">
          <Brand />
          <Button variant="secondary" size="icon-sm" aria-label="Close menu" autoFocus onClick={close}>
            <Icon name="close" />
          </Button>
        </div>

        <nav aria-label="Main" className="flex flex-col px-5 py-2">
          {items.map((entry) =>
            entry.to ? (
              drawerLink(entry.item, entry.to, entry.item, isActive(pathname, entry))
            ) : (
              <div key={entry.item}>
                <p className="pt-4 pb-2 text-ink-muted signal-sm">{entry.item}</p>
                {entry.children?.map((child) => drawerLink(child.to, child.to, child.item, isCurrent(pathname, child.to)))}
              </div>
            ),
          )}
        </nav>

        {drawerExtra ? <div className="flex flex-col gap-4 p-5">{drawerExtra}</div> : null}
        {cta ? <div className="mt-auto flex flex-col gap-3 border-t border-line p-5 [&>*]:w-full">{cta}</div> : null}
      </dialog>
    </>
  )
}
