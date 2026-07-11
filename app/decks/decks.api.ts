import { API_ENDPOINTS } from '@const'
import { apiFailure, apiSuccess, type ApiResult } from '@lib/api-result'
import type { PlayerDecksResponse, SavedDeck } from './decks.types'
import { parsePlayerDecksResponse, parseSavedDecks } from './decks.validation'

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
      `${API_ENDPOINTS.DUELISTS_UNITE_V3}/decks?${params.toString()}`,
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
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    const response = await fetch(
      `${API_ENDPOINTS.DUELISTS_UNITE_V3}/saved-decks/${userId}`,
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
