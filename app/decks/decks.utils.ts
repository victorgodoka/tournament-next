import YGOProDeck from 'ygopro-deck-encode'
import type { SavedDeck, SavedDeckDetails } from './decks.types'

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

  if (tokens[0].startsWith('#')) {
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
