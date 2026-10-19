import type { Deck } from '@utils/deck/types'

export const PILES = ['deck', 'hand', 'extra', 'gy', 'banished'] as const
export const MONSTER_SLOTS = ['m0', 'm1', 'm2', 'm3', 'm4', 'emz0', 'emz1'] as const
export const SPELL_SLOTS = ['s0', 's1', 's2', 's3', 's4', 'field'] as const

export type Face = 'up' | 'down'
export type Pos = 'atk' | 'def'
export type Pile = (typeof PILES)[number]
export type MonsterSlot = (typeof MONSTER_SLOTS)[number]
export type SpellSlot = (typeof SPELL_SLOTS)[number]
export type Slot = MonsterSlot | SpellSlot
export type ZoneId = Pile | Slot

/** Every zone, piles first, then monster slots, then spell slots. */
export const ZONES: readonly ZoneId[] = [...PILES, ...MONSTER_SLOTS, ...SPELL_SLOTS]

/** Every copy is an instance; `id` is its index in `[...deck.main, ...deck.extra]`. */
export type Card = { id: number; code: number; face: Face; pos: Pos; counters: number; negated: boolean }

/** Every zone is an ordered list of card ids. In a monster slot, `[0]` is the monster and the rest are its Xyz materials; in a pile, `[0]` is the top. */
export type Board = { cards: Card[]; zones: Record<ZoneId, number[]>; turn: number }

export type Action =
  | { t: 'move'; card: number; to: ZoneId; at?: 'top' | 'bottom'; face?: Face; pos?: Pos }
  | { t: 'flip'; card: number; face: Face; pos: Pos }
  | { t: 'activate'; card: number; targets: number[] }
  | { t: 'negate'; card: number; on: boolean }
  | { t: 'counter'; card: number; delta: number }
  | { t: 'shuffle'; order: number[] }
  | { t: 'draw'; n: number }
  | { t: 'endTurn' }

/** `cursor` is the step shown on the board; a replay plays from `start` to the end. */
export type Session = { deck: Deck; name: string; actions: Action[]; cursor: number; start: number }

export const LIMITS = { actions: 2000, name: 80, counters: 99, draw: 60 } as const
