import type { Deck } from '@utils/deck/types'

const PILES = ['deck', 'hand', 'extra', 'gy', 'banished'] as const
export const MONSTER_SLOTS = ['m0', 'm1', 'm2', 'm3', 'm4', 'emz0', 'emz1'] as const
export const SPELL_SLOTS = ['s0', 's1', 's2', 's3', 's4', 'field'] as const

export const SIDES = ['me', 'rival'] as const
export const PHASES = ['draw', 'standby', 'main1', 'battle', 'main2', 'end'] as const
export const HOWS = ['normal', 'special', 'set'] as const

export type Face = 'up' | 'down'
export type Pos = 'atk' | 'def'
export type Side = (typeof SIDES)[number]
export type Phase = (typeof PHASES)[number]
/** How a card came into play: what the log says and the replay shows. */
export type How = (typeof HOWS)[number]
export type Pile = (typeof PILES)[number]
export type MonsterSlot = (typeof MONSTER_SLOTS)[number]
type SpellSlot = (typeof SPELL_SLOTS)[number]
export type Slot = MonsterSlot | SpellSlot
export type ZoneId = Pile | Slot

/** Every zone, piles first, then monster slots, then spell slots. */
export const ZONES: readonly ZoneId[] = [...PILES, ...MONSTER_SLOTS, ...SPELL_SLOTS]

/**
 * Every copy is an instance; `id` is its index in `[...deck.main, ...deck.extra]`. `counters` is one count per kind
 * (`''` is the plain counter); a kind at 0 is not kept. `tag` is a short free text that stays on the card wherever it goes.
 */
export type Card = { id: number; code: number; face: Face; pos: Pos; counters: Record<string, number>; negated: boolean; tag?: string }

/** The plain counter's kind. */
export const PLAIN = ''

/** Every zone is an ordered list of card ids. In a monster slot, `[0]` is the monster and the rest are its Xyz materials; in a pile, `[0]` is the top. */
export type Board = { cards: Card[]; zones: Record<ZoneId, number[]>; turn: number; phase: Phase; lp: Record<Side, number> }

/** Every action may carry a caption (≤ 100 characters), shown under the field while its step is on screen. */
export type Action = (
  /** `destroy`: the move is a destruction (to the GY or Banished), shown as one. */
  | { t: 'move'; card: number; to: ZoneId; at?: 'top' | 'bottom'; face?: Face; pos?: Pos; destroy?: true; how?: How }
  | { t: 'flip'; card: number; face: Face; pos: Pos }
  | { t: 'activate'; card: number; targets: number[] }
  | { t: 'negate'; card: number; on: boolean }
  /** No `kind` is the plain counter. */
  | { t: 'counter'; card: number; delta: number; kind?: string }
  /** An empty `text` takes the tag off. */
  | { t: 'tag'; card: number; text: string }
  | { t: 'shuffle'; order: number[] }
  | { t: 'draw'; n: number }
  | { t: 'endTurn' }
  | { t: 'lp'; side: Side; delta: number }
  | { t: 'phase'; to: Phase }
) & { note?: string }

/** What a saved combo holds: the session minus its cursor and ties. `start` is where the replay starts, 0..actions.length. */
export type ComboPayload = { deck: Deck; name: string; actions: Action[]; start: number }

/** The saved combo a session is tied to; `saved` is `hashPayload` of the payload as last saved, so the page can tell a changed session from a saved one. */
export type SavedRef = { id: string; title: string; revision: number; saved: string }

/**
 * `cursor` is the step shown on the board; a replay plays from `start` to the end. `deckId` is the saved deck the session
 * was picked from and `combo` the saved combo it is tied to; each is null for a session that came from nowhere saved.
 */
export type Session = {
  deck: Deck
  name: string
  actions: Action[]
  cursor: number
  start: number
  deckId: string | null
  combo: SavedRef | null
  /** The counter kinds added in this session, offered in the menu besides the plain one and those the log already uses. */
  counterTypes: string[]
}

export const LIMITS = { actions: 2000, name: 80, title: 80, counters: 99, draw: 60, note: 100, kind: 20, kinds: 20, tag: 40, lp: 999999 } as const

export const START_LP = 8000

/** A deck or combo id: 16 lowercase hex characters, as the server issues them. */
export const ID = /^[0-9a-f]{16}$/
