import { DeckInfoResponse, DeckQuery, DeckSortValue } from "./decks.types"

export const DECK_COVER_FALLBACK = '/logo.png'

export const DECKS_PAGE_SIZE = 20

export type { DeckSortValue } from "./decks.types"

export const INITIAL_DECK_QUERY: DeckQuery = {
  name: undefined,
  tag: undefined,
  archetype: '',
  sortBy: 'created_at',
  order: 'desc',
  page: 1,
}

export type DeckSortOption = {
  value: DeckSortValue
  label: string
}

export const DECK_SORT_OPTIONS: DeckSortOption[] = [
  { value: 'created_at', label: 'Newest' },
  { value: 'likes', label: 'Most Liked' },
  { value: 'comments', label: 'Most Commented' },
]

export const EMPTY_DECK_INFO: DeckInfoResponse = {
  archetypes: [],
  tags: []
}

/* Mirrors the saved-decks API validation (name <= 24 chars, code >= 10). */
export const DECK_NAME_MAX = 24
export const DECK_CODE_MIN = 10
