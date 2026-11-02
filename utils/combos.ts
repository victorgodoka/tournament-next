/**
 * Saved combos of the simulator and their share links. Same shape as `decks.ts`: one `request`, one `json`.
 */
import { API_URL } from '@utils/auth'
import type { ComboPayload, ComboVisibility } from '@utils/simulator/types'

/** What a save writes. `PATCH` replaces the whole combo, so an update sends all three again. Without `visibility` it keeps its own. */
export type ComboInput = { title: string; deckId: string | null; payload: ComboPayload; visibility?: ComboVisibility }

/** A row of `GET /combos/mine`: no payload. `steps` is the number of actions. */
export type ComboSummary = { id: string; title: string; deckName: string; steps: number; visibility: ComboVisibility; updatedAt: string }

/** A row of `GET /combos/public`. */
export type PublicCombo = ComboSummary & { owner: { id: string; name: string | null } }

/** `GET /combos/:id`: what a share link opens. `revision` is the `baseRevision` of the next update. */
export type SharedCombo = {
  id: string
  title: string
  deckId: string | null
  owner: { id: string; name: string | null }
  payload: ComboPayload
  visibility: ComboVisibility
  revision: number
  updatedAt: string
}

export type ComboPage<T = ComboSummary> = { combos: T[]; nextCursor: string | null }

/** `409 LIMIT` (500 combos) has `code: 'LIMIT'`; `413` is `PAYLOAD_TOO_LARGE`; `401` is signed out. */
export class ComboApiError extends Error {
  constructor(
    public status: number,
    public code?: string,
    message?: string,
    public details?: Record<string, unknown>,
  ) {
    super(message ?? code ?? `Combos API ${status}`)
    this.name = 'ComboApiError'
  }
}

/** `409 CONFLICT` on a stale `baseRevision`: `revision` is the one the server holds now. */
export class ComboConflictError extends ComboApiError {
  constructor(
    public revision: number,
    code?: string,
    message?: string,
    details?: Record<string, unknown>,
  ) {
    super(409, code, message, details)
    this.name = 'ComboConflictError'
  }
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(`${API_URL}${path}`, { credentials: 'include', cache: 'no-store', ...init })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    if (res.status === 409 && body.error === 'CONFLICT' && typeof body.details?.revision === 'number') {
      throw new ComboConflictError(body.details.revision, body.error, body.message, body.details)
    }
    throw new ComboApiError(res.status, body.error, body.message, body.details)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

/** The content-type header only goes with a body: the server answers 400 to JSON content-type with an empty one. */
const json = (method: string, body: unknown): RequestInit => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

const path = (id: string) => `/combos/${encodeURIComponent(id)}`

/** The server rejects a body without `deckId`, and `JSON.stringify` drops `undefined`: it always goes, as `null` at worst. */
const fields = ({ title, deckId, payload, visibility }: ComboInput) => ({ title, deckId: deckId ?? null, payload, visibility })

/** `POST /combos` */
export const saveCombo = (input: ComboInput) => request<{ id: string; revision: number }>('/combos', json('POST', fields(input)))

/** `PATCH /combos/:id`. A stale `baseRevision` rejects with `ComboConflictError`. A combo deleted elsewhere is a 404 `ComboApiError`. */
export const updateCombo = (id: string, input: ComboInput, baseRevision: number) =>
  request<{ id: string; revision: number }>(path(id), json('PATCH', { ...fields(input), baseRevision }))

/** `DELETE /combos/:id` */
export const deleteCombo = (id: string) => request<void>(path(id), { method: 'DELETE' })

/** `GET /combos/mine`: newest first, 24 a page. Pass `nextCursor` back as `cursor`. */
export const listMyCombos = (cursor?: string) => request<ComboPage>(`/combos/mine${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`)

/** `GET /combos/public`: every published combo, newest first, 24 a page. */
export const listPublicCombos = (cursor?: string) => request<ComboPage<PublicCombo>>(`/combos/public${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`)

/** `GET /combos/:id`: anyone with the id may read it, a private combo only its owner. `null` for 404 (unknown, malformed, deleted or someone else's private one). */
export const getCombo = async (id: string): Promise<SharedCombo | null> => {
  try {
    return await request<SharedCombo>(path(id))
  } catch (error) {
    if (error instanceof ComboApiError && error.status === 404) return null
    throw error
  }
}

/** The share link of a combo. Browser only: it reads `location`. */
export const comboUrl = (id: string) => `${location.origin}/simulator/c/${id}`
