import { API_ENDPOINTS } from '@const'
import { fetchJson } from '@lib/api-fetch'
import { apiFailure, apiSuccess, isRecord, type ApiResult } from '@lib/api-result'
import { authHeader } from '@lib/auth-header'
import { extractCardsFromResponse, searchCards } from '@lib/cards.api'
import { DECKS_PAGE_SIZE } from './decks.const'
import type { ConvertDeckResponse, ConvertedDeck, DeckEditorValues, DeckInfoResponse, LikedResponse, PlayerDecksResponse, SavedDeck, SavedDecksProps, SavedDecksResponse } from './decks.types'
import {
  parseDeckInfoResponse,
  parseLikedResponse,
  parsePlayerDecksResponse,
  parseSavedDecks,
  parseSavedDecksResponse,
} from './decks.validation'
import { dispatchAuthExpired } from '@contexts/Auth/auth.events'

export async function getPlayerDecks(
  discordId: string,
  options?: { tcgPage?: number; genesysPage?: number },
): Promise<ApiResult<PlayerDecksResponse>> {
  try {
    const params = new URLSearchParams()
    params.append('id', discordId)

    if (options?.tcgPage !== undefined) {
      params.append('tcgPage', options.tcgPage.toString())
    }

    if (options?.genesysPage !== undefined) {
      params.append('genesysPage', options.genesysPage.toString())
    }

    const response = await fetch(
      `${API_ENDPOINTS.MAIN}/decks?${params.toString()}`,
    )

    if (!response.ok) {
      return apiFailure('Failed to fetch player decks')
    }

    const body: unknown = await response.json()
    const data = parsePlayerDecksResponse(body)

    if (!data) {
      return apiFailure('Invalid player decks response')
    }

    return apiSuccess(data)
  } catch (error) {
    return apiFailure(
      error instanceof Error ? error.message : 'Failed to fetch player decks',
    )
  }
}

export async function getUserDecks(
  userId: string,
  includeAuth = false,
): Promise<ApiResult<SavedDeck[]>> {
  try {
    const url = `/api/decks/user/${encodeURIComponent(userId)}${includeAuth ? '?auth=1' : ''}`
    const response = await fetch(url)

    if (includeAuth && response.status === 401) {
      dispatchAuthExpired('Session expired')
    }

    if (!response.ok) {
      return apiFailure('Failed to fetch saved decks')
    }

    const body: unknown = await response.json()
    const decks = parseSavedDecks(body)

    if (!decks) {
      return apiFailure('Invalid saved decks response')
    }

    return apiSuccess(decks)
  } catch (error) {
    console.error('Get User Decks Error:', error)
    return apiFailure(
      error instanceof Error ? error.message : 'Unknown error',
    )
  }
}

export const convertDeck = async (code: string, full?: boolean): Promise<ConvertedDeck> => {
  const url = `${API_ENDPOINTS.MAIN}/convert?code=${encodeURIComponent(code)}${full ? "&full=y" : ""}`
  const convertedDeckResponse = await fetch(url, { method: 'GET' })
  if (!convertedDeckResponse.ok) {
    throw new Error('Failed to convert deck')
  }

  const { success, data: convertedDeck }: ConvertDeckResponse = await convertedDeckResponse.json()
  if (!success) {
    throw new Error('Failed to convert deck')
  }

  // The convert endpoint returns card ids but omits full card data, so hydrate
  // it here from the cards endpoint. Failures degrade gracefully to an empty
  // array (the deck still renders by id, just without names/types).
  if (!convertedDeck.uniqueCardsData?.length && convertedDeck.uniqueCards?.length) {
    convertedDeck.uniqueCardsData = await fetchDeckCards(convertedDeck.uniqueCards)
  } else if (!convertedDeck.uniqueCardsData) {
    convertedDeck.uniqueCardsData = []
  }

  return convertedDeck;
}

const fetchDeckCards = async (ids: number[]): Promise<ConvertedDeck['uniqueCardsData']> => {
  try {
    const response = await searchCards({ id: ids, region: 'ALL', method: 'POST' })
    return extractCardsFromResponse(response)
  } catch (error) {
    console.error('Convert Deck: failed to hydrate card data', error)
    return []
  }
}

