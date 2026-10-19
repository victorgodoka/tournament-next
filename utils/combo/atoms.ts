import type { DeckCard } from './deck-cards'
import { subjectKey, type Analysis, type Roles, type Subject } from './types'

/** Every subject a rule or the focus mentions, once each. */
export const referencedSubjects = (analysis: Analysis, focus: Subject | null): Subject[] => {
  const seen = new Map<string, Subject>()
  for (const hand of analysis.hands) for (const rule of hand.rules) seen.set(subjectKey(rule.subject), rule.subject)
  if (focus) seen.set(subjectKey(focus), focus)
  return [...seen.values()]
}

/** Whether the card `id` (canonical) counts for `s`. Roles compare case-insensitively (they are whitespace-normalized on write), so `engine` on one card and `Engine` on another are one role. */
export const satisfies = (id: number, roles: Roles, s: Subject): boolean =>
  s.kind === 'card' ? s.id === id : (roles.get(id) ?? []).some((r) => r.toLowerCase() === s.role.toLowerCase())

/** Copies of the cards that satisfy `subject`. */
export const subjectCopies = (cards: readonly DeckCard[], roles: Roles, subject: Subject): number =>
  cards.reduce((sum, card) => (satisfies(card.id, roles, subject) ? sum + card.copies : sum), 0)

/** Cards sharing one signature (the referenced subjects they satisfy), as subject keys. */
export type Atom = { size: number; signature: ReadonlySet<string> }
/** `atoms`: the non-empty signatures; `other`: copies satisfying no subject; `total`: the deck. */
export type Atoms = { atoms: Atom[]; other: number; total: number }

/** A card tagged Starter and Engine lands in one atom that counts for both: overlap stays exact. */
export const atomize = (cards: readonly DeckCard[], roles: Roles, subjects: readonly Subject[]): Atoms => {
  const groups = new Map<string, { size: number; signature: Set<string> }>()
  let other = 0
  let total = 0
  for (const card of cards) {
    total += card.copies
    if (card.copies === 0) continue
    // Subjects are visited in one fixed order, so equal sets give equal keys.
    const keys = subjects.filter((s) => satisfies(card.id, roles, s)).map(subjectKey)
    if (!keys.length) {
      other += card.copies
      continue
    }
    const key = keys.join('\u0000')
    const group = groups.get(key)
    if (group) group.size += card.copies
    else groups.set(key, { size: card.copies, signature: new Set(keys) })
  }
  return { atoms: [...groups.values()], other, total }
}
