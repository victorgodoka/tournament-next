import { isRecord } from '@lib/api-result'
import type { PlayerDecksResponse, SavedDeck } from './decks.types'

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

export function normalizeSavedDeck(value: unknown): SavedDeck | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'number' || typeof value.name !== 'string') return null

  return {
    id: value.id,
    user_id: typeof value.user_id === 'string' ? value.user_id : '',
    code: typeof value.code === 'string' ? value.code : '',
    name: value.name,
    cover_id:
      typeof value.cover_id === 'number' || value.cover_id === null
        ? value.cover_id
        : null,
    archetypes: isStringArray(value.archetypes) ? value.archetypes : [],
    tags: isStringArray(value.tags) ? value.tags : [],
    private: Boolean(value.private),
    created_at: typeof value.created_at === 'string' ? value.created_at : '',
    updated_at: typeof value.updated_at === 'string' ? value.updated_at : '',
    likes: typeof value.likes === 'number' ? value.likes : undefined,
    comment_count:
      typeof value.comment_count === 'number' ? value.comment_count : undefined,
  }
}

export function parseSavedDecks(body: unknown): SavedDeck[] | null {
  if (Array.isArray(body)) {
    const decks = body
      .map(normalizeSavedDeck)
      .filter((deck): deck is SavedDeck => deck !== null)
    return decks
  }

  if (!isRecord(body)) return null

  if (Array.isArray(body.data)) {
    const decks = body.data
      .map(normalizeSavedDeck)
      .filter((deck): deck is SavedDeck => deck !== null)
    return decks
  }

  if (Array.isArray(body.decks)) {
    const decks = body.decks
      .map(normalizeSavedDeck)
      .filter((deck): deck is SavedDeck => deck !== null)
    return decks
  }

  return null
}

function hasProfileStatsShape(value: unknown): value is PlayerDecksResponse {
  if (!isRecord(value)) return false
  return 'tcg' in value && 'genesys' in value
}

export function parsePlayerDecksResponse(body: unknown): PlayerDecksResponse | null {
  if (!isRecord(body)) return null

  if (hasProfileStatsShape(body)) {
    return body
  }

  if ('data' in body && hasProfileStatsShape(body.data)) {
    return body.data
  }

  return null
}