export const getSavedDecks = async (
  props: SavedDecksProps,
  token?: string | null,
): Promise<ApiResult<SavedDecksResponse>> => {
  const { name, tag, archetype, sortBy, order, page = 1, limit = DECKS_PAGE_SIZE } = props

  const params = new URLSearchParams()
  if (sortBy) params.append('sortBy', sortBy)
  if (order) params.append('order', order)
  params.append('page', String(page))
  params.append('limit', String(limit))
  if (name) params.append('name', name)
  if (tag) params.append('tag', tag)
  if (archetype) params.append('archetype', archetype)

  // Server callers pass the session token (string or null) and hit the upstream
  // API directly with a Bearer header. Client callers omit the argument and go
  // through the proxy route, which injects the httpOnly cookie the browser can't
  // read — both paths let the response carry `liked` for the current user.
  const url =
    token === undefined
      ? `/api/decks/public?${params.toString()}`
      : `${API_ENDPOINTS.MAIN}/saved-decks/public/all?${params.toString()}`

  try {
    const response = await fetch(url, { headers: authHeader(token) })

    if (!response.ok) {
      return apiFailure('Failed to fetch saved decks')
    }

    const data = parseSavedDecksResponse(await response.json())

    if (!data) {
      return apiFailure('Invalid saved decks response')
    }

    return apiSuccess(data)
  } catch (error) {
    console.error('Get Saved Decks Error:', error)
    return apiFailure(
      error instanceof Error ? error.message : 'Failed to fetch saved decks',
    )
  }
}

export const toggleLike = async (deckId: string | number): Promise<ApiResult<LikedResponse>> => {
  if (!deckId) {
    return apiFailure('Deck id is required')
  }

  try {
    const response = await fetch(`/api/decks/${deckId}/like`, { method: 'POST' })

    if (response.status === 401) {
      dispatchAuthExpired('Session expired')
      return apiFailure('You need to be logged in to like decks')
    }

    if (!response.ok) {
      return apiFailure('Failed to toggle like')
    }

    const body = parseLikedResponse(await response.json())
    return body ? apiSuccess(body) : apiFailure('Failed to toggle like')
  } catch (error) {
    return apiFailure(
      error instanceof Error ? error.message : 'Failed to toggle like',
    )
  }
}

/** Shared plumbing for the authenticated deck mutations (create/update/delete).
 * All go through the /api/decks proxy routes so the httpOnly session cookie
 * can be forwarded as a Bearer token. Responses are validated via `parse` —
 * an unexpected upstream shape becomes a failure, never a lied-about `T`. */
async function mutateDeck<T>(
  url: string,
  method: 'POST' | 'PUT' | 'DELETE',
  body: unknown,
  parse: (data: unknown) => T | null,
  fallbackMessage: string,
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      method,
      ...(body !== undefined
        ? {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }
        : {}),
    })

    if (response.status === 401) {
      dispatchAuthExpired('Session expired')
      return apiFailure('You need to be logged in to manage decks')
    }

    // Guard against non-JSON upstream bodies (gateway HTML, empty responses).
    const data: unknown = await response.json().catch(() => null)

    if (!response.ok) {
      // The saved-decks API reports errors as { error } (sometimes + message).
      const message =
        isRecord(data) && typeof data.error === 'string' ? data.error : fallbackMessage
      return apiFailure(message)
    }

    const parsed = parse(data)
    if (parsed === null) {
      return apiFailure(fallbackMessage)
    }

    return apiSuccess(parsed)
  } catch (error) {
    return apiFailure(error instanceof Error ? error.message : fallbackMessage)
  }
}

const parseCreatedDeckId = (data: unknown): { id: number } | null =>
  isRecord(data) && isRecord(data.data) && typeof data.data.id === 'number'
    ? { id: data.data.id }
    : null

const parseMutationSuccess = (data: unknown): { success: true } | null =>
  isRecord(data) && data.success === true ? { success: true } : null

export const createDeck = (values: DeckEditorValues): Promise<ApiResult<{ id: number }>> =>
  mutateDeck('/api/decks', 'POST', values, parseCreatedDeckId, 'Failed to create deck')

export const updateDeck = (
  deckId: number,
  values: DeckEditorValues,
): Promise<ApiResult<{ success: true }>> =>
  mutateDeck(`/api/decks/${deckId}`, 'PUT', values, parseMutationSuccess, 'Failed to save deck changes')

export const deleteDeck = (deckId: number): Promise<ApiResult<{ success: true }>> =>
  mutateDeck(`/api/decks/${deckId}`, 'DELETE', undefined, parseMutationSuccess, 'Failed to delete deck')

export const getDecksInfo = (): Promise<ApiResult<DeckInfoResponse>> =>
  // Archetype/tag metadata is public and slow-moving — cache it so the decks
  // browse, create and edit pages don't each re-hit the upstream per request.
  fetchJson(`${API_ENDPOINTS.MAIN}/saved-decks/decks/info`, {
    revalidate: 3600,
    parse: parseDeckInfoResponse,
    errorMessage: 'Failed to get decks info',
  })