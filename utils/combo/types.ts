import type { Deck } from '@utils/deck/types'

/** What a rule counts: cards carrying a role, or one card (by canonical id). */
export type Subject = { kind: 'role'; role: string } | { kind: 'card'; id: number }
/** `min ≤ count ≤ max` in the cards seen; `max: null` is no upper bound. */
export type Rule = { subject: Subject; min: number; max: number | null }
/** A playable hand: every rule holds (AND). */
export type Hand = { name: string; rules: Rule[] }
/** Any of the hands (OR). */
export type Analysis = { hands: Hand[] }
export type Draw = { going: 'first' | 'second'; handSize: number | null; extraDraws: number; turn: number }
/** Canonical card id → roles. */
export type Roles = ReadonlyMap<number, readonly string[]>
export type Build = { name: string; deck: Deck; roles: Roles; format: number | null; deckId: string | null }
export type Calculation = { builds: Build[]; analysis: Analysis; draw: Draw; focus: Subject | null }

export const DEFAULT_ROLES: readonly string[] = ['Starter', 'Extender', 'Hand Trap', 'Brick']
export const DEFAULT_DRAW: Draw = { going: 'first', handSize: null, extraDraws: 0, turn: 1 }

export const LIMITS = {
  handSize: [1, 20],
  extraDraws: [0, 20],
  turn: [1, 10],
  rule: [0, 20],
  hands: 12,
  rules: 12,
  builds: 6,
  rolesPerCard: 8,
  roleLength: 24,
  share: 8192,
  name: 80,
  handName: 40,
} as const

export const subjectKey = (s: Subject): string => (s.kind === 'role' ? `role:${s.role}` : `card:${s.id}`)
export const sameSubject = (a: Subject, b: Subject): boolean => subjectKey(a) === subjectKey(b)
