import { isRecord } from '@lib/api-result'
import { DECK_CODE_MIN, DECK_NAME_MAX } from './decks.const'
import type {
  Comment,
  ConvertedDeck,
  DeckEditorValues,
  DeckInfoResponse,
  LikedResponse,
  PlayerDecksResponse,
  SavedDeck,
  SavedDeckComments,
  SavedDeckDetails,
  SavedDecksResponse,
} from './decks.types'

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

/** Validates a persisted form draft before it seeds the editor — the stored
 * value is untrusted (hand-edited / schema-drifted sessionStorage). */
export function isDeckEditorValues(value: unknown): value is DeckEditorValues {
  return (
    isRecord(value) &&
    typeof value.name === 'string' &&
    typeof value.code === 'string' &&
    isStringArray(value.archetypes) &&
    isStringArray(value.tags) &&
    typeof value.private === 'boolean'
  )
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
    liked: Boolean(value.liked),
    comment_count:
      typeof value.comment_count === 'number' ? value.comment_count : undefined,
    username: typeof value.username === 'string' ? value.username : '',
    displayname: typeof value.displayname === 'string' ? value.displayname : '',
    avatar: typeof value.avatar === 'string' ? value.avatar : '',
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

export function parseSavedDecksResponse(body: unknown): SavedDecksResponse | null {
  if (!isRecord(body) || !Array.isArray(body.data) || !isRecord(body.pagination)) return null

  const { page, limit, total, totalPages } = body.pagination
  if (
    typeof page !== 'number' ||
    typeof limit !== 'number' ||
    typeof total !== 'number' ||
    typeof totalPages !== 'number'
  ) {
    return null
  }

  return {
    success: body.success === true,
    data: body.data
      .map(normalizeSavedDeck)
      .filter((deck): deck is SavedDeck => deck !== null),
    pagination: { page, limit, total, totalPages },
    filters: {
      availableArchetypes:
        isRecord(body.filters) && isStringArray(body.filters.availableArchetypes)
          ? body.filters.availableArchetypes
          : [],
    },
  }
}

export function parseDeckInfoResponse(body: unknown): DeckInfoResponse | null {
  if (!isRecord(body)) return null
  if (!Array.isArray(body.archetypes) && !Array.isArray(body.tags)) return null

  const archetypes = Array.isArray(body.archetypes)
    ? body.archetypes.filter(
        (entry): entry is { archetype: string; ids: number[] } =>
          isRecord(entry) &&
          typeof entry.archetype === 'string' &&
          Array.isArray(entry.ids) &&
          entry.ids.every((id) => typeof id === 'number'),
      )
    : []

  return {
    archetypes,
    tags: isStringArray(body.tags) ? body.tags : [],
  }
}

export function parseLikedResponse(body: unknown): LikedResponse | null {
  if (!isRecord(body) || typeof body.liked !== 'boolean' || typeof body.likes !== 'number') {
    return null
  }

  return {
    success: body.success === true,
    message: typeof body.message === 'string' ? body.message : '',
    liked: body.liked,
    likes: body.likes,
  }
}

/** Validates the flat fields the detail/edit pages actually branch on. The
 * deeply nested decoded deck is checked structurally (record + arrays) and
 * then narrowed once — its card entries are consumed defensively downstream. */
export function normalizeSavedDeckDetails(body: unknown): SavedDeckDetails | null {
  const value = isRecord(body) && isRecord(body.data) ? body.data : null
  if (!value) return null

  if (
    typeof value.id !== 'number' ||
    typeof value.name !== 'string' ||
    typeof value.user_id !== 'string' ||
    typeof value.code !== 'string' ||
    !isRecord(value.user) ||
    typeof value.user.discord_id !== 'string' ||
    !isRecord(value.decodedDeck) ||
    !Array.isArray(value.decodedDeck.archetypes)
  ) {
    return null
  }

  return value as unknown as SavedDeckDetails
}

function normalizeComment(value: unknown): Comment | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'number' || typeof value.comment !== 'string') return null
  if (!isRecord(value.user) || typeof value.user.discord_id !== 'string') return null

  return {
    id: value.id,
    deck_id: typeof value.deck_id === 'number' ? value.deck_id : 0,
    user_id: typeof value.user_id === 'string' ? value.user_id : value.user.discord_id,
    comment: value.comment,
    parent_id: typeof value.parent_id === 'number' ? value.parent_id : null,
    created_at: typeof value.created_at === 'string' ? value.created_at : '',
    updated_at: typeof value.updated_at === 'string' ? value.updated_at : '',
    user: {
      discord_id: value.user.discord_id,
      username: typeof value.user.username === 'string' ? value.user.username : '',
      avatar: typeof value.user.avatar === 'string' ? value.user.avatar : null,
      displayname:
        typeof value.user.displayname === 'string' ? value.user.displayname : null,
    },
  }
}

export function parseSavedDeckComments(body: unknown): SavedDeckComments | null {
  const list = Array.isArray(body) ? body : isRecord(body) && Array.isArray(body.data) ? body.data : null
  if (list === null) return null

  const data = list
    .map(normalizeComment)
    .filter((comment): comment is Comment => comment !== null)

  return { success: true, count: data.length, data }
}

export type DeckEditorFieldErrors = { name?: string; code?: string }

/** Client-side mirror of the saved-decks API create/update validation. */
export function validateDeckEditorValues(
  values: Pick<DeckEditorValues, 'name' | 'code'>,
): DeckEditorFieldErrors {
  const errors: DeckEditorFieldErrors = {}
  const name = values.name.trim()
  const code = values.code.trim()

  if (!name) {
    errors.name = 'Give your deck a name.'
  } else if (name.length > DECK_NAME_MAX) {
    errors.name = `Keep the name under ${DECK_NAME_MAX} characters.`
  }

  if (!code) {
    errors.code = 'Paste your deck code.'
  } else if (code.length < DECK_CODE_MIN) {
    errors.code = 'That deck code looks too short to be valid.'
  }

  return errors
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
