import { API_ENDPOINTS } from '@const'
import { isRecord } from '@lib/api-result'
import type { Card, CardsSearchParams, CardsSearchResponse } from './cards.types'

export function extractCardsFromResponse(
  response: CardsSearchResponse,
): Card[] {
  if (response.data?.cards) {
    return response.data.cards
  }

  const nested = response.data as unknown
  if (
    isRecord(nested) &&
    isRecord(nested.data) &&
    Array.isArray(nested.data.cards)
  ) {
    return nested.data.cards as Card[]
  }

  return []
}

/** Collect the defined search fields once — POST sends them as JSON,
 * GET stringifies them into the query (arrays join with `|`). */
function buildSearchFields(params: CardsSearchParams): Record<string, string | number | Array<number | string>> {
  const fields: Record<string, string | number | Array<number | string>> = {}

  if (params.q) fields.q = params.q
  if (params.fname) fields.fname = params.fname
  if (params.desc) fields.desc = params.desc
  if (params.id !== undefined) fields.id = params.id
  if (params.ids !== undefined) fields.ids = params.ids
  if (params.region) fields.region = params.region.toUpperCase()
  if (params.atkMin !== undefined) fields.atkMin = params.atkMin
  if (params.atkMax !== undefined) fields.atkMax = params.atkMax
  if (params.defMin !== undefined) fields.defMin = params.defMin
  if (params.defMax !== undefined) fields.defMax = params.defMax
  if (params.levelMin !== undefined) fields.levelMin = params.levelMin
  if (params.levelMax !== undefined) fields.levelMax = params.levelMax
  if (params.attribute) fields.attribute = params.attribute
  if (params.race) fields.race = params.race
  if (params.type) fields.type = params.type.toUpperCase()
  if (params.pScale !== undefined) fields.pScale = params.pScale
  if (params.setcode) fields.setcode = params.setcode
  if (params.sets) fields.sets = params.sets
  if (params.page !== undefined) fields.page = params.page
  if (params.pageSize !== undefined) fields.pageSize = params.pageSize

  return fields
}

export async function searchCards(
  params: CardsSearchParams = {},
): Promise<CardsSearchResponse> {
  const { method = 'GET' } = params
  const fields = buildSearchFields(params)

  try {
    const response =
      method === 'POST'
        ? await fetch(`${API_ENDPOINTS.MAIN}/cards`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fields),
          })
        : await fetch(buildGetUrl(fields))

    if (!response.ok) {
      throw new Error('Failed to fetch cards')
    }

    return (await response.json()) as CardsSearchResponse
  } catch (error) {
    console.error('Cards Search Error:', error)
    throw new Error('Failed to fetch cards', { cause: error })
  }
}

function buildGetUrl(fields: Record<string, string | number | Array<number | string>>): string {
  const queryParams = new URLSearchParams()
  for (const [key, value] of Object.entries(fields)) {
    queryParams.append(key, Array.isArray(value) ? value.join('|') : String(value))
  }
  const query = queryParams.toString()
  return `${API_ENDPOINTS.MAIN}/cards${query ? `?${query}` : ''}`
}
