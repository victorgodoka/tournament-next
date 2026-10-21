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
/** The draw effects the simulator scripts; the key order is the order they resolve in. */
export type EffectKind = 'extravagance' | 'prosperity' | 'duality' | 'desires' | 'upstart'
/** Canonical ids, confirmed against the cards API on 2026-10-19. */
export const DRAW_EFFECTS: Record<EffectKind, number> = { extravagance: 49238328, prosperity: 84211599, duality: 98645731, desires: 35261759, upstart: 70368879 }
export const EFFECT_IDS: readonly number[] = Object.values(DRAW_EFFECTS)
/** Extra Deck cards Prosperity or Extravagance banish. */
export type Banish = 3 | 6
/** `resolve`: the effect cards (canonical ids) resolved when they are in the opening hand. */
export type Effects = { resolve: number[]; prosperity: Banish; extravagance: Banish }
/** `seed` (32-bit) drives the hand simulator, so a shared link deals the same hand. */
export type Calculation = { builds: Build[]; analysis: Analysis; draw: Draw; focus: Subject | null; seed: number; effects: Effects }

export const DEFAULT_ROLES: readonly string[] = ['Starter', 'Extender', 'Hand Trap', 'Board Breaker', 'Brick', 'Non-Engine', 'Searcher', 'Needs Normal Summon']
export const DEFAULT_DRAW: Draw = { going: 'first', handSize: null, extraDraws: 0, turn: 1 }
export const DEFAULT_EFFECTS: Effects = { resolve: [], prosperity: 6, extravagance: 6 }

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
  runs: [1000, 200000],
} as const

export const subjectKey = (s: Subject): string => (s.kind === 'role' ? `role:${s.role}` : `card:${s.id}`)
export const sameSubject = (a: Subject, b: Subject): boolean => subjectKey(a) === subjectKey(b)
