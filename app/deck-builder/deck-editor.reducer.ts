import { addCard, moveCard, removeCard, reorder, sortZone } from '@utils/deck/model'
import { EMPTY_DECK, type CardData, type CardMap, type Deck, type Zone } from '@utils/deck/types'

export type ViewMode = 'grid' | 'list' | 'stacked'

export const HISTORY_LIMIT = 100
export const LAST_ADDED = 5

export type EditorState = {
  deck: Deck
  past: Deck[]
  future: Deck[]
  name: string
  format: number | null
  deckId: string | null
  revision: number | null
  dirty: boolean
  lastAdded: number[]
  rejected: { cardId: number; reason: 'copies' | 'full' | 'zone' } | null
}

export type EditorAction =
  | { type: 'add'; card: CardData; cards: CardMap; zone?: Zone }
  | { type: 'remove'; zone: Zone; id: number }
  | { type: 'move'; from: Zone; id: number; to: Zone; cards: CardMap }
  | { type: 'reorder'; zone: Zone; from: number; to: number }
  | { type: 'sort'; cards: CardMap }
  /** An imported deck: one undoable step, name and format kept. */
  | { type: 'replace'; deck: Deck }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'rename'; name: string }
  | { type: 'format'; format: number | null }
  | { type: 'load'; deck: Deck; name: string; format: number | null; deckId: string | null; revision: number | null; dirty?: boolean }
  /** `dirty`: the deck changed while the save was in flight. `name` / `format`: as saved (placeholder name, effective list). */
  | { type: 'saved'; deckId: string; revision: number; dirty?: boolean; name?: string; format?: number | null }

export const initialEditorState = (): EditorState => ({
  deck: EMPTY_DECK,
  past: [],
  future: [],
  name: '',
  format: null,
  deckId: null,
  revision: null,
  dirty: false,
  lastAdded: [],
  rejected: null,
})

/** Records `deck` as one history step; a same-object result is a no-op (optionally carrying a rejection). */
const commit = (s: EditorState, deck: Deck, rejected: EditorState['rejected'] = null): EditorState => {
  if (deck === s.deck) return rejected ? { ...s, rejected } : s
  return { ...s, deck, past: [...s.past, s.deck].slice(-HISTORY_LIMIT), future: [], dirty: true, rejected: null }
}

const sameDeck = (a: Deck, b: Deck) => (['main', 'extra', 'side'] as const).every((z) => a[z].join() === b[z].join())

export const editorReducer = (s: EditorState, a: EditorAction): EditorState => {
  switch (a.type) {
    case 'add': {
      const r = addCard(s.deck, a.card, a.cards, a.zone)
      if (r.rejected) return commit(s, s.deck, { cardId: a.card.id, reason: r.rejected })
      const next = commit(s, r.deck)
      return next === s ? s : { ...next, lastAdded: [a.card.id, ...next.lastAdded].slice(0, LAST_ADDED) }
    }
    case 'remove':
      return commit(s, removeCard(s.deck, a.zone, a.id))
    case 'move': {
      const r = moveCard(s.deck, a.from, a.id, a.to, a.cards)
      return commit(s, r.deck, r.rejected && { cardId: a.id, reason: r.rejected })
    }
    case 'reorder':
      return commit(s, reorder(s.deck, a.zone, a.from, a.to))
    case 'sort': {
      const sorted: Deck = {
        main: sortZone(s.deck.main, a.cards),
        extra: sortZone(s.deck.extra, a.cards),
        side: sortZone(s.deck.side, a.cards),
      }
      return commit(s, sameDeck(sorted, s.deck) ? s.deck : sorted)
    }
    case 'replace':
      return commit(s, sameDeck(a.deck, s.deck) ? s.deck : a.deck)
    case 'undo': {
      const deck = s.past[s.past.length - 1]
      if (!deck) return s
      return { ...s, deck, past: s.past.slice(0, -1), future: [s.deck, ...s.future], dirty: true, rejected: null }
    }
    case 'redo': {
      const [deck, ...future] = s.future
      if (!deck) return s
      return { ...s, deck, past: [...s.past, s.deck], future, dirty: true, rejected: null }
    }
    case 'rename':
      return { ...s, name: a.name, dirty: true }
    case 'format':
      return { ...s, format: a.format, dirty: true }
    case 'load':
      return {
        ...initialEditorState(),
        deck: a.deck,
        name: a.name,
        format: a.format,
        deckId: a.deckId,
        revision: a.revision,
        dirty: a.dirty ?? false,
      }
    case 'saved':
      return { ...s, deckId: a.deckId, revision: a.revision, dirty: a.dirty ?? false, name: a.name ?? s.name, format: a.format === undefined ? s.format : a.format }
  }
}
