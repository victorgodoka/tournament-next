export const DECK_COVER_FALLBACK = '/logo.png'

export type DeckSortValue = 'created_at' | 'likes' | 'comments'

export type DeckSortOption = {
  value: DeckSortValue
  label: string
}

export const DECK_SORT_OPTIONS: DeckSortOption[] = [
  { value: 'created_at', label: 'Newest' },
  { value: 'likes', label: 'Most Liked' },
  { value: 'comments', label: 'Most Commented' },
]
