import type { Deck } from '@utils/deck/types'
import { LIMITS, MONSTER_SLOTS, SPELL_SLOTS, ZONES } from './types'
import type { Action, Board, Card, Face, MonsterSlot, Slot, ZoneId } from './types'

type Move = Extract<Action, { t: 'move' }>
type Shuffle = Extract<Action, { t: 'shuffle' }>

const MONSTER = new Set<ZoneId>(MONSTER_SLOTS)
const SLOTS = new Set<ZoneId>([...MONSTER_SLOTS, ...SPELL_SLOTS])
/** What a card is once it is off the field or under a stack: nothing on it, ATK, face-up. */
const BLANK = { face: 'up', pos: 'atk', counters: 0, negated: false } as const

export const isMonsterSlot = (zone: ZoneId): zone is MonsterSlot => MONSTER.has(zone)
export const isSlot = (zone: ZoneId): zone is Slot => SLOTS.has(zone)

/** The board before any action: main in deck order (top = 0), extra face-down, turn 1. Side is ignored. */
export function initial(deck: Deck): Board {
  const { main, extra } = deck
  const zones = Object.fromEntries(ZONES.map((z) => [z, [] as number[]])) as Record<ZoneId, number[]>
  zones.deck = main.map((_, i) => i)
  zones.extra = extra.map((_, i) => main.length + i)
  const cards = [...main, ...extra].map((code, id): Card => ({ id, code, face: id < main.length ? 'up' : 'down', pos: 'atk', counters: 0, negated: false }))
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
      if (!isSlot(a.to)) return true
      return a.to !== from.zone && (isMonsterSlot(a.to) || board.zones[a.to].length === 0)
    }
    case 'flip':
    case 'negate':
      return onField(board, a.card)
    case 'counter':
      return onField(board, a.card) && Number.isInteger(a.delta) && a.delta !== 0 && Math.abs(a.delta) <= LIMITS.counters
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
    case 'counter':
      return edit(board, a.card, { counters: Math.min(LIMITS.counters, Math.max(0, board.cards[a.card]!.counters + a.delta)) })
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
