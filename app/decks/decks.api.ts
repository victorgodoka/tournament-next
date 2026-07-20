import { API_ENDPOINTS } from '@const'
import { apiFailure, apiSuccess, isRecord, type ApiResult } from '@lib/api-result'
import { authHeader } from '@lib/auth-header'
import { extractCardsFromResponse, searchCards } from '@lib/cards.api'
import type { ConvertDeckResponse, ConvertedDeck, CreatedDeckResponse, DeckEditorValues, DeckInfoResponse, LikedResponse, PlayerDecksResponse, SavedDeck, SavedDecksProps, SavedDecksResponse } from './decks.types'
import { parsePlayerDecksResponse, parseSavedDecks } from './decks.validation'
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

export const convertDeck = async (code: string): Promise<ConvertedDeck> => {
  const url = `${API_ENDPOINTS.MAIN}/convert?code=${encodeURIComponent(code)}`
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
  const { name, tag, archetype, sortBy, order, page = 1, limit = 20 } = props

  const params = new URLSearchParams()
  if (sortBy) params.append('sortBy', sortBy.toString())
  if (order) params.append('order', order.toString())
  if (page) params.append('page', page.toString())
  if (limit) params.append('limit', limit.toString())
  if (name) params.append('name', name.toString())
  if (tag) params.append('tag', tag.toString())
  if (archetype) params.append('archetype', archetype.toString())

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

    const data: SavedDecksResponse = await response.json()

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

  const response = await fetch(`/api/decks/${deckId}/like`, { method: 'POST' })

  if (response.status === 401) {
    dispatchAuthExpired('Session expired')
    return apiFailure('You need to be logged in to like decks')
  }

  if (!response.ok) {
    return apiFailure('Failed to toggle like')
  }

  const body: LikedResponse = await response.json()
  return apiSuccess(body)
}

/** Shared plumbing for the authenticated deck mutations (create/update/delete).
 * All go through the /api/decks proxy routes so the httpOnly session cookie
 * can be forwarded as a Bearer token. */
async function mutateDeck<T>(
  url: string,
  method: 'POST' | 'PUT' | 'DELETE',
  body: unknown,
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

    const data: unknown = await response.json()

    if (!response.ok) {
      // The saved-decks API reports errors as { error } (sometimes + message).
      const message =
        isRecord(data) && typeof data.error === 'string' ? data.error : fallbackMessage
      return apiFailure(message)
    }

    return apiSuccess(data as T)
  } catch (error) {
    return apiFailure(error instanceof Error ? error.message : fallbackMessage)
  }
}

export const createDeck = (values: DeckEditorValues): Promise<ApiResult<CreatedDeckResponse>> =>
  mutateDeck('/api/decks', 'POST', values, 'Failed to create deck')

export const updateDeck = (
  deckId: number,
  values: DeckEditorValues,
): Promise<ApiResult<{ success: boolean }>> =>
  mutateDeck(`/api/decks/${deckId}`, 'PUT', values, 'Failed to save deck changes')

export const deleteDeck = (deckId: number): Promise<ApiResult<{ success: boolean }>> =>
  mutateDeck(`/api/decks/${deckId}`, 'DELETE', undefined, 'Failed to delete deck')

export const getDecksInfo = async (): Promise<ApiResult<DeckInfoResponse>> => {
  const response = await fetch(`${API_ENDPOINTS.MAIN}/saved-decks/decks/info`)

  if (!response.ok) {
    return apiFailure('Failed to get decks info')
  }

  const result: DeckInfoResponse = await response.json()
  return apiSuccess(result);
}