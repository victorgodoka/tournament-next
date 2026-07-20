'use client'

import { useId, useState, type FormEvent, type KeyboardEvent } from 'react'
import { ButtonComponent, ToggleComponent } from '@components'
import IconComponent from '../../components/icon/icon.component'
import { DECK_CODE_MIN, DECK_NAME_MAX } from './decks.const'
import { validateDeckEditorValues, type DeckEditorFieldErrors } from './decks.validation'
import type { DeckEditorValues } from './decks.types'
import './deck-editor.styles.css'

type DeckEditorProps = {
  archetypeOptions: string[]
  initialValues?: DeckEditorValues
  submitLabel: string
  submitIcon: string
  cancelHref: string
  isSubmitting?: boolean
  error?: string | null
  onSubmit: (values: DeckEditorValues) => void
}

const EMPTY_VALUES: DeckEditorValues = {
  name: '',
  code: '',
  archetypes: [],
  tags: [],
  private: false,
}

type DeckVisibility = 'public' | 'private'

const VISIBILITY_OPTIONS: { value: DeckVisibility; label: string; icon: string }[] = [
  { value: 'public', label: 'Public', icon: 'mdi:earth' },
  { value: 'private', label: 'Private', icon: 'mdi:lock-outline' },
]

type ChipFieldProps = {
  id: string
  label: string
  values: string[]
  placeholder: string
  hint: string
  options?: string[]
  onChange: (values: string[]) => void
}

/** Free-form chip list: type + Enter (or comma) adds, click a chip removes.
 * With `options`, a datalist offers suggestions and exact picks add instantly. */
const ChipFieldComponent = ({ id, label, values, placeholder, hint, options, onChange }: ChipFieldProps) => {
  const [input, setInput] = useState('')
  const listId = options ? `${id}-options` : undefined

  const addChip = (raw: string) => {
    const value = raw.trim()
    if (value && !values.includes(value)) onChange([...values, value])
    setInput('')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addChip(input)
    }
  }

  return (
    <div className="deck-form__field">
      <label htmlFor={id} className="deck-form__label">{label}</label>
      <div className="deck-form__chip-box">
        {values.map((value) => (
          <button
            key={value}
            type="button"
            className="deck-form__chip"
            onClick={() => onChange(values.filter((item) => item !== value))}
            aria-label={`Remove ${value}`}
          >
            {value}
            <IconComponent icon="mdi:close" width={13} height={13} aria-hidden />
          </button>
        ))}
        <input
          id={id}
          type="text"
          className="deck-form__chip-input"
          list={listId}
          placeholder={values.length === 0 ? placeholder : undefined}
          value={input}
          autoComplete="off"
          aria-describedby={`${id}-hint`}
          onChange={(event) => {
            const value = event.target.value
            // Picking a datalist option fills the exact value — add it right away.
            if (options?.includes(value)) addChip(value)
            else setInput(value)
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => addChip(input)}
        />
        {options ? (
          <datalist id={listId}>
            {options
              .filter((option) => !values.includes(option))
              .map((option) => (
                <option key={option} value={option} />
              ))}
          </datalist>
        ) : null}
      </div>
      <p id={`${id}-hint`} className="deck-form__hint">{hint}</p>
    </div>
  )
}

