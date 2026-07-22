'use client'

import { useEffect, useRef, useState } from 'react'
import { extractCardsFromResponse, searchCards } from '@lib/cards.api'
import { cardImageUrl } from '@lib/cards.utils'
import { CARD_PLACEHOLDER_SRC } from '../profile.const'
import IconComponent from '@components/icon/icon.component'
import type { Card } from '@lib/cards.types'
import type { CardOption } from './profile-edit.types'

type FavoriteCardPickerProps = {
  id: string
  value: CardOption | null
  onChange: (value: CardOption | null) => void
}

const FavoriteCardPicker = ({ id, value, onChange }: FavoriteCardPickerProps) => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Card[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  // Debounced search — a query under 2 chars clears results rather than
  // hammering the cards endpoint on the first keystroke.
  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear stale results when the query is too short to search
      setResults([])
      return
    }

    let active = true
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const response = await searchCards({ q: term, region: 'ALL', method: 'POST' })
        if (active) setResults(extractCardsFromResponse(response).slice(0, 8))
      } catch {
        if (active) setResults([])
      } finally {
        if (active) setLoading(false)
      }
    }, 300)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [query])

  // Close the results popover on an outside click.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const select = (card: Card) => {
    onChange({ id: String(card.id), name: card.name_en || card.name_pt || `Card ${card.id}` })
    setQuery('')
    setResults([])
    setOpen(false)
  }

  return (
    <div className="favorite-picker" ref={boxRef}>
      {value ? (
        <div className="favorite-picker__selected">
          <img
            className="favorite-picker__art"
            src={cardImageUrl(Number(value.id), true)}
            alt=""
            onError={(event) => {
              event.currentTarget.src = CARD_PLACEHOLDER_SRC
            }}
          />
          <span className="favorite-picker__selected-name">{value.name}</span>
          <button
            type="button"
            className="favorite-picker__clear"
            onClick={() => onChange(null)}
            aria-label="Remove favorite card"
          >
            <IconComponent icon="mdi:close" width={16} height={16} />
          </button>
        </div>
      ) : null}

      <div className="favorite-picker__search">
        <IconComponent icon="mdi:magnify" className="favorite-picker__search-icon" width={18} height={18} />
        <input
          id={id}
          type="text"
          className="favorite-picker__input"
          placeholder={value ? 'Change favorite card…' : 'Search for a card…'}
          value={query}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-results`}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
        />
      </div>

      {open && (query.trim().length >= 2 || loading) ? (
        <ul id={`${id}-results`} className="favorite-picker__results" role="listbox">
          {loading ? (
            <li className="favorite-picker__status">Searching…</li>
          ) : results.length === 0 ? (
            <li className="favorite-picker__status">No cards found.</li>
          ) : (
            results.map((card) => (
              <li key={card.id}>
                <button type="button" className="favorite-picker__result" onClick={() => select(card)}>
                  <img
                    className="favorite-picker__result-art"
                    src={cardImageUrl(card.id, true)}
                    alt=""
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.src = CARD_PLACEHOLDER_SRC
                    }}
                  />
                  <span className="favorite-picker__result-name">
                    {card.name_en || card.name_pt || `Card ${card.id}`}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}

export default FavoriteCardPicker
