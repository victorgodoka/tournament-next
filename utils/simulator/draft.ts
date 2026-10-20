import { assertDeck } from '@utils/deck/codecs/ydk'
import { DeckCodeError } from '@utils/deck/types'
import type { Deck } from '@utils/deck/types'
import { apply, initial, isValid } from './board'
import { ID, LIMITS, ZONES } from './types'
import type { Action, Session } from './types'

export const DRAFT_KEY = 'simulator:draft'
/** v1 had no `deckId` or `combo`; it is still read. */
export const DRAFT_VERSION = 2
const HASH = /^[0-9a-f]{8}$/

const AT = ['top', 'bottom'] as const
const FACES = ['up', 'down'] as const
const POSES = ['atk', 'def'] as const

type Obj = Record<string, unknown>
const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x)
const int = (x: unknown, min: number, max: number): x is number => typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max
const oneOf = <T extends string>(x: unknown, set: readonly T[]): x is T => set.includes(x as T)
const isId = (x: unknown): x is string => typeof x === 'string' && ID.test(x)
/** A counter kind: 1 to 20 characters. */
const isKind = (x: unknown): x is string => typeof x === 'string' && x.length >= 1 && x.length <= LIMITS.kind
const optional = <T extends string>(x: unknown, set: readonly T[]): x is T | undefined => x === undefined || oneOf(x, set)

/** The three lists, copied, and passed through the same limits the deck codecs enforce. */
function parseDeck(x: unknown): Deck | null {
  if (!isObj(x) || !Array.isArray(x.main) || !Array.isArray(x.extra) || !Array.isArray(x.side)) return null
  const deck: Deck = { main: [...x.main], extra: [...x.extra], side: [...x.side] }
  try {
    assertDeck(deck)
  } catch (error) {
    if (!(error instanceof DeckCodeError)) throw error
    return null
  }
  return deck
}

/** One action rebuilt from its validated fields, so nothing unknown rides along, its caption included when it has one. */
function parseAction(x: unknown, count: number): Action | null {
  const action = parseBody(x, count)
  if (!action || !isObj(x) || x.note === undefined) return action
  if (typeof x.note !== 'string' || x.note.length > LIMITS.note) return null
  return x.note ? { ...action, note: x.note } : action
}

/** The action itself, without its caption. `count` is the cards on the board (main + extra). */
function parseBody(x: unknown, count: number): Action | null {
  if (!isObj(x)) return null
  const id = (v: unknown): v is number => int(v, 0, count - 1)
  const ids = (v: unknown): v is number[] => Array.isArray(v) && v.every(id)
  switch (x.t) {
    case 'move': {
      const { card, to, at, face, pos, destroy } = x
      if (!id(card) || !oneOf(to, ZONES) || !optional(at, AT) || !optional(face, FACES) || !optional(pos, POSES)) return null
      if (destroy !== undefined && destroy !== true) return null
      return { t: 'move', card, to, ...(at && { at }), ...(face && { face }), ...(pos && { pos }), ...(destroy && { destroy }) }
    }
    case 'flip':
      return id(x.card) && oneOf(x.face, FACES) && oneOf(x.pos, POSES) ? { t: 'flip', card: x.card, face: x.face, pos: x.pos } : null
    case 'activate':
      return id(x.card) && ids(x.targets) ? { t: 'activate', card: x.card, targets: [...x.targets] } : null
    case 'negate':
      return id(x.card) && typeof x.on === 'boolean' ? { t: 'negate', card: x.card, on: x.on } : null
    case 'counter': {
      const { card, delta, kind } = x
      if (!id(card) || !int(delta, -LIMITS.counters, LIMITS.counters) || delta === 0) return null
      if (kind !== undefined && !isKind(kind)) return null
      return { t: 'counter', card, delta, ...(kind && { kind }) }
    }
    case 'tag':
      return id(x.card) && typeof x.text === 'string' && x.text.length <= LIMITS.tag ? { t: 'tag', card: x.card, text: x.text } : null
    case 'shuffle':
      return ids(x.order) ? { t: 'shuffle', order: [...x.order] } : null
    case 'draw':
      return int(x.n, 1, LIMITS.draw) ? { t: 'draw', n: x.n } : null
    case 'endTurn':
      return { t: 'endTurn' }
    default:
      return null
  }
}

/** The `deckId` and `combo` of a v2 draft, the combo rebuilt field by field; null when either is damaged. */
function parseTie(x: Obj): Pick<Session, 'deckId' | 'combo'> | null {
  const { deckId, combo } = x
  if (deckId !== null && !isId(deckId)) return null
  if (combo === null) return { deckId, combo }
  if (!isObj(combo)) return null
  const { id, title, revision, saved } = combo
  if (!isId(id) || typeof title !== 'string' || title.length < 1 || title.length > LIMITS.title) return null
  if (!int(revision, 1, Number.MAX_SAFE_INTEGER) || typeof saved !== 'string' || !HASH.test(saved)) return null
  return { deckId, combo: { id, title, revision, saved } }
}

/** Checks an untrusted `{ v: 2, deck, name, actions, cursor, start, deckId, combo, counterTypes? }` (or a v1 without the last three), then replays the log and refuses it if any action is invalid at its step. */
export function parseSession(raw: unknown): Session | null {
  if (!isObj(raw) || (raw.v !== 1 && raw.v !== DRAFT_VERSION)) return null
  const tie = raw.v === 1 ? { deckId: null, combo: null } : parseTie(raw)
  if (!tie) return null
  const deck = parseDeck(raw.deck)
  const { name, actions: log, cursor, start } = raw
  if (!deck || typeof name !== 'string' || name.length > LIMITS.name) return null
  if (!Array.isArray(log) || log.length > LIMITS.actions) return null

  const count = deck.main.length + deck.extra.length
  const actions: Action[] = []
  for (const x of log) {
    const action = parseAction(x, count)
    if (!action) return null
    actions.push(action)
  }
  if (!int(cursor, 0, actions.length) || !int(start, 0, actions.length)) return null
  // the counter kinds added by hand: absent before they existed, and in a saved combo (its log carries the ones it uses)
  const { counterTypes = [] } = raw
  if (!Array.isArray(counterTypes) || counterTypes.length > LIMITS.kinds || !counterTypes.every(isKind)) return null

  // not `timeline`: an invalid step there just repeats the board, and a valid `activate` does the same
  let board = initial(deck)
  for (const action of actions) {
    if (!isValid(board, action)) return null
    board = apply(board, action)
  }
  return { deck, name, actions, cursor, start, ...tie, counterTypes: [...new Set(counterTypes)] }
}

/** The saved draft, or null for no storage, no draft, or a draft that is damaged or was tampered with. Never throws, so a bad draft cannot stop the page opening. */
export function readDraft(storage: Pick<Storage, 'getItem'> | null): Session | null {
  try {
    const text = storage?.getItem(DRAFT_KEY)
    return text ? parseSession(JSON.parse(text)) : null
  } catch {
    return null
  }
}

/** Never throws: a full or blocked storage just means this draft is not kept. */
export function writeDraft(storage: Pick<Storage, 'setItem'> | null, session: Session): void {
  try {
    storage?.setItem(DRAFT_KEY, JSON.stringify({ v: DRAFT_VERSION, ...session }))
  } catch {
    // quota, private mode or a blocked storage: the next action tries again
  }
}

/** `window.localStorage`, or null where reading it throws (blocked cookies, private mode) or there is no window (SSR). */
export function draftStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}
