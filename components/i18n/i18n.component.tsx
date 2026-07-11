import { useEffect, useId, useRef, useState } from 'react'
import { LANGUAGES } from './i18n.const'
import './i18n.styles.css'

const iconUrl = (name: string) => {
  const [prefix, icon] = name.split(':')
  return `https://api.iconify.design/${prefix}/${icon}.svg?color=%23ececee`
}

const TranslateIcon = () => (
  <img
    className="i18n__icon"
    src={iconUrl('mdi:translate')}
    alt=""
    aria-hidden="true"
    width={18}
    height={18}
    loading="lazy"
    decoding="async"
  />
)

const I18nComponent = () => {
  const [isOpen, setIsOpen] = useState(false)
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const activeLanguage = LANGUAGES[0]

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const closeMenu = () => setIsOpen(false)
  const toggleMenu = () => setIsOpen((current) => !current)

  return (
    <div className="i18n" ref={rootRef}>
      <button
        type="button"
        className="i18n__trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={menuId}
        aria-label={`Language: ${activeLanguage.label}`}
        onClick={toggleMenu}
      >
        <TranslateIcon />
        <span className="i18n__label">{activeLanguage.code.toUpperCase()}</span>
        <span className="i18n__chevron" aria-hidden="true" />
      </button>

      <ul
        id={menuId}
        className={`i18n__panel${isOpen ? ' i18n__panel--open' : ''}`}
        role="listbox"
        aria-label="Select language"
      >
        {LANGUAGES.map((language) => (
          <li key={language.code} className="i18n__option-item" role="none">
            <button
              type="button"
              className="i18n__option"
              role="option"
              aria-selected={language.code === activeLanguage.code}
              onClick={closeMenu}
            >
              <span className="i18n__option-code">{language.code.toUpperCase()}</span>
              <span className="i18n__option-label">{language.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default I18nComponent
