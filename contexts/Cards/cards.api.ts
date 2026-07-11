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
export async function searchCards(
  params?: CardsSearchParams,
): Promise<CardsSearchResponse> {
  const method = params?.method || 'GET'
  const { method: _method, ...searchParams } = params || {}

  try {
    if (method === 'POST') {
      const body: Record<string, unknown> = {}

      if (searchParams?.q) body.q = searchParams.q
      if (searchParams?.desc) body.desc = searchParams.desc

      if (searchParams?.id !== undefined) {
        body.id = Array.isArray(searchParams.id)
          ? searchParams.id
          : searchParams.id
      }

      if (searchParams?.region) {
        body.region = searchParams.region.toUpperCase()
      }

      if (searchParams?.atkMin !== undefined) body.atkMin = searchParams.atkMin
      if (searchParams?.atkMax !== undefined) body.atkMax = searchParams.atkMax
      if (searchParams?.defMin !== undefined) body.defMin = searchParams.defMin
      if (searchParams?.defMax !== undefined) body.defMax = searchParams.defMax
      if (searchParams?.levelMin !== undefined) body.levelMin = searchParams.levelMin
      if (searchParams?.levelMax !== undefined) body.levelMax = searchParams.levelMax
      if (searchParams?.attribute) body.attribute = searchParams.attribute
      if (searchParams?.race) body.race = searchParams.race
      if (searchParams?.type) body.type = searchParams.type.toUpperCase()
      if (searchParams?.setcode) body.setcode = searchParams.setcode
      if (searchParams?.sets) body.sets = searchParams.sets

      const response = await fetch(`${API_ENDPOINTS.MAIN}/cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        throw new Error('Failed to fetch cards')
      }

      return (await response.json()) as CardsSearchResponse
    }

    const queryParams = new URLSearchParams()

    if (searchParams?.q) queryParams.append('q', searchParams.q)
    if (searchParams?.desc) queryParams.append('desc', searchParams.desc)

    if (searchParams?.id !== undefined) {
      const idValue = Array.isArray(searchParams.id)
        ? searchParams.id.join('|')
        : searchParams.id.toString()
      queryParams.append('id', idValue)
    }

    if (searchParams?.region) {
      queryParams.append('region', searchParams.region.toUpperCase())
    }

    if (searchParams?.atkMin !== undefined) {
      queryParams.append('atkMin', searchParams.atkMin.toString())
    }
    if (searchParams?.atkMax !== undefined) {
      queryParams.append('atkMax', searchParams.atkMax.toString())
    }
    if (searchParams?.defMin !== undefined) {
      queryParams.append('defMin', searchParams.defMin.toString())
    }
    if (searchParams?.defMax !== undefined) {
      queryParams.append('defMax', searchParams.defMax.toString())
    }
    if (searchParams?.levelMin !== undefined) {
      queryParams.append('levelMin', searchParams.levelMin.toString())
    }
    if (searchParams?.levelMax !== undefined) {
      queryParams.append('levelMax', searchParams.levelMax.toString())
    }
    if (searchParams?.attribute) queryParams.append('attribute', searchParams.attribute)
    if (searchParams?.race) queryParams.append('race', searchParams.race)
    if (searchParams?.type) queryParams.append('type', searchParams.type.toUpperCase())
    if (searchParams?.setcode) queryParams.append('setcode', searchParams.setcode)
    if (searchParams?.sets) queryParams.append('sets', searchParams.sets)

    const query = queryParams.toString()
    const response = await fetch(
      `${API_ENDPOINTS.MAIN}/cards${query ? `?${query}` : ''}`,
    )

    if (!response.ok) {
      throw new Error('Failed to fetch cards')
    }

    return (await response.json()) as CardsSearchResponse
  } catch (error) {
    console.error('Cards Search Error:', error)
    throw new Error('Failed to fetch cards')
  }
}
