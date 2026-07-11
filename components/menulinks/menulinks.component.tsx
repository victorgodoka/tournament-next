'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { Icon } from '@iconify/react'
import { MENU_LINKS_GROUPS } from './menulinks.const'
import { isMenuGroup } from './menulinks.types'
import type { MenuGroup, MenuLinkItem } from './menulinks.types'
import './menulinks.styles.css'
import I18nComponent from '../i18n/i18n.component'

const MenuIcon = ({ name }: { name: string }) => (
  <Icon
    className="menulinks__icon"
    icon={name}
    width={18}
    height={18}
    aria-hidden
  />
)

const MenuDropdown = ({
  group,
  isOpen,
  onToggle,
  onClose,
}: {
  group: MenuGroup
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
}) => {
  const menuId = useId()
  const panelRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!panelRef.current?.closest('.menulinks__item')?.contains(target)) {
        onClose()
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  return (
    <li className="menulinks__item menulinks__item--dropdown">
      <button
        type="button"
        className="menulinks__trigger"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={onToggle}
      >
        <span>{group.label}</span>
        <span className="menulinks__chevron" aria-hidden="true" />
      </button>

      <ul
        ref={panelRef}
        id={menuId}
        className={`menulinks__panel${isOpen ? ' menulinks__panel--open' : ''}`}
        role="menu"
        aria-label={group.label}
        hidden={!isOpen}
      >
        {group.items.map((item: MenuLinkItem) => (
          <li key={item.to} className="menulinks__panel-item" role="none">
            <Link
              href={item.to}
              className="menulinks__panel-link"
              role="menuitem"
              onClick={onClose}
            >
              <MenuIcon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </li>
  )
}

const MobileAccordion = ({
  group,
  isOpen,
  onToggle,
  onNavigate,
}: {
  group: MenuGroup
  isOpen: boolean
  onToggle: () => void
  onNavigate: () => void
}) => {
  const sectionId = useId()

  return (
    <li className="menulinks__mobile-section">
      <button
        type="button"
        className="menulinks__mobile-trigger"
        aria-expanded={isOpen}
        aria-controls={sectionId}
        onClick={onToggle}
      >
        <span>{group.label}</span>
        <span className="menulinks__chevron" aria-hidden="true" />
      </button>

      <ul
        id={sectionId}
        className={`menulinks__mobile-sublist${isOpen ? ' menulinks__mobile-sublist--open' : ''}`}
        hidden={!isOpen}
      >
        {group.items.map((item) => (
          <li key={item.to} className="menulinks__mobile-subitem">
            <Link
              href={item.to}
              className="menulinks__mobile-sublink"
              onClick={onNavigate}
            >
              <MenuIcon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </li>
  )
}

const MenulinksComponent = () => {
  const [openId, setOpenId] = useState<string | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [openSectionId, setOpenSectionId] = useState<string | null>(null)
  const drawerId = useId()
  const drawerRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  const closeDesktopMenu = useCallback(() => setOpenId(null), [])

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false)
    setOpenSectionId(null)
  }, [])

  const toggleMenu = (id: string) => {
    setOpenId((current) => (current === id ? null : id))
  }

  const toggleSection = (id: string) => {
    setOpenSectionId((current) => (current === id ? null : id))
  }

  useEffect(() => {
    if (!isDrawerOpen) return

    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    const getFocusableElements = () => {
      const sheet = sheetRef.current
      if (!sheet) return []

      return Array.from(
        sheet.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute('disabled') && element.tabIndex !== -1)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeDrawer()
        return
      }

      if (event.key !== 'Tab') return

      const focusable = getFocusableElements()
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement

      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [closeDrawer, isDrawerOpen])

  return (
    <nav className="menulinks" aria-label="Main navigation">
      <button
        type="button"
        className="menulinks__toggle"
        aria-expanded={isDrawerOpen}
        aria-controls={drawerId}
        aria-label={isDrawerOpen ? 'Close navigation menu' : 'Open navigation menu'}
        onClick={() => setIsDrawerOpen((open) => !open)}
      >
        <Icon
          className="menulinks__toggle-icon"
          icon={isDrawerOpen ? 'mdi:close' : 'mdi:menu'}
          width={22}
          height={22}
          aria-hidden
        />
      </button>

      <ul className="menulinks__list menulinks__list--desktop" role="menubar">
        {MENU_LINKS_GROUPS.map((entry) =>
          isMenuGroup(entry) ? (
            <MenuDropdown
              key={entry.id}
              group={entry}
              isOpen={openId === entry.id}
              onToggle={() => toggleMenu(entry.id)}
              onClose={closeDesktopMenu}
            />
          ) : (
            <li key={entry.id} className="menulinks__item" role="none">
              <Link href={entry.to} className="menulinks__link" role="menuitem">
                {entry.label}
              </Link>
            </li>
          ),
        )}
      </ul>

      <div
        ref={drawerRef}
        id={drawerId}
        className={`menulinks__drawer${isDrawerOpen ? ' menulinks__drawer--open' : ''}`}
        aria-hidden={!isDrawerOpen}
      >
        <button
          type="button"
          className="menulinks__backdrop"
          aria-label="Close navigation menu"
          tabIndex={isDrawerOpen ? 0 : -1}
          onClick={closeDrawer}
        />

        <div
          ref={sheetRef}
          className="menulinks__sheet"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <div className="menulinks__sheet-header">
            <span className="menulinks__sheet-eyebrow">Navigate</span>
            <I18nComponent />
            <button
              ref={closeButtonRef}
              type="button"
              className="menulinks__sheet-close"
              aria-label="Close navigation menu"
              onClick={closeDrawer}
            >
              <Icon icon="mdi:close" width={20} height={20} aria-hidden />
            </button>
          </div>

          <ul className="menulinks__mobile-list">
            {MENU_LINKS_GROUPS.map((entry) =>
              isMenuGroup(entry) ? (
                <MobileAccordion
                  key={entry.id}
                  group={entry}
                  isOpen={openSectionId === entry.id}
                  onToggle={() => toggleSection(entry.id)}
                  onNavigate={closeDrawer}
                />
              ) : (
                <li key={entry.id} className="menulinks__mobile-item">
                  <Link
                    href={entry.to}
                    className="menulinks__mobile-link"
                    onClick={closeDrawer}
                  >
                    {entry.label}
                  </Link>
                </li>
              ),
            )}
          </ul>
        </div>
      </div>
    </nav>
  )
}

export default MenulinksComponent
