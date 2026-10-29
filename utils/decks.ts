/**
 * Saved decks of the deck editor (DECKS_API.md). Cards are passcodes, in the order the user arranged them.
 */
import { API_URL } from '@utils/auth'

export type Visibility = 'public' | 'friends' | 'private'
export const VISIBILITIES: Visibility[] = ['public', 'friends', 'private']

/** The deck's style. Not `tags`, which label single cards. */
export type DeckTag = 'competitive' | 'rogue' | 'casual'
export const DECK_TAGS: DeckTag[] = ['competitive', 'rogue', 'casual']

type DeckLabel = { name: string; artCardId: number | null }
type DeckCounts = { main: number; extra: number; side: number }
type DeckOwner = { id: string; name: string | null; avatarUrl: string | null }

/** The ranked season a deck belongs to: the banlist of that time. Not `format`, the list the editor validates against. */
export type DeckSeason = { id: number; code: string; format: 'TCG' | 'Genesys'; label: string }
export type Season = DeckSeason & { startsAt: string; endsAt: string | null }

/** "TCG · Season 3": the format, since labels repeat across queues. */
export const seasonName = (season: DeckSeason) => `${season.format} · ${season.label}`

export type SavedDeck = {
  id: string
  ownerId: string
  owner: DeckOwner
  /** A sample deck the statistics build (owned by the Duelists Unite account), not a duelist's. */
  generated: boolean
  likes: number
  name: string
  notes: string
  format: number | null
  main: number[]
  extra: number[]
  side: number[]
  tags: Record<string, string[]>
  visibility: Visibility
  coverCardId: number | null
  /** Up to 300 characters, plain text. */
  description: string
  /** Up to 5 http(s) URLs. */
  links: string[]
  deckTags: DeckTag[]
  /** Starts at 1, +1 on every successful write. */
  revision: number
  createdAt: string
  updatedAt: string
  /** The archetype name the rest of the site shows for this list, `null` without one. */
  label: DeckLabel | null
  season: DeckSeason | null
}

/** What the listings return: no cards, no notes. */
export type DeckSummary = {
  id: string
  owner: DeckOwner
  generated: boolean
  likes: number
  name: string
  format: number | null
  visibility: Visibility
  revision: number
  updatedAt: string
  counts: DeckCounts
  coverCardId: number | null
  description: string
  links: string[]
  deckTags: DeckTag[]
  label: DeckLabel | null
  season: DeckSeason | null
}

/** The deck's showcase: written by the save dialog, not part of a revision. */
export type DeckMeta = Pick<SavedDeck, 'visibility' | 'coverCardId' | 'description' | 'links' | 'deckTags'> & { seasonId: number | null }

/** `hide` leaves the sample decks out, `only` lists nothing else. */
export type GeneratedFilter = 'hide' | 'only'

/** Listing filters, ANDed. Empty values are left out. */
export type DeckFilters = {
  q?: string
  archetype?: string
  format?: number | null
  tag?: DeckTag | null
  cards?: number[]
  generated?: GeneratedFilter | null
  /** A season id, exact. */
  season?: number | null
}

export type DeckPage = { decks: DeckSummary[]; nextCursor: string | null }

/** A deck comment: the wiki's shape (WikiComment) without the author's cosmetics. */
export type DeckComment = {
  /** Bigint as a string. */
  id: string
  /** `null` on a thread; the thread's id on a reply. */
  parentId: string | null
  /** `null` once deleted. */
  author: { id: string; username: string | null; avatarUrl: string | null } | null
  /** `''` once deleted. */
  body: string
  createdAt: string
  deleted: boolean
}

type DeckThread = DeckComment & { replies: DeckComment[] }

export type DeckSocial = {
  likes: number
  /** Whether the signed-in viewer likes it; `false` signed out. */
  liked: boolean
  comments: DeckThread[]
}

export type DeckInput = {
  name: string
  notes?: string
  format: number | null
  main: number[]
  extra: number[]
  side: number[]
  tags?: Record<string, string[]>
  visibility?: Visibility
  coverCardId?: number | null
  description?: string
  links?: string[]
  deckTags?: DeckTag[]
  seasonId?: number | null
}

export type RevisionSummary = { revision: number; createdAt: string; counts: DeckCounts }

/** `visibility` and `coverCardId` are not part of a revision. */
export type DeckRevision = Pick<SavedDeck, 'name' | 'notes' | 'format' | 'main' | 'extra' | 'side' | 'tags'> & { revision: number; createdAt: string }

export class DeckApiError extends Error {
  constructor(
    public status: number,
    public code?: string,
    message?: string,
    public details?: Record<string, unknown>,
    /** `429 RATE_LIMITED` only: seconds from the `retry-after` header. */
    public retryAfter?: number,
  ) {
    super(message ?? code ?? `Decks API ${status}`)
    this.name = 'DeckApiError'
  }
}

