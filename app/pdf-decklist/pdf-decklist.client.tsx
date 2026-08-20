'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import ButtonComponent from '@components/button/button.component'
import IconComponent from '@components/icon/icon.component'
import DeckListComponent from '@components/deck-list/deck-list.component'
import { convertDeck } from '@app/decks/decks.api'
import type { ConvertedDeck } from '@app/decks/decks.types'
import { DECK_CODE_MIN } from '@app/decks/decks.const'
import { generateDecklistPdf } from './pdf-decklist.api'
import '@app/decks/deck-editor.styles.css'
import './pdf-decklist.styles.css'

interface FormState {
  deckCode: string
  firstName: string
  lastName: string
  cardGameId: string
  country: string
  eventName: string
  eventDate: string
}

const EMPTY_FORM: FormState = {
  deckCode: '',
  firstName: '',
  lastName: '',
  cardGameId: '',
  country: '',
  eventName: '',
  eventDate: '',
}

type FormErrors = Partial<Record<keyof FormState, string>> & { general?: string }

const REQUIRED_FIELDS: (keyof FormState)[] = [
  'deckCode', 'firstName', 'lastName', 'cardGameId', 'country', 'eventName', 'eventDate',
]

function FormSection({
  step, title, locked, children,
}: { step: number; title: string; locked?: boolean; children: ReactNode }) {
  return (
    <section className={`pdf-form-section${locked ? ' pdf-form-section--locked' : ''}`}>
      <header className="pdf-form-section__head">
        <span className="pdf-form-section__step">{step}</span>
        <h2 className="pdf-form-section__title">{title}</h2>
        {locked && <IconComponent icon="mdi:lock-outline" width={16} height={16} />}
      </header>
      <div className="pdf-form-section__body">{children}</div>
    </section>
  )
}

function Field({
  id, label, value, onChange, error, placeholder, required,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  placeholder?: string
  required?: boolean
}) {
  return (
    <div className="deck-form__field">
      <label htmlFor={id} className="deck-form__label">
        {label}
        {required && <span className="deck-form__required" aria-hidden="true"> *</span>}
      </label>
      <input
        id={id}
        type="text"
        className={`deck-form__input${error ? ' deck-form__input--invalid' : ''}`}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && <span className="deck-form__field-error" role="alert">{error}</span>}
    </div>
  )
}

