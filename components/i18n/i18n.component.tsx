'use client'

import { Icon } from '@iconify/react/offline'
import { LANGUAGES } from './i18n.const'
import './i18n.styles.css'

const I18nComponent = () => {
  const activeLanguage = LANGUAGES[0] ?? { code: 'en', label: 'English' }

  return (
    <div className="i18n">
      {/* Placeholder until language switching ships — no fake listbox. */}
      <button
        type="button"
        className="i18n__trigger"
        aria-label={`Language: ${activeLanguage.label} (coming soon)`}
        title="Language selection coming soon"
        disabled
      >
        <Icon
          className="i18n__icon"
          icon="mdi:translate"
          width={18}
          height={18}
          aria-hidden
        />
        <span className="i18n__label">{activeLanguage.code.toUpperCase()}</span>
        <span className="i18n__chevron" aria-hidden="true" />
      </button>
    </div>
  )
}

export default I18nComponent
