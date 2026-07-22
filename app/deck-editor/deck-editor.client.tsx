'use client'

import { useCallback, useEffect, useMemo, useReducer, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import YGOProDeck from 'ygopro-deck-encode'
import type { Card } from '@lib/cards.types'
import { extractCardsFromResponse, searchCards } from '@lib/cards.api'
import ButtonComponent from '@components/button/button.component'
import IconComponent from '@components/icon/icon.component'
import { editorReducer, initialState } from './deck-editor.reducer'
import { defaultZone, toConvertBody, validateDeck, zoneCopies } from './deck-editor.utils'
import { DRAFT_KEY, PREVIEW_KEY } from './deck-editor.const'
import type { DeckFormat, DeckZone, EditorState } from './deck-editor.types'
import CardSearchPanel from './card-search-panel.component'
import DeckPanelComponent from './deck-panel.component'
import CardDetailModal from './card-detail-modal.component'
import DeckImportDialog from './deck-import-dialog.component'
import type { DragPayload } from './deck-zone.component'
import './deck-editor.styles.css'

type MobileTab = 'browse' | 'deck'

const DeckEditorClient = () => {
  const router = useRouter()
  const [state, dispatch] = useReducer(editorReducer, undefined, () => initialState('tcg'))
  const [name, setName] = useState('')
  const [modalCard, setModalCard] = useState<Card | null>(null)
  const [mobileTab, setMobileTab] = useState<MobileTab>('browse')

  const [importOpen, setImportOpen] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importing, startImport] = useTransition()

  const validation = useMemo(() => validateDeck(state), [state])

  // Restore an in-progress draft once on mount (after hydration, to avoid a
  // server/client mismatch).
  useEffect(() => {
    const restore = () => {
      try {
        const raw = localStorage.getItem(DRAFT_KEY)
        if (!raw) return
        const parsed = JSON.parse(raw) as EditorState & { name?: string }
        if (Array.isArray(parsed.main) && parsed.cards) {
          const { name: savedName, ...deck } = parsed
          dispatch({ type: 'hydrate', state: deck })
          if (savedName) setName(savedName)
        }
      } catch {
        /* corrupt draft — ignore */
      }
    }
    restore()
  }, [])

  // Persist the draft (debounced) so a refresh never loses the build.
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...state, name }))
      } catch {
        /* storage full or blocked — non-fatal */
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [state, name])

  const handleOpen = useCallback((card: Card) => setModalCard(card), [])
  const handleAdd = useCallback((card: Card) => dispatch({ type: 'add', card }), [])
  const handleIncrement = useCallback(
    (zone: DeckZone, card: Card) => dispatch({ type: 'add', card, zone }),
    [],
  )
  const handleDecrement = useCallback(
    (zone: DeckZone, id: number) => dispatch({ type: 'remove', zone, id }),
    [],
  )

  // Remove one copy from wherever the card lives, preferring its natural zone.
  const handleRemove = useCallback(
    (card: Card) => {
      const dz = defaultZone(card)
      const order: DeckZone[] = dz === 'main' ? ['main', 'side', 'extra'] : ['extra', 'side', 'main']
      for (const zone of order) {
        if (zoneCopies(state[zone], card.id) > 0) {
          dispatch({ type: 'remove', zone, id: card.id })
          return
        }
      }
    },
    [state],
  )

  const handleDrop = useCallback((target: DeckZone, payload: DragPayload) => {
    if (payload.source === 'grid') {
      dispatch({ type: 'add', card: payload.card, zone: target })
    } else if (payload.source !== target) {
      dispatch({ type: 'move', from: payload.source, to: target, id: payload.card.id })
    }
  }, [])

  const handleFormat = useCallback((format: DeckFormat) => dispatch({ type: 'setFormat', format }), [])

  const handleClear = () => {
    if (window.confirm('Clear the entire deck? This cannot be undone.')) dispatch({ type: 'clear' })
  }

  const handleExport = () => {
    const payload = { ...toConvertBody(state), name: name.trim() || 'Untitled Deck', format: state.format }
    try {
      sessionStorage.setItem(PREVIEW_KEY, JSON.stringify(payload))
    } catch {
      /* ignore */
    }
    router.push('/deck-editor/preview')
  }

  const handleImport = (value: string) => {
    setImportError(null)
    startImport(async () => {
      try {
        const deck = YGOProDeck.fromYdkeURL(value)
        const ids = [...deck.main, ...deck.extra, ...deck.side]
        if (ids.length === 0) throw new Error('empty')
        const response = await searchCards({ id: [...new Set(ids)], region: 'ALL', method: 'POST' })
        const cards: Record<number, Card> = {}
        for (const card of extractCardsFromResponse(response)) {
          cards[card.id] = card
          if (card.canonicalId !== undefined && cards[card.canonicalId] === undefined) {
            cards[card.canonicalId] = card
          }
        }
        dispatch({
          type: 'hydrate',
          state: { format: state.format, main: deck.main, extra: deck.extra, side: deck.side, cards },
        })
        setImportOpen(false)
      } catch {
        setImportError("That doesn't look like a valid YDKE URL.")
      }
    })
  }

  const handleModalAdd = useCallback(
    (zone: DeckZone, card: Card) => dispatch({ type: 'add', card, zone }),
    [],
  )

  return (
    <div className="deck-editor" data-mobile-tab={mobileTab}>
      <header className="deck-editor__toolbar">
        <div className="deck-editor__identity">
          <ButtonComponent variant="ghost" size="sm" icon="mdi:arrow-left" to="/" aria-label="Back to home" />
          <input
            className="deck-editor__name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Untitled Deck"
            aria-label="Deck name"
          />
          <span className={`deck-editor__badge${validation.isLegal ? ' deck-editor__badge--ok' : ''}`}>
            {validation.isLegal ? 'Legal' : 'Draft'}
          </span>
        </div>

        <div className="deck-editor__actions">
          <ButtonComponent variant="ghost" size="sm" icon="mdi:refresh" onClick={handleClear}>
            <span className="deck-editor__action-label">Clear</span>
          </ButtonComponent>
          <ButtonComponent variant="outline" size="sm" icon="mdi:import" onClick={() => setImportOpen(true)}>
            <span className="deck-editor__action-label">Import</span>
          </ButtonComponent>
          <ButtonComponent variant="secondary" size="sm" icon="mdi:tray-arrow-down" onClick={handleExport}>
            <span className="deck-editor__action-label">Export</span>
          </ButtonComponent>
          <ButtonComponent variant="primary" size="sm" icon="mdi:content-save-outline" onClick={handleExport}>
            Save
          </ButtonComponent>
        </div>
      </header>

      <div className="deck-editor__mobile-tabs" role="tablist" aria-label="Editor view">
        <button
          type="button" role="tab" aria-selected={mobileTab === 'browse'}
          className={`deck-editor__tab${mobileTab === 'browse' ? ' deck-editor__tab--active' : ''}`}
          onClick={() => setMobileTab('browse')}
        >
          <IconComponent icon="mdi:view-grid-outline" width={17} height={17} />
          Browse
        </button>
        <button
          type="button" role="tab" aria-selected={mobileTab === 'deck'}
          className={`deck-editor__tab${mobileTab === 'deck' ? ' deck-editor__tab--active' : ''}`}
          onClick={() => setMobileTab('deck')}
        >
          <IconComponent icon="mdi:cards-outline" width={17} height={17} />
          Deck
          <span className="deck-editor__tab-count">{validation.counts.main + validation.counts.extra + validation.counts.side}</span>
        </button>
      </div>

      <div className="deck-editor__body">
        <div className="deck-editor__browse">
          <CardSearchPanel state={state} onOpen={handleOpen} onAdd={handleAdd} onRemove={handleRemove} />
        </div>
        <div className="deck-editor__deck">
          <DeckPanelComponent
            state={state}
            validation={validation}
            onFormatChange={handleFormat}
            onOpen={handleOpen}
            onIncrement={handleIncrement}
            onDecrement={handleDecrement}
            onDrop={handleDrop}
          />
        </div>
      </div>

      <CardDetailModal
        card={modalCard}
        state={state}
        onClose={() => setModalCard(null)}
        onAdd={handleModalAdd}
      />
      <DeckImportDialog
        open={importOpen}
        loading={importing}
        error={importError}
        onClose={() => setImportOpen(false)}
        onImport={handleImport}
      />
    </div>
  )
}

export default DeckEditorClient
