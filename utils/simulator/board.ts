import type { Deck } from '@utils/deck/types'
import { LIMITS, MONSTER_SLOTS, PLAIN, SPELL_SLOTS, ZONES } from './types'
import type { Action, Board, Card, Face, MonsterSlot, Slot, ZoneId } from './types'

type Move = Extract<Action, { t: 'move' }>
type Shuffle = Extract<Action, { t: 'shuffle' }>

const MONSTER = new Set<ZoneId>(MONSTER_SLOTS)
const SLOTS = new Set<ZoneId>([...MONSTER_SLOTS, ...SPELL_SLOTS])
/** What a card is once it is off the field or under a stack: nothing on it, ATK, face-up. Its tag stays. */
const BLANK = { face: 'up', pos: 'atk', counters: {}, negated: false } as const

/** A counter kind as the log carries it: absent for the plain counter, else 1 to 20 characters. */
const isKind = (kind: unknown): kind is string | undefined => kind === undefined || (typeof kind === 'string' && kind.length >= 1 && kind.length <= LIMITS.kind)

/** Every counter kind the log uses, once each, the plain one left out. */
export const kindsIn = (actions: readonly Action[]): string[] => [...new Set(actions.flatMap((a) => (a.t === 'counter' && a.kind ? [a.kind] : [])))]

/** The card a step destroyed and where it was: what the board marks while that step is on screen. */
export const destroyedBy = (a: Action | undefined, before: Board): { card: number; from: ZoneId } | null => {
  if (a?.t !== 'move' || !a.destroy) return null
  const from = locate(before, a.card)
  return from && { card: a.card, from: from.zone }
}

export const isMonsterSlot = (zone: ZoneId): zone is MonsterSlot => MONSTER.has(zone)
export const isSlot = (zone: ZoneId): zone is Slot => SLOTS.has(zone)

/** The board before any action: main in deck order (top = 0), extra face-down, turn 1. Side is ignored. */
export function initial(deck: Deck): Board {
  const { main, extra } = deck
  const zones = Object.fromEntries(ZONES.map((z) => [z, [] as number[]])) as Record<ZoneId, number[]>
  zones.deck = main.map((_, i) => i)
  zones.extra = extra.map((_, i) => main.length + i)
  const cards = [...main, ...extra].map((code, id): Card => ({ id, code, face: id < main.length ? 'up' : 'down', pos: 'atk', counters: {}, negated: false }))
  return { cards, zones, turn: 1 }
}

/** The zone holding a card and its index there, or null for an id the board does not have. */
export function locate(board: Board, card: number): { zone: ZoneId; index: number } | null {
  for (const zone of ZONES) {
    const index = board.zones[zone].indexOf(card)
    if (index >= 0) return { zone, index }
  }
  return null
}

/** The cards a step plays, read against the board it was played on: a draw's are the deck's top `n`, a shuffle or an end of turn has none. */
export function stepCards(a: Action, before: Board): number[] {
  if (a.t === 'draw') return before.zones.deck.slice(0, a.n)
  return 'card' in a ? [a.card] : []
}

/** On the field and not an Xyz material: the only cards that carry counters, negate and a face/pos. */
function onField(board: Board, card: number): boolean {
  const at = locate(board, card)
  return !!at && isSlot(at.zone) && at.index === 0
}

/** Whether `apply` accepts the action. `activate` is accepted and changes nothing, so check this, not `apply(...) !== board`. */
export function isValid(board: Board, a: Action): boolean {
  const known = (id: number) => Number.isInteger(id) && id >= 0 && id < board.cards.length
  switch (a.t) {
    case 'move': {
      const from = locate(board, a.card)
      if (!from || !ZONES.includes(a.to)) return false
      // a destruction ends in the GY or Banished
      if (a.destroy !== undefined && (a.destroy !== true || (a.to !== 'gy' && a.to !== 'banished'))) return false
      if (!isSlot(a.to)) return true
      return a.to !== from.zone && (isMonsterSlot(a.to) || board.zones[a.to].length === 0)
    }
    case 'flip':
    case 'negate':
      return onField(board, a.card)
    case 'counter':
      return onField(board, a.card) && Number.isInteger(a.delta) && a.delta !== 0 && Math.abs(a.delta) <= LIMITS.counters && isKind(a.kind)
    case 'tag':
      return known(a.card) && typeof a.text === 'string' && a.text.length <= LIMITS.tag
    case 'activate':
      return known(a.card) && a.targets.every(known)
    case 'shuffle': {
      const deck = board.zones.deck
      return deck.length > 0 && a.order.length === deck.length && new Set(a.order).size === deck.length && a.order.every((id) => deck.includes(id))
    }
    case 'draw':
      return Number.isInteger(a.n) && a.n > 0 && board.zones.deck.length > 0
    case 'endTurn':
      return true
  }
}

