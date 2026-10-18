/**
 * Saved decks of the deck editor (DECKS_API.md). Cards are passcodes, in the order the user arranged them.
 */
import { API_URL } from '@utils/auth'

export type Visibility = 'private' | 'unlisted' | 'public'

export type DeckLabel = { name: string; artCardId: number | null }
export type DeckCounts = { main: number; extra: number; side: number }

export type SavedDeck = {
  id: string
  ownerId: string
  owner: { id: string; name: string | null }
  name: string
  notes: string
  format: number | null
  main: number[]
  extra: number[]
  side: number[]
  tags: Record<string, string[]>
  visibility: Visibility
  coverCardId: number | null
  /** Starts at 1, +1 on every successful write. */
  revision: number
  createdAt: string
  updatedAt: string
  /** The archetype name the rest of the site shows for this list, `null` without one. */
  label: DeckLabel | null
}

/** What `GET /decks/mine` lists: no cards, no notes. */
export type DeckSummary = {
  id: string
  name: string
  format: number | null
  visibility: Visibility
  revision: number
  updatedAt: string
  counts: DeckCounts
  coverCardId: number | null
  label: DeckLabel | null
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
  request<{ decks: DeckSummary[]; nextCursor: string | null }>(`/decks/mine${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`)

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