/** `409 CONFLICT` on a stale `baseRevision`: `latest` is the deck as it is now. */
export class DeckConflictError extends DeckApiError {
  constructor(
    public latest: SavedDeck,
    code?: string,
    message?: string,
    details?: Record<string, unknown>,
  ) {
    super(409, code, message, details)
    this.name = 'DeckConflictError'
  }
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(`${API_URL}${path}`, { credentials: 'include', cache: 'no-store', ...init })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    if (res.status === 409 && body.details?.latest) throw new DeckConflictError(body.details.latest, body.error, body.message, body.details)
    throw new DeckApiError(res.status, body.error, body.message, body.details, Number(res.headers.get('retry-after')) || undefined)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

/** The content-type header only goes with a body: the server answers 400 to JSON content-type with an empty one. */
const json = (method: string, body: unknown): RequestInit => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

const path = (id: string) => `/decks/${encodeURIComponent(id)}`

/** `GET /decks/mine`: newest first, 24 a page. Pass `nextCursor` back as `cursor`. */
export const listMyDecks = (cursor?: string) =>
  request<DeckPage>(`/decks/mine${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`)

export const filterParams = (filters: DeckFilters, cursor?: string): string => {
  const params = new URLSearchParams()
  if (filters.q?.trim()) params.set('q', filters.q.trim())
  if (filters.archetype?.trim()) params.set('archetype', filters.archetype.trim())
  if (filters.format != null) params.set('format', String(filters.format))
  if (filters.tag) params.set('tag', filters.tag)
  if (filters.cards?.length) params.set('cards', filters.cards.join(','))
  if (filters.generated) params.set('generated', filters.generated)
  if (filters.season != null) params.set('season', String(filters.season))
  if (cursor) params.set('cursor', cursor)
  const query = params.toString()
  return query ? `?${query}` : ''
}

/** `GET /decks/seasons`: every ranked season, newest first, closed ones included. Empty on failure: the pickers just offer none. */
export const listSeasons = async (): Promise<Season[]> => {
  try {
    return (await request<{ seasons: Season[] }>('/decks/seasons', { cache: 'default' })).seasons
  } catch (error) {
    console.error(error)
    return []
  }
}

/** `GET /decks/public`: every public deck, newest first. */
export const listPublicDecks = (filters: DeckFilters, cursor?: string) => request<DeckPage>(`/decks/public${filterParams(filters, cursor)}`)

/** `GET /decks/user/:id`: what the viewer may see of that duelist's decks (the owner sees all). */
export const listUserDecks = (userId: string, filters: DeckFilters, cursor?: string) =>
  request<DeckPage>(`/decks/user/${encodeURIComponent(userId)}${filterParams(filters, cursor)}`)

/** `GET /decks/:id`. On the server, pass the incoming `cookie` so the owner reads a `private` deck. `null` for 404. */
export const getDeck = async (id: string, cookie?: string | null): Promise<SavedDeck | null> => {
  try {
    return await request<SavedDeck>(path(id), cookie ? { headers: { cookie } } : undefined)
  } catch (error) {
    if (error instanceof DeckApiError && error.status === 404) return null
    throw error
  }
}

/** `POST /decks` */
export const createDeck = (input: DeckInput) => request<SavedDeck>('/decks', json('POST', input))

/**
 * `PATCH /decks/:id`. `main`, `extra` and `side` travel together. A stale `baseRevision` rejects with
 * `DeckConflictError`; `force` overwrites (the overwritten revision stays in the history).
 */
export const updateDeck = (id: string, input: Partial<DeckInput>, baseRevision: number, force = false) =>
  request<SavedDeck>(path(id), json('PATCH', { ...input, baseRevision, force }))

/** `DELETE /decks/:id`: the history goes with it. */
export const deleteDeck = (id: string) => request<void>(path(id), { method: 'DELETE' })

/** `GET /decks/:id/revisions`: newest first. */
export const listRevisions = (id: string) => request<{ revisions: RevisionSummary[] }>(`${path(id)}/revisions`)

/** `GET /decks/:id/revisions/:rev` */
export const getRevision = (id: string, rev: number) => request<DeckRevision>(`${path(id)}/revisions/${rev}`)

/** `POST /decks/:id/revisions/:rev/restore`: writes that content as a new revision; never conflicts. */
export const restoreRevision = (id: string, rev: number) => request<SavedDeck>(`${path(id)}/revisions/${rev}/restore`, { method: 'POST' })

/**
 * `GET /decks/:id/social`: likes and comments (DECKS_API.md §5.11), read beside the deck. `null` on any
 * failure: a broken social API must never take the deck page down with it.
 */
export const getDeckSocial = async (id: string, cookie?: string | null): Promise<DeckSocial | null> => {
  try {
    return await request<DeckSocial>(`${path(id)}/social`, cookie ? { headers: { cookie } } : undefined)
  } catch (error) {
    if (!(error instanceof DeckApiError && error.status === 404)) console.error(error)
    return null
  }
}

export const likeDeck = (id: string) => request<{ likes: number; liked: boolean }>(`${path(id)}/like`, { method: 'PUT' })
export const unlikeDeck = (id: string) => request<{ likes: number; liked: boolean }>(`${path(id)}/like`, { method: 'DELETE' })

/** `parentId` must be a live thread: replies go one level deep. */
export const postDeckComment = (id: string, body: string, parentId?: string) =>
  request<DeckComment>(`${path(id)}/comments`, json('POST', parentId ? { body, parentId } : { body }))

/** The author or the deck's owner. */
export const deleteDeckComment = (id: string, commentId: string) => request<void>(`${path(id)}/comments/${encodeURIComponent(commentId)}`, { method: 'DELETE' })
