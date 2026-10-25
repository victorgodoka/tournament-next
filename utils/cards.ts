/** Public card lookups on omega-server-v3 (`GET /cards`, `GET /archetypes`). No session needed. */
import { API_URL } from '@utils/auth'
import type { CardArt } from '@utils/types'
import type { CardKind, WikiCard } from '@utils/wiki'

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

export type Archetype = { code: number; name: string }

/** With their setcode, for the places that store the code rather than the name. */
export const findArchetypes = async (text: string, signal?: AbortSignal): Promise<Archetype[]> => {
  const archetypes = await get<Archetype[]>(`/archetypes?q=${encodeURIComponent(text)}`, signal)
  return archetypes.map(({ code, name }) => ({ code, name }))
}

export const searchArchetypes = async (text: string, signal?: AbortSignal): Promise<string[]> =>
  (await findArchetypes(text, signal)).map(({ name }) => name)

/** A card and every artwork it has: its own passcode first, then the alternates. */
export type CardArts = { id: number; name: string; arts: number[] }

/**
 * By name, or by passcode when `text` is all digits. An alternate artwork's passcode resolves to the
 * original card, which then lists every artwork anyway.
 */
export const searchCardArts = async (text: string, limit: number, signal?: AbortSignal): Promise<CardArts[]> => {
  const query = /^\d+$/.test(text) ? `id=${text}` : `fname=${encodeURIComponent(text)}&limit=${limit}`
  const { cards } = await get<{ cards: { id: number; name: string; alternateArts: number[] }[] }>(`/cards?${query}`, signal)
  return cards.map(({ id, name, alternateArts }) => ({ id, name, arts: [id, ...alternateArts] }))
}

/** The deck editor's card-pool filters. Keys mirror the API's `GET /cards` parameters. */
export type PoolQuery = {
  /** Part of the name (`fname`) and part of the card text (`q`); both narrow the pool together. */
  name: string
  text: string
  kind: CardKind[]
  extraDeck?: boolean
  attribute: string[]
  archetype?: string
  types: string[]
  race: string[]
  levelMin?: number
  levelMax?: number
  atkMin?: number
  atkMax?: number
  defMin?: number
  defMax?: number
  scaleMin?: number
  scaleMax?: number
  linkMarkers: string[]
  banlist?: number
  legalOnly: boolean
  status: string[]
  pointsMin?: number
  pointsMax?: number
  /** Release region; the window below is sent only with it, since the API rejects dates alone. */
  format?: 'tcg' | 'ocg'
  releasedAfter?: string
  releasedBefore?: string
  sort: 'name' | 'atk' | 'def' | 'level' | 'released_tcg' | 'released_ocg'
  order: 'asc' | 'desc'
}

export const EMPTY_POOL_QUERY: PoolQuery = {
  name: '',
  text: '',
  kind: [],
  attribute: [],
  types: [],
  race: [],
  linkMarkers: [],
  legalOnly: true,
  status: [],
  sort: 'name',
  order: 'asc',
}

export const POOL_PAGE = 60

/** Empty filters are left out; `legal` and `status` are too without a banlist, which the API rejects. */
export const poolParams = (q: PoolQuery, page: number): URLSearchParams => {
  const params = new URLSearchParams()
  const set = (key: string, value: string | number | boolean | readonly string[] | undefined) => {
    if (value === undefined || value === '' || (Array.isArray(value) && !value.length)) return
    params.set(key, String(value))
  }
  const listed = q.banlist !== undefined
  set('fname', q.name.trim())
  set('q', q.text.trim())
  set('kind', q.kind)
  set('extraDeck', q.extraDeck)
  set('attribute', q.attribute)
  set('archetype', q.archetype)
  set('types', q.types)
  set('race', q.race)
  set('levelMin', q.levelMin)
  set('levelMax', q.levelMax)
  set('atkMin', q.atkMin)
  set('atkMax', q.atkMax)
  set('defMin', q.defMin)
  set('defMax', q.defMax)
  set('scaleMin', q.scaleMin)
  set('scaleMax', q.scaleMax)
  set('linkMarkers', q.linkMarkers)
  set('banlist', q.banlist)
  if (listed) {
    set('legal', q.legalOnly || undefined)
    set('status', q.status)
    set('pointsMin', q.pointsMin)
    set('pointsMax', q.pointsMax)
  }
  if (q.format) {
    set('format', q.format)
    set('releasedAfter', q.releasedAfter)
    set('releasedBefore', q.releasedBefore)
  }
  set('sort', q.sort)
  set('order', q.order)
  params.set('page', String(page))
  params.set('limit', String(POOL_PAGE))
  return params
}

/** One page of the pool, with the total match count for the paginator. */
export const queryCards = async (q: PoolQuery, page: number, signal?: AbortSignal): Promise<{ cards: WikiCard[]; total: number }> =>
  get(`/cards?${poolParams(q, page)}`, signal)

const ID_CHUNK = 100

/** Keyed by the passcode asked for (`idSearched`), so an alternate artwork resolves to its card. Unknown ids are absent. */
export const cardsByIds = async (ids: readonly number[], signal?: AbortSignal): Promise<Map<number, WikiCard>> => {
  const unique = [...new Set(ids)]
  const chunks = Array.from({ length: Math.ceil(unique.length / ID_CHUNK) }, (_, i) => unique.slice(i * ID_CHUNK, (i + 1) * ID_CHUNK))
  const pages = await Promise.all(
    chunks.map(async (chunk) => ({
      chunk,
      ...(await get<{ cards: (WikiCard & { idSearched: number })[] }>(`/cards?id=${chunk.join(',')}&limit=${ID_CHUNK}`, signal)),
    })),
  )
  const map = new Map<number, WikiCard>()
  for (const { chunk, cards } of pages)
    for (const { idSearched, ...rest } of cards) {
      const card = rest as WikiCard
      map.set(idSearched, card)
      // Passcodes of one card come back once, under a single idSearched: map the other requested ones too.
      const own = [card.id, ...(card.alternateArts ?? [])]
      for (const id of chunk) if (own.includes(id)) map.set(id, card)
    }
  return map
}
