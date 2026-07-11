'use client'

import { useId } from 'react'
import { Icon } from '@iconify/react'
import { LANGUAGES } from './i18n.const'
import './i18n.styles.css'

const TranslateIcon = () => (
  <Icon
    className="i18n__icon"
    icon="mdi:translate"
    width={18}
    height={18}
    aria-hidden
  />
)

const I18nComponent = () => {
  const menuId = useId()
  const activeLanguage = LANGUAGES[0]

  return (
    <div className="i18n">
      <button
        type="button"
        className="i18n__trigger"
        aria-haspopup="listbox"
        aria-expanded={false}
        aria-controls={menuId}
        aria-disabled="true"
        aria-label={`Language: ${activeLanguage.label} (coming soon)`}
        title="Language selection coming soon"
        disabled
      >
        <TranslateIcon />
        <span className="i18n__label">{activeLanguage.code.toUpperCase()}</span>
        <span className="i18n__chevron" aria-hidden="true" />
      </button>

      <ul
        id={menuId}
        className="i18n__panel"
        role="listbox"
        aria-label="Select language"
        hidden
      >
        {LANGUAGES.map((language) => (
          <li key={language.code} className="i18n__option-item" role="none">
            <button
              type="button"
              className="i18n__option"
              role="option"
              aria-selected={language.code === activeLanguage.code}
              disabled
              tabIndex={-1}
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
