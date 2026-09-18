/** Public card lookups on omega-server-v3 (`GET /cards`, `GET /archetypes`). No session needed. */
import { API_URL } from '@utils/auth'
import type { CardArt } from '@utils/types'

const get = async <T>(path: string, signal?: AbortSignal): Promise<T> => {
  const res = await fetch(`${API_URL}${path}`, { signal })
  if (!res.ok) throw new Error(`GET ${path} failed with ${res.status}`)
  return res.json()
}

/** Cards whose name contains `text`. */
export const searchCards = async (text: string, limit: number, signal?: AbortSignal): Promise<CardArt[]> => {
  const { cards } = await get<{ cards: CardArt[] }>(`/cards?fname=${encodeURIComponent(text)}&limit=${limit}`, signal)
  return cards.map(({ id, name }) => ({ id, name }))
}

/** First card of an archetype, used as the deck's cover art. */
export const archetypeCover = async (archetype: string, signal?: AbortSignal): Promise<CardArt | null> => {
  const { cards } = await get<{ cards: CardArt[] }>(`/cards?archetype=${encodeURIComponent(archetype)}&limit=1`, signal)
  return cards[0] ? { id: cards[0].id, name: cards[0].name } : null
}

export const searchArchetypes = async (text: string, signal?: AbortSignal): Promise<string[]> => {
  const archetypes = await get<{ name: string }[]>(`/archetypes?q=${encodeURIComponent(text)}`, signal)
  return archetypes.map(({ name }) => name)
}
