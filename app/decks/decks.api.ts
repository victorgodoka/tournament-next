import { API_ENDPOINTS } from '@const'
import { apiFailure, apiSuccess, type ApiResult } from '@lib/api-result'
import { extractCardsFromResponse, searchCards } from '@lib/cards.api'
import type { ConvertDeckResponse, ConvertedDeck, LikedResponse, PlayerDecksResponse, SavedDeck, SavedDecksProps, SavedDecksResponse } from './decks.types'
import { parsePlayerDecksResponse, parseSavedDecks } from './decks.validation'
import { AuthManager } from '@contexts/Auth/auth.manager'

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
  token?: string,
): Promise<ApiResult<SavedDeck[]>> {
  try {
    const headers: Record<string, string> = {}
    const url = `${API_ENDPOINTS.MAIN}/decks/user/${userId}`
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    const response = await fetch(
      url,
      { method: 'GET', headers },
    )

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

export const getSavedDecks = async (props: SavedDecksProps): Promise<ApiResult<SavedDecksResponse>> => {
  const { name, tag, archetype, sortBy, order, page = 1, limit = 20 } = props

  const params = new URLSearchParams()
  if (sortBy) params.append('sortBy', sortBy.toString())
  if (order) params.append('order', order.toString())
  if (page) params.append('page', page.toString())
  if (limit) params.append('limit', limit.toString())
  if (name) params.append('name', name.toString())
  if (tag) params.append('tag', tag.toString())
  if (archetype) params.append('archetype', archetype.toString())

  const url = `${API_ENDPOINTS.MAIN}/saved-decks/public/all?${params.toString()}`
  const response = await fetch(url)

  if (!response.ok) {
    return apiFailure('Failed to saved decks')
  }

  const data: SavedDecksResponse = await response.json()

  if (!data.success) {
    return apiFailure('Failed to saved decks')
  }

  return apiSuccess(data);
}

export const toggleLike = async (deckId: string | number): Promise<ApiResult<LikedResponse>> => {
  const token = AuthManager.getToken()
  if (!deckId || !token) {
    return apiFailure('Failed to fetch saved decks')
  }

  const url = `${API_ENDPOINTS.MAIN}/saved-decks/${deckId}/like`
  const headers: Record<string, string> = AuthManager.getAuthHeader()

  const response = await fetch(
    url,
    { method: 'POST', headers },
  )

  if (!response.ok) {
    return apiFailure('Failed to fetch saved decks')
  }

  const body: LikedResponse = await response.json()
  return apiSuccess(body)
}