const PdfDecklistClient = ({ initialCode }: { initialCode?: string }) => {
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM, deckCode: initialCode ?? '' })
  const [errors, setErrors] = useState<FormErrors>({})

  const [isValidating, setIsValidating] = useState(false)
  const [isValid, setIsValid] = useState(false)
  const [deck, setDeck] = useState<ConvertedDeck | null>(null)

  const [isGenerating, setIsGenerating] = useState(false)
  const autoValidated = useRef(false)

  const setField = useCallback((field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev))
    if (field === 'deckCode' && isValid) {
      setIsValid(false)
      setDeck(null)
    }
  }, [isValid])

  const validateDeckCode = useCallback(async (code: string, quiet = false) => {
    const trimmed = code.trim()
    if (!trimmed) {
      setIsValid(false)
      setDeck(null)
      if (!quiet) setErrors((prev) => ({ ...prev, deckCode: 'Deck code is required.' }))
      return
    }
    if (trimmed.length < DECK_CODE_MIN) {
      setIsValid(false)
      setDeck(null)
      if (!quiet) setErrors((prev) => ({ ...prev, deckCode: 'That deck code looks too short.' }))
      return
    }

    setIsValidating(true)
    try {
      const converted = await convertDeck(trimmed, true)
      setDeck(converted)
      setIsValid(true)
      setErrors((prev) => ({ ...prev, deckCode: undefined }))
    } catch {
      setDeck(null)
      setIsValid(false)
      if (!quiet) setErrors((prev) => ({ ...prev, deckCode: "That doesn't look like a valid deck code." }))
    } finally {
      setIsValidating(false)
    }
  }, [])

  useEffect(() => {
    if (!initialCode || autoValidated.current) return
    autoValidated.current = true
    void validateDeckCode(initialCode, true)
  }, [initialCode, validateDeckCode])

  const progress = useMemo(() => {
    const completed = REQUIRED_FIELDS.filter((field) => form[field].trim()).length
    return Math.round((completed / REQUIRED_FIELDS.length) * 100)
  }, [form])

  const canGenerate = isValid && progress === 100 && !isGenerating

  const validateForm = (): FormErrors => {
    const next: FormErrors = {}
    if (!form.deckCode.trim()) next.deckCode = 'Deck code is required.'
    if (!form.firstName.trim()) next.firstName = 'First name is required.'
    if (!form.lastName.trim()) next.lastName = 'Last name is required.'
    if (!form.cardGameId.trim()) next.cardGameId = 'Card Game ID is required.'
    if (!form.country.trim()) next.country = 'Country is required.'
    if (!form.eventName.trim()) next.eventName = 'Event name is required.'
    if (!form.eventDate.trim()) {
      next.eventDate = 'Event date is required.'
    } else {
      const year = new Date(form.eventDate).getFullYear()
      if (year < 2020 || year > 2030) next.eventDate = 'Event date must be between 2020 and 2030.'
    }
    return next
  }

  const generatePdf = async (): Promise<Blob | null> => {
    const validationErrors = validateForm()
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return null
    }

    setIsGenerating(true)
    setErrors({})
    try {
      const [year = '', month = '', day = ''] = form.eventDate.split('-')
      return await generateDecklistPdf({
        deck: form.deckCode.trim(),
        name: form.firstName.trim(),
        lastName: form.lastName.trim(),
        cardGameID: form.cardGameId.trim(),
        country: form.country.trim(),
        event: form.eventName.trim(),
        month, day, year,
      })
    } catch (error) {
      setErrors({ general: error instanceof Error ? error.message : 'Failed to generate PDF.' })
      return null
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownload = async () => {
    const blob = await generatePdf()
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `decklist_${form.firstName}_${form.lastName}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleView = async () => {
    const blob = await generatePdf()
    if (!blob) return
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="pdf-decklist">
      <header className="pdf-decklist__header">
        <div>
          <p className="pdf-decklist__kicker">Tournament tools</p>
          <h1 className="pdf-decklist__title">PDF Decklist</h1>
          <p className="pdf-decklist__lead">
            Fill in your player and event info to generate an official, print-ready Konami decklist PDF.
          </p>
        </div>
        <ButtonComponent variant="ghost" size="sm" icon="mdi:cards-outline" to="/deck-editor">
          Open deck editor
        </ButtonComponent>
      </header>

      <div className="pdf-decklist__progress">
        <div className="pdf-decklist__progress-head">
          <span>Form progress</span>
          <span>{progress}%</span>
        </div>
        <div className="pdf-decklist__progress-track">
          <div
            className={`pdf-decklist__progress-bar${progress === 100 && isValid ? ' pdf-decklist__progress-bar--ready' : ''}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        {progress === 100 && isValid && (
          <p className="pdf-decklist__progress-ready">
            <IconComponent icon="mdi:check-circle-outline" width={14} height={14} />
            Ready to generate
          </p>
        )}
      </div>

      {errors.general && (
        <p className="pdf-decklist__error" role="alert">
          <IconComponent icon="mdi:alert-circle-outline" width={16} height={16} />
          {errors.general}
        </p>
      )}

      <div className="pdf-decklist__layout">
        <div className="pdf-decklist__form">
          <FormSection step={1} title="Deck information">
            <div className="deck-form__field">
              <label htmlFor="pdf-deck-code" className="deck-form__label">
                Deck code<span className="deck-form__required" aria-hidden="true"> *</span>
              </label>
              <textarea
                id="pdf-deck-code"
                className={`deck-form__input deck-form__input--code${errors.deckCode ? ' deck-form__input--invalid' : ''}`}
                rows={3}
                placeholder="Paste your YGO Omega deck code, YDKE URL, or Konami code"
                value={form.deckCode}
                onChange={(e) => setField('deckCode', e.target.value)}
              />
              {errors.deckCode && <span className="deck-form__field-error" role="alert">{errors.deckCode}</span>}
            </div>

            <ButtonComponent
              variant="outline"
              icon="mdi:check-circle-outline"
              loading={isValidating}
              disabled={!form.deckCode.trim()}
              onClick={() => void validateDeckCode(form.deckCode)}
              fullWidth
            >
              {isValidating ? 'Validating…' : 'Validate deck code'}
            </ButtonComponent>

            {isValid && (
              <p className="pdf-decklist__valid-hint">
                <IconComponent icon="mdi:check" width={14} height={14} />
                Deck validated
              </p>
            )}
          </FormSection>

          <FormSection step={2} title="Player information" locked={!isValid}>
            <div className="pdf-decklist__field-grid">
              <Field id="pdf-first-name" label="First name" value={form.firstName} onChange={(v) => setField('firstName', v)} error={errors.firstName} required />
              <Field id="pdf-last-name" label="Last name" value={form.lastName} onChange={(v) => setField('lastName', v)} error={errors.lastName} required />
              <Field id="pdf-card-game-id" label="Card Game ID" value={form.cardGameId} onChange={(v) => setField('cardGameId', v)} error={errors.cardGameId} required />
              <Field id="pdf-country" label="Country" value={form.country} onChange={(v) => setField('country', v)} error={errors.country} required />
            </div>
          </FormSection>

          <FormSection step={3} title="Event information" locked={!isValid}>
            <Field id="pdf-event-name" label="Event name" value={form.eventName} onChange={(v) => setField('eventName', v)} error={errors.eventName} required />
            <div className="deck-form__field">
              <label htmlFor="pdf-event-date" className="deck-form__label">
                Event date<span className="deck-form__required" aria-hidden="true"> *</span>
              </label>
              <input
                id="pdf-event-date"
                type="date"
                className={`deck-form__input${errors.eventDate ? ' deck-form__input--invalid' : ''}`}
                value={form.eventDate}
                onChange={(e) => setField('eventDate', e.target.value)}
              />
              {errors.eventDate && <span className="deck-form__field-error" role="alert">{errors.eventDate}</span>}
            </div>
          </FormSection>

          <div className="pdf-decklist__actions">
            <ButtonComponent
              variant="primary"
              icon="mdi:download"
              loading={isGenerating}
              disabled={!isValid || progress !== 100}
              onClick={() => void handleDownload()}
            >
              {isGenerating ? 'Generating…' : !isValid ? 'Validate deck first' : 'Download PDF'}
            </ButtonComponent>
            <ButtonComponent
              variant="outline"
              icon="mdi:eye-outline"
              loading={isGenerating}
              disabled={!isValid || progress !== 100}
              onClick={() => void handleView()}
            >
              View PDF
            </ButtonComponent>
          </div>
        </div>

        <aside className="pdf-decklist__preview">
          <header className="pdf-decklist__preview-head">
            <h2>Deck preview</h2>
            {isValid && deck && (
              <span className="pdf-decklist__preview-count">
                {deck.mainDeckSize} main · {deck.fullDeck.side.length} side
              </span>
            )}
          </header>

          <div className="pdf-decklist__preview-body">
            {isValidating && (
              <div className="pdf-decklist__preview-state">
                <IconComponent icon="mdi:loading" className="pdf-decklist__spin" width={32} height={32} />
                <p>Validating deck…</p>
              </div>
            )}

            {!isValidating && !isValid && (
              <div className="pdf-decklist__preview-state">
                <IconComponent icon="mdi:cards-outline" width={40} height={40} />
                <p>No deck to preview yet.</p>
                <span>Validate a deck code to see it here.</span>
              </div>
            )}

            {!isValidating && isValid && deck && (
              <DeckListComponent convertedDeck={deck} name={`${form.firstName} ${form.lastName}`.trim()} headingTag="h3" />
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

export default PdfDecklistClient
