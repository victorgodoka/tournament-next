'use client'

import Link from "next/link";
import { RefObject, useState } from "react";
import { Icon } from "@iconify/react";
import { twMerge } from "tailwind-merge";
import { CELL, Navbar, PANEL, PANEL_ITEM, PANEL_RULE } from "@ui/navbar";
import { LanguageSwitcher } from "@ui/navbar/language-switcher.component";
import { Avatar } from "@ui/avatar";
import { useAuth } from "@hooks/index";
import { signIn, type AuthUser } from "@utils/auth";
import { can } from "@utils/articles";
import { ANALYTICS_ENABLED, DOWNLOAD_URL, NAVBAR_ITEMS, NavbarItem } from "@utils/const";
import Button from "@ui/button";
import { MessengerMailbox } from "@omega/messenger";

type HeaderProps = {
  /** Optional sentinel ref, used by pages that swap in a fixed bar once the header scrolls away. */
  elementRef?: RefObject<HTMLElement | null>
  className?: string
  items?: NavbarItem[]
  /** A page's own cell before the account, at every width (the shop's balance). */
  extra?: React.ReactNode
}

/** The one primary action in the bar, so the install path stays the loudest thing in the header. */
const DownloadCta = () => (
  <Button
    href={DOWNLOAD_URL}
    variant="primary"
    size="sm"
  >
    Download
    <span className="hidden lg:inline">Free</span>
  </Button>
)

const SignIn = ({ isLoading }: { isLoading: boolean }) => (
  <Button
    onClick={signIn}
    aria-hidden={isLoading}
    variant="discord"
    size="sm"
    className={twMerge(isLoading && "invisible")}
  >
    <Icon icon="bi:discord" aria-hidden className="text-base" />
    <span>Login</span>
  </Button>
)

/** Account cell plus its menu. Closes on Escape or as soon as focus leaves the group. */
const Account = ({ user, signOut }: { user: AuthUser; signOut: () => Promise<void> }) => {
  const [isOpen, setIsOpen] = useState(false)
  const name = user.profile.username ?? 'Duelist'

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
        className={twMerge(CELL, "cursor-pointer gap-2.5 px-3.75", isOpen ? "bg-surface-400 text-ink" : "text-ink hover:bg-surface-300")}
      >
        <Avatar name={name} src={user.profile.avatarUrl} cosmetics={user.cosmetics} size="sm" />


        <span className="hidden text-left sm:block">
          <span className="block caption font-bold tracking-normal normal-case">{name}</span>
          <span className="mt-0.5 flex items-center gap-1.5">
            <span aria-hidden className="block size-2 rounded-round bg-cyan" />
            <span className="signal-sm">Online</span>
          </span>
        </span>

        <span aria-hidden className={twMerge("text-[9px] leading-none", isOpen && "rotate-180")}>▾</span>
      </button>

      {isOpen ? (
        <div role="menu" className={twMerge(PANEL, "right-0")}>
          <p className={PANEL_RULE}>{name}</p>
          <Link href={`/profile/${user.id}`} role="menuitem" onClick={() => setIsOpen(false)} className={PANEL_ITEM}>My profile</Link>
          {ANALYTICS_ENABLED ? <Link href={`/profile/${user.id}/statistics`} role="menuitem" onClick={() => setIsOpen(false)} className={PANEL_ITEM}>My statistics</Link> : null}
          <Link href="/deck-builder" role="menuitem" onClick={() => setIsOpen(false)} className={PANEL_ITEM}>My decks</Link>
          <Link href="/messenger" role="menuitem" onClick={() => setIsOpen(false)} className={PANEL_ITEM}>Messenger</Link>
          <p className={PANEL_RULE}>Account</p>
          <Link href="/profile/edit" role="menuitem" onClick={() => setIsOpen(false)} className={PANEL_ITEM}>Edit profile</Link>
          <Link href="/inventory" role="menuitem" onClick={() => setIsOpen(false)} className={PANEL_ITEM}>Inventory</Link>
          {/* The panel refuses anyone without it anyway; this only keeps the door out of sight. */}
          {can(user, 'system.manage') || can(user, 'user.manage') ? (
            <Link href="/admin" role="menuitem" onClick={() => setIsOpen(false)} className={twMerge(PANEL_ITEM, "text-gold")}>Admin panel</Link>
          ) : null}
          <button type="button" role="menuitem" onClick={signOut} className={twMerge(PANEL_ITEM, "w-full cursor-pointer text-crimson-lift hover:text-crimson-lift")}>
            Log out
          </button>
        </div>
      ) : null}
    </div>
  )
}

export const Header = ({ elementRef, className, items, extra }: HeaderProps) => {
  const { user, signOut } = useAuth()
  const account = user ? <Account user={user} signOut={signOut} /> : <SignIn isLoading={user === undefined} />

  return (
    <header
      ref={elementRef}
      className={twMerge("absolute top-0 z-(--z-sticky) flex h-15 w-full flex-nowrap items-stretch gap-8 border-b border-line bg-surface-100/92 px-6 max-lg:gap-3 max-lg:px-4 xl:fixed", className)}
    >
      <Navbar
        items={(items ?? NAVBAR_ITEMS).filter((entry) => user || !entry.loggedIn)}
        end={<>
          <LanguageSwitcher />
          {extra}
          {account}
        </>}
        keep={user ? <>
          {extra}
          {/* Phones get no dock; the mailbox stands in for it. */}
          <MessengerMailbox className={twMerge(CELL, "px-3 text-ink hover:bg-surface-300 sm:hidden")} />
          {account}
        </> : null}
        drawerExtra={<>
          <LanguageSwitcher />
          {user ? null : account}
        </>}
        cta={<DownloadCta />}
      />
    </header>
  )
}