const DeckEditorComponent = ({
  archetypeOptions,
  initialValues,
  submitLabel,
  submitIcon,
  cancelHref,
  isSubmitting = false,
  error = null,
  onSubmit,
}: DeckEditorProps) => {
  const baseId = useId()
  const [values, setValues] = useState<DeckEditorValues>(initialValues ?? EMPTY_VALUES)
  const [fieldErrors, setFieldErrors] = useState<DeckEditorFieldErrors>({})

  const nameId = `${baseId}-name`
  const codeId = `${baseId}-code`

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const next = { ...values, name: values.name.trim(), code: values.code.trim() }
    const errors = validateDeckEditorValues(next)
    setFieldErrors(errors)

    const firstInvalid = errors.name ? nameId : errors.code ? codeId : null
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus()
      return
    }

    onSubmit(next)
  }

  return (
    <form className="deck-form" onSubmit={handleSubmit} noValidate>
      {error ? (
        <p className="deck-form__error" role="alert">
          <IconComponent icon="mdi:alert-circle-outline" width={16} height={16} aria-hidden />
          {error}
        </p>
      ) : null}

      <div className="deck-form__field">
        <label htmlFor={nameId} className="deck-form__label">
          Deck name <span className="deck-form__required" aria-hidden="true">*</span>
        </label>
        <input
          id={nameId}
          type="text"
          className={`deck-form__input${fieldErrors.name ? ' deck-form__input--invalid' : ''}`}
          value={values.name}
          maxLength={DECK_NAME_MAX}
          required
          autoComplete="off"
          placeholder="Blue-Eyes Control"
          aria-invalid={fieldErrors.name ? true : undefined}
          aria-describedby={fieldErrors.name ? `${nameId}-error` : undefined}
          onChange={(event) => {
            const name = event.target.value
            setValues((prev) => ({ ...prev, name }))
            setFieldErrors((prev) => (prev.name ? { ...prev, name: undefined } : prev))
          }}
        />
        <div className="deck-form__meta">
          {fieldErrors.name ? (
            <span id={`${nameId}-error`} className="deck-form__field-error" role="alert">
              {fieldErrors.name}
            </span>
          ) : (
            <span className="deck-form__hint">Shown on the community listing.</span>
          )}
          <span className="deck-form__count">
            {values.name.length}/{DECK_NAME_MAX}
          </span>
        </div>
      </div>

      <div className="deck-form__field">
        <label htmlFor={codeId} className="deck-form__label">
          Deck code <span className="deck-form__required" aria-hidden="true">*</span>
        </label>
        <textarea
          id={codeId}
          className={`deck-form__input deck-form__input--code${fieldErrors.code ? ' deck-form__input--invalid' : ''}`}
          value={values.code}
          rows={4}
          required
          minLength={DECK_CODE_MIN}
          spellCheck={false}
          placeholder="Paste your YGO Omega deck code"
          aria-invalid={fieldErrors.code ? true : undefined}
          aria-describedby={fieldErrors.code ? `${codeId}-error` : `${codeId}-hint`}
          onChange={(event) => {
            const code = event.target.value
            setValues((prev) => ({ ...prev, code }))
            setFieldErrors((prev) => (prev.code ? { ...prev, code: undefined } : prev))
          }}
        />
        {fieldErrors.code ? (
          <span id={`${codeId}-error`} className="deck-form__field-error" role="alert">
            {fieldErrors.code}
          </span>
        ) : (
          <span id={`${codeId}-hint`} className="deck-form__hint">
            Export the deck from YGO Omega and paste the code here.
          </span>
        )}
      </div>

      <ChipFieldComponent
        id={`${baseId}-archetypes`}
        label="Archetypes"
        values={values.archetypes}
        options={archetypeOptions}
        placeholder="Blue-Eyes, Kashtira…"
        hint="Pick from known archetypes or type your own — press Enter to add."
        onChange={(archetypes) => setValues((prev) => ({ ...prev, archetypes }))}
      />

      <ChipFieldComponent
        id={`${baseId}-tags`}
        label="Tags"
        values={values.tags}
        placeholder="competitive, budget, fun…"
        hint="Free-form labels to help others find this deck — press Enter to add."
        onChange={(tags) => setValues((prev) => ({ ...prev, tags }))}
      />

      <div className="deck-form__field">
        <span className="deck-form__label">Visibility</span>
        <ToggleComponent
          options={VISIBILITY_OPTIONS}
          value={values.private ? 'private' : 'public'}
          onChange={(value) => setValues((prev) => ({ ...prev, private: value === 'private' }))}
          ariaLabel="Deck visibility"
        />
        <p className="deck-form__hint">
          {values.private
            ? 'Only you can see this deck.'
            : 'Anyone can view, like and comment on this deck.'}
        </p>
      </div>

      <div className="deck-form__actions">
        <ButtonComponent type="submit" variant="primary" icon={submitIcon} loading={isSubmitting}>
          {submitLabel}
        </ButtonComponent>
        <ButtonComponent to={cancelHref} variant="ghost">
          Cancel
        </ButtonComponent>
      </div>
    </form>
  )
}

export default DeckEditorComponent
