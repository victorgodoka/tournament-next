'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import IconComponent from '../icon/icon.component'
import AvatarComponent from '../avatar/avatar.component'
import {
  LOGOUT_MENU_ITEM,
  getProfileMenuItems,
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

  const panelOpen = isOpen && !isLoggingOut

  useEffect(() => {
    if (!panelOpen) return

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
  }, [panelOpen])

  useEffect(() => {
    return () => clearCloseTimeout()
  }, [])

  if (!user) return null

  const displayName = user.displayname || user.username
  const handle = user.username
  const profileMenuItems = getProfileMenuItems(user.id)

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
        aria-expanded={panelOpen}
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
        className={`avatarmenu__panel${panelOpen ? ' avatarmenu__panel--open' : ''}`}
        role="menu"
        aria-label="Account menu"
        hidden={!panelOpen}
        inert={!panelOpen ? true : undefined}
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
          {profileMenuItems.map((item) => (
            <li key={item.to} className="avatarmenu__menu-item" role="none">
              <Link
                href={item.to}
                className="avatarmenu__menu-link"
                role="menuitem"
                tabIndex={panelOpen ? undefined : -1}
                onClick={closeMenu}
              >
                <IconComponent className="avatarmenu__menu-icon" icon={item.icon} />
                <span>{item.label}</span>
              </Link>
            </li>
          ))}

          <li className="avatarmenu__menu-item" role="none">
            <button
              type="button"
              className="avatarmenu__logout"
              role="menuitem"
              tabIndex={panelOpen ? undefined : -1}
              disabled={isLoggingOut}
              onClick={() => {
                closeMenu()
                logout()
              }}
            >
              <IconComponent
                className="avatarmenu__menu-icon"
                icon={LOGOUT_MENU_ITEM.icon}
              />
              <span>{LOGOUT_MENU_ITEM.label}</span>
            </button>
          </li>
        </ul>
      </div>
    </div>
  )
}

export default AvatarmenuComponent