/** Pure and total: an invalid action returns the very same board. Copies only the zones and cards it touches. */
export function apply(board: Board, a: Action): Board {
  if (!isValid(board, a)) return board
  switch (a.t) {
    case 'move':
      return move(board, a)
    case 'flip':
      return edit(board, a.card, { face: a.face, pos: a.pos })
    case 'negate':
      return edit(board, a.card, { negated: a.on })
    case 'counter': {
      const kind = a.kind ?? PLAIN
      const { [kind]: had = 0, ...rest } = board.cards[a.card]!.counters
      const now = Math.min(LIMITS.counters, Math.max(0, had + a.delta))
      return edit(board, a.card, { counters: now ? { ...rest, [kind]: now } : rest })
    }
    case 'tag': {
      if (a.text) return edit(board, a.card, { tag: a.text })
      // `patched` merges, which would keep the tag: the card is copied and the tag taken off
      const untagged = { ...board.cards[a.card]! }
      delete untagged.tag
      const cards = [...board.cards]
      cards[a.card] = untagged
      return { ...board, cards }
    }
    case 'shuffle':
      return { ...board, zones: { ...board.zones, deck: [...a.order] } }
    case 'draw': {
      const { deck, hand } = board.zones
      const n = Math.min(a.n, deck.length)
      return { ...board, zones: { ...board.zones, deck: deck.slice(n), hand: [...hand, ...deck.slice(0, n)] } }
    }
    case 'endTurn':
      return { ...board, turn: board.turn + 1 }
    case 'activate':
      return board
  }
}

/** Whether every action is valid on the board the ones before it leave: what a batch must pass before it is logged. */
export function validRun(board: Board, actions: readonly Action[]): boolean {
  let b = board
  for (const a of actions) {
    if (!isValid(b, a)) return false
    b = apply(b, a)
  }
  return true
}

/** The board after every action, `[0]` being `initial(deck)`. Invalid actions leave their step equal to the one before. */
export function timeline(deck: Deck, actions: readonly Action[]): Board[] {
  // ponytail: timeline keeps every step's board (≤ 2000, structurally shared); switch to checkpoints if logs grow
  const boards = [initial(deck)]
  for (const a of actions) boards.push(apply(boards[boards.length - 1]!, a))
  return boards
}

/** A fresh Fisher–Yates order of the current deck; the action is logged so a replay lands on the same deck. */
export function shuffleAction(board: Board, random: () => number = Math.random): Shuffle {
  const order = [...board.zones.deck]
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const swap = order[i]!
    order[i] = order[j]!
    order[j] = swap
  }
  return { t: 'shuffle', order }
}

function edit(board: Board, id: number, patch: Partial<Card>): Board {
  return { ...board, cards: patched(board.cards, [[id, patch]]) }
}

function patched(cards: readonly Card[], edits: [number, Partial<Card>][]): Card[] {
  const out = [...cards]
  for (const [id, patch] of edits) out[id] = { ...out[id]!, ...patch }
  return out
}

/** `extra` shows its card face-down unless Pendulum, `banished` face-up unless set; everything else is face-up. */
function faceIn(to: ZoneId, face: Face | undefined): Face {
  if (to === 'banished') return face === 'down' ? 'down' : 'up'
  if (to === 'extra') return face === 'up' ? 'up' : 'down'
  return 'up'
}

/** `move` for an action `isValid` accepted: lift the card (and its materials, if it is a monster), then land it. */
function move(board: Board, a: Move): Board {
  const from = locate(board, a.card)!
  const zones = { ...board.zones }
  const edits: [number, Partial<Card>][] = []

  const stack = zones[from.zone]
  const lifts = isMonsterSlot(from.zone) && from.index === 0
  const riders = lifts ? stack.slice(1) : []
  zones[from.zone] = lifts ? [] : stack.filter((id) => id !== a.card)

  // materials only follow a monster to a monster slot; anywhere else they land on the GY, under the monster if that is the GY too
  const travels = isMonsterSlot(a.to)
  if (!travels && riders.length) zones.gy = [...riders, ...zones.gy]
  const group = travels ? [a.card, ...riders] : [a.card]

  const dest = zones[a.to]
  if (isSlot(a.to)) {
    const over = a.at === 'top'
    zones[a.to] = over ? [...group, ...dest] : [...dest, ...group]
    if (dest.length && over) edits.push([dest[0]!, BLANK])
    edits.push([a.card, dest.length && !over ? BLANK : { face: a.face ?? 'up', pos: a.pos ?? 'atk' }])
  } else {
    zones[a.to] = a.to === 'hand' || a.at === 'bottom' ? [...dest, a.card] : [a.card, ...dest]
    edits.push([a.card, { ...BLANK, face: faceIn(a.to, a.face) }])
  }
  return { ...board, cards: patched(board.cards, edits), zones }
}
