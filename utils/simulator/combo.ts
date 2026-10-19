import { DRAFT_VERSION, parseSession } from './draft'
import type { ComboPayload, SavedRef, Session } from './types'

/** What a session saves. The key order is part of the hash, so it is fixed here. */
export const payloadOf = (s: Session): ComboPayload => ({ deck: s.deck, name: s.name, actions: s.actions, start: s.start })

/** FNV-1a 32-bit over the UTF-16 code units of the payload's JSON, as 8 lowercase hex characters. */
export function hashPayload(p: ComboPayload): string {
  const json = JSON.stringify(p)
  let hash = 0x811c9dc5
  for (let i = 0; i < json.length; i++) hash = Math.imul(hash ^ json.charCodeAt(i), 0x01000193)
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/** The session a saved payload opens as, with the cursor at the end of the log; null when the payload is damaged (it is replayed like a draft). */
export function sessionOf(p: ComboPayload, combo: SavedRef | null, deckId: string | null): Session | null {
  return parseSession({ ...p, v: DRAFT_VERSION, cursor: Array.isArray(p.actions) ? p.actions.length : 0, deckId, combo })
}

/** "Operate from here": a new session of the first `k` steps (`k` in 0..actions.length), tied to nothing. */
export const operateFrom = (p: ComboPayload, k: number): Session => ({
  deck: p.deck,
  name: p.name,
  actions: p.actions.slice(0, k),
  cursor: k,
  start: Math.min(p.start, k),
  deckId: null,
  combo: null,
})
