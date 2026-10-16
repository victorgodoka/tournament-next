import type { Deck } from '@utils/deck/types'

export type Draft = { deck: Deck; name: string; format: number | null; revision: number | null; at: number }

const RETURN_KEY = 'return-to'

export const draftKey = (deckId: string | null): string => `deck-draft:${deckId ?? 'new'}`

// Storage can be missing or throw on access itself (private mode, blocked site data); every use goes through here.
const attempt = <T>(fn: () => T, fallback: T): T => {
  try {
    return fn()
  } catch {
    return fallback
  }
}

const isIds = (v: unknown): v is number[] => Array.isArray(v) && v.every((n) => Number.isInteger(n))
const isNumOrNull = (v: unknown) => v === null || typeof v === 'number'

const isDraft = (v: unknown): v is Draft => {
  if (!v || typeof v !== 'object') return false
  const d = v as Record<string, unknown>
  const deck = d.deck as Record<string, unknown> | null
  return (
    !!deck &&
    typeof deck === 'object' &&
    isIds(deck.main) &&
    isIds(deck.extra) &&
    isIds(deck.side) &&
    typeof d.name === 'string' &&
    isNumOrNull(d.format) &&
    isNumOrNull(d.revision) &&
    typeof d.at === 'number'
  )
}

export const readDraft = (key: string): Draft | null =>
  attempt(() => {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isDraft(parsed) ? parsed : null
  }, null)

export const writeDraft = (key: string, draft: Draft): void =>
  attempt(() => localStorage.setItem(key, JSON.stringify(draft)), undefined)

export const clearDraft = (key: string): void => attempt(() => localStorage.removeItem(key), undefined)

export const setReturnTo = (path: string): void =>
  attempt(() => sessionStorage.setItem(RETURN_KEY, path), undefined)

/** Reads and clears the stored path; only same-origin rooted paths are returned (never `//host`). */
export const takeReturnTo = (): string | null =>
  attempt(() => {
    const path = sessionStorage.getItem(RETURN_KEY)
    sessionStorage.removeItem(RETURN_KEY)
    return path && /^\/(?![/\\])/.test(path) ? path : null
  }, null)
