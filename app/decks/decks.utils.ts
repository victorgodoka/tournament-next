import YGOProDeck from 'ygopro-deck-encode'
import { DECK_SORT_OPTIONS, INITIAL_DECK_QUERY } from './decks.const'
import type { DeckInfoResponse, DeckQuery, SavedDeck, SavedDeckDetails } from './decks.types'

export type ParsedDeckSearch = {
  name?: string
  tags: string[]
}

/**
 * Parses the decks search box. A query starting with `#` searches tags only —
 * every token must be a `#tag`, plain words are dropped. Otherwise the leading
 * plain words become the name search, and any `#tag` tokens found afterward
 * are collected as tags; once a tag is seen, later plain words are dropped
 * since only tags are allowed past that point.
 */
export function parseDeckSearchQuery(query: string): ParsedDeckSearch {
  const tokens = query.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return { tags: [] }

  if (tokens[0]?.startsWith('#')) {
    const tags = tokens
      .filter((token) => token.startsWith('#'))
      .map((token) => token.slice(1))
      .filter(Boolean)
    return { tags }
  }

  const nameWords: string[] = []
  const tags: string[] = []
  let sawTag = false

  for (const token of tokens) {
    if (token.startsWith('#')) {
      sawTag = true
      const tag = token.slice(1)
      if (tag) tags.push(tag)
    } else if (!sawTag) {
      nameWords.push(token)
    }
  }

  return { name: nameWords.length > 0 ? nameWords.join(' ') : undefined, tags }
}

export function buildTagParam(tags: string[]): string | undefined {
  return tags.length > 0 ? tags.join(',') : undefined
}

/** Cover art passcode: explicit cover_id, else the deck's first main-deck card, else none. */
export function resolveDeckCoverId(deck: Pick<SavedDeck, 'cover_id' | 'code'>): number | null {
  if (deck.cover_id) return deck.cover_id
  if (!deck.code) return null

  try {
    return YGOProDeck.fromEncodedString(deck.code).main[0] ?? null
  } catch {
    return null
  }
}

export function getDeckCreatorName(deck: Pick<SavedDeck, 'displayname' | 'username'> | Pick<SavedDeckDetails["user"], 'displayname' | 'username'>): string {
  return deck.displayname || deck.username || 'Unknown duelist'
}

/** Distinct archetype names for filter/suggestion UIs — the info endpoint
 * repeats some names, so dedupe before listing them. */
export function getArchetypeOptions(info: DeckInfoResponse): string[] {
  return [...new Set(info.archetypes?.map((a) => a.archetype) ?? [])]
}

type RawSearchParams = Record<string, string | string[] | undefined>

/** searchParams values can arrive as arrays (`?x=a&x=b`) — take the first. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

/** Rebuild the listing query from URL search params, ignoring invalid values. */
export function parseDeckQueryParams(params: RawSearchParams): DeckQuery {
  const sortBy = firstParam(params.sortBy)
  const order = firstParam(params.order)
  const page = Number(firstParam(params.page))
  const sortOption = DECK_SORT_OPTIONS.find((option) => option.value === sortBy)

  return {
    name: firstParam(params.name) || undefined,
    tag: firstParam(params.tag) || undefined,
    archetype: firstParam(params.archetype) ?? '',
    sortBy: sortOption?.value ?? INITIAL_DECK_QUERY.sortBy,
    order: order === 'asc' || order === 'desc' ? order : INITIAL_DECK_QUERY.order,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  }
}

/** URL for a listing query — default values are omitted so `/decks` stays clean. */
export function buildDecksUrl(query: DeckQuery): string {
  const params = new URLSearchParams()
  if (query.name) params.set('name', query.name)
  if (query.tag) params.set('tag', query.tag)
  if (query.archetype) params.set('archetype', query.archetype)
  if (query.sortBy !== INITIAL_DECK_QUERY.sortBy) params.set('sortBy', query.sortBy)
  if (query.order !== INITIAL_DECK_QUERY.order) params.set('order', query.order)
  if (query.page > 1) params.set('page', String(query.page))

  const search = params.toString()
  return search ? `/decks?${search}` : '/decks'
}

/** The search-box text that reproduces a query's name/tag filters. */
export function buildSearchInput(query: Pick<DeckQuery, 'name' | 'tag'>): string {
  const tags = query.tag ? query.tag.split(',').map((tag) => `#${tag}`) : []
  return [query.name, ...tags].filter(Boolean).join(' ')
}
