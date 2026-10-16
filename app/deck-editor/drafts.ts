import type { Deck } from '@utils/deck/types'

export type Draft = { deck: Deck; name: string; format: number | null; revision: number | null; at: number }

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

/** True only when the draft is stored and reads back the same: without it, nothing survives a reload. */
export const writeDraft = (key: string, draft: Draft): boolean =>
  attempt(() => {
    const raw = JSON.stringify(draft)
    localStorage.setItem(key, raw)
    return localStorage.getItem(key) === raw
  }, false)

/** Whether drafts can be kept in this browser at all (private mode and blocked site data can't). */
export const canStore = (): boolean =>
  attempt(() => {
    const key = 'deck-draft:probe'
    localStorage.setItem(key, '1')
    const ok = localStorage.getItem(key) === '1'
    localStorage.removeItem(key)
    return ok
  }, false)

export const clearDraft = (key: string): void => attempt(() => localStorage.removeItem(key), undefined)

/** Same deck, name and format: the draft holds nothing the other doesn't. */
export const sameDraft = (a: Pick<Draft, 'deck' | 'name' | 'format'>, b: Pick<Draft, 'deck' | 'name' | 'format'>): boolean =>
  a.name === b.name && a.format === b.format && (['main', 'extra', 'side'] as const).every((z) => a.deck[z].join() === b.deck[z].join())
