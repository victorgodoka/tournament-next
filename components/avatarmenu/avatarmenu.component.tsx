'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { Icon } from '@iconify/react'
import AvatarComponent from '../avatar/avatar.component'
import {
  LOGOUT_MENU_ITEM,
  PROFILE_MENU_ITEMS,
  HOVER_CLOSE_DELAY,
} from './avatarmenu.const'
import './avatarmenu.styles.css'
import type { AvatarmenuComponentProps } from './avatarmenu.types'
import { discordAvatar } from '@assets/discord.avatar'

const AvatarmenuComponent = ({ user, logout, isLoggingOut = false }: AvatarmenuComponentProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const closeTimeoutRef = useRef<number | null>(null)

  const clearCloseTimeout = () => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
  }

  const openMenu = () => {
    if (isLoggingOut) return
    clearCloseTimeout()
    setIsOpen(true)
  }

  const scheduleClose = () => {
    if (isLoggingOut) return
    clearCloseTimeout()
    closeTimeoutRef.current = window.setTimeout(() => {
      setIsOpen(false)
    }, HOVER_CLOSE_DELAY)
  }

  const closeMenu = () => {
    if (isLoggingOut) return
    clearCloseTimeout()
    setIsOpen(false)
  }

  const toggleMenu = () => {
    if (isLoggingOut) return
    setIsOpen((current) => !current)
  }

  useEffect(() => {
    if (isLoggingOut) {
      setIsOpen(false)
    }
  }, [isLoggingOut])

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        closeMenu()
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  useEffect(() => {
    return () => clearCloseTimeout()
  }, [])

  if (!user) return null

  const displayName = user.displayname || user.username
  const handle = user.username

  return (
    <div
      className="avatarmenu"
      ref={rootRef}
      onMouseEnter={openMenu}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        className="avatarmenu__trigger"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        aria-label={`${displayName} account menu`}
        onClick={toggleMenu}
      >
        <AvatarComponent
          src={discordAvatar(user.id, user.avatar)}
          alt={displayName}
          size="lg"
          shape="circle"
          borderColor="var(--color-secondary-light)"
        />
      </button>

      <div
        id={menuId}
        className={`avatarmenu__panel${isOpen ? ' avatarmenu__panel--open' : ''}`}
        role="menu"
        aria-label="Account menu"
        onMouseEnter={openMenu}
        onMouseLeave={scheduleClose}
      >
        <div className="avatarmenu__profile">
          <AvatarComponent
            src={discordAvatar(user.id, user.avatar)}
            alt={displayName}
            size="lg"
            shape="circle"
            borderColor="var(--color-accent-light)"
          />

          <div className="avatarmenu__identity">
            <span className="avatarmenu__display-name">
              {displayName}
            </span>
            <span className="avatarmenu__username">
              @{handle}
            </span>
          </div>
        </div>

        <hr className="avatarmenu__divider" />

        <ul className="avatarmenu__menu">
          {PROFILE_MENU_ITEMS.map((item) => (
            <li key={item.to} className="avatarmenu__menu-item" role="none">
              <Link
                href={item.to}
                className="avatarmenu__menu-link"
                role="menuitem"
                onClick={closeMenu}
              >
                <Icon className="avatarmenu__menu-icon" icon={item.icon} aria-hidden />
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>

        <hr className="avatarmenu__divider" />

        <button
          type="button"
          className="avatarmenu__logout"
          role="menuitem"
          disabled={isLoggingOut}
          onClick={() => {
            closeMenu()
            logout()
          }}
        >
          <Icon
            className="avatarmenu__menu-icon"
            icon={LOGOUT_MENU_ITEM.icon}
            aria-hidden
          />
          <span>{LOGOUT_MENU_ITEM.label}</span>
        </button>
      </div>
    </div>
  )
}

export default AvatarmenuComponent
