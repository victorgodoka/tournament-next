'use client'

import Image from "next/image";
import Link from "next/link";
import { RefObject, useState } from "react";
import { Icon } from "@iconify/react";
import { twMerge } from "tailwind-merge";
import { CELL, Navbar, PANEL, PANEL_ITEM, PANEL_RULE } from "@ui/navbar";
import { useAuth } from "@hooks/index";
import { signIn, type AuthUser } from "@utils/auth";
import { DOWNLOAD_URL, NavbarItem } from "@utils/const";
import Button from "@ui/button";

type HeaderProps = {
  /** Optional sentinel ref, used by pages that swap in a fixed bar once the header scrolls away. */
  elementRef?: RefObject<HTMLElement | null>
  className?: string
  items?: NavbarItem[]
}

/** The one filled cell in the bar, so the install path stays the loudest thing in the header. */
const DownloadCta = () => (
  <Button
    href={DOWNLOAD_URL}
    variant="primary"
    size="lg"
    className="font-display"
  >
    Download
    <span className="hidden min-[1081px]:inline">Free</span>
  </Button>
)

const SignIn = ({ isLoading }: { isLoading: boolean }) => (
  <Button
    onClick={signIn}
    aria-hidden={isLoading}
    variant="discord"
    size="lg"
    className={twMerge(
      CELL,
      "cursor-pointer border-l border-line font-display",
      isLoading && "invisible",
    )}
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
        className={twMerge(CELL, "cursor-pointer gap-2.5 border-l border-line px-3.75", isOpen ? "bg-gold text-gold-on" : "text-ink hover:bg-surface-300")}
      >
        {user.profile.avatarUrl ? (
          <Image
            src={user.profile.avatarUrl}
            alt=""
            width={60}
            height={60}
            className="size-7.5 shrink-0 rounded-round object-cover duotone"
          />
        ) : (
          <span aria-hidden className="size-7.5 shrink-0 rounded-round bg-surface-400" />
        )}

        <span className="hidden text-left sm:block">
          <span className="block font-sans text-[13px] font-bold tracking-normal normal-case">{name}</span>
          <span className="mt-0.5 flex items-center gap-1.5">
            <span aria-hidden className="block size-2 bg-cyan" />
            <span className="signal-sm">Online</span>
          </span>
        </span>

        <span aria-hidden className={twMerge("text-[9px] leading-none", isOpen && "rotate-180")}>▾</span>
      </button>

      {isOpen ? (
        <div role="menu" className={twMerge(PANEL, "right-0")}>
          <p className={PANEL_RULE}>{name}</p>
          <Link href={`/profile/${user.id}`} role="menuitem" onClick={() => setIsOpen(false)} className={PANEL_ITEM}>My profile</Link>
          <Link href="/deck-editor" role="menuitem" onClick={() => setIsOpen(false)} className={PANEL_ITEM}>My decks</Link>
          <Link href="/messenger" role="menuitem" onClick={() => setIsOpen(false)} className={PANEL_ITEM}>Messenger</Link>
          <p className={PANEL_RULE}>Account</p>
          <Link href="/profile/edit" role="menuitem" onClick={() => setIsOpen(false)} className={PANEL_ITEM}>Edit profile</Link>
          <button type="button" role="menuitem" onClick={signOut} className={twMerge(PANEL_ITEM, "w-full cursor-pointer hover:bg-cyan hover:text-cyan-on")}>
            Log out
          </button>
        </div>
      ) : null}
    </div>
  )
}

export const Header = ({ elementRef, className, items }: HeaderProps) => {
  const { user, signOut } = useAuth()

  return (
    <header
      ref={elementRef}
      className={twMerge("absolute top-0 z-(--z-sticky) flex w-full flex-nowrap items-stretch border-b border-line-strong bg-surface-000 xl:fixed", className)}
    >
      <Navbar items={items} />
      <div className="flex shrink-0 items-stretch">
        {user ? <Account user={user} signOut={signOut} /> : <SignIn isLoading={user === undefined} />}
        <DownloadCta />
      </div>
    </header>
  )
}
