import { isMonsterSlot, isSlot, isValid, locate } from './board'
import { ZONES } from './types'
import type { Action, Board, Face, How, Pile, Pos, ZoneId } from './types'

/** `material`: under the cards of an occupied monster slot, said out loud where the plain move means the top (an Xyz). */
export type MoveVariant = 'plain' | 'set' | 'top' | 'bottom' | 'faceDown' | 'faceUp' | 'material'

/** What each pile offers besides a plain move; hand and GY have nothing, so Shift does nothing there. */
const PILE_VARIANTS: Record<Pile, MoveVariant[]> = {
  deck: ['top', 'bottom'],
  hand: ['plain'],
  extra: ['plain', 'faceUp'],
  gy: ['plain'],
  banished: ['plain', 'faceDown'],
}
/** The variant Shift picks on a pile (decision 5). */
const SHIFT: Partial<Record<ZoneId, MoveVariant>> = { deck: 'bottom', banished: 'faceDown', extra: 'faceUp' }

function variantAction(card: number, to: ZoneId, variant: MoveVariant): Action {
  const move = { t: 'move', card, to } as const
  switch (variant) {
    case 'set':
      return { ...move, face: 'down', ...(isMonsterSlot(to) && { pos: 'def' as const }) }
    case 'top':
      return { ...move, at: 'top' }
    case 'bottom':
      return { ...move, at: 'bottom' }
    case 'faceDown':
      return { ...move, face: 'down' }
    case 'faceUp':
      return { ...move, face: 'up' }
    case 'plain':
    case 'material':
      return move
  }
}

/** An Xyz summoned over cards always comes in on top of them, so for one an occupied monster slot reads the other way round. */
const overStack = (board: Board, zone: ZoneId, xyz: boolean) => xyz && isMonsterSlot(zone) && board.zones[zone].length > 0

/** Shift on a slot sets the card, or stacks it over an occupied monster; on a pile it picks that pile's variant. */
function shifted(board: Board, zone: ZoneId): MoveVariant {
  if (isMonsterSlot(zone)) return board.zones[zone].length ? 'top' : 'set'
  return isSlot(zone) ? 'set' : (SHIFT[zone] ?? 'plain')
}

/**
 * The move a drop on `zone` means, or null when it would do nothing or the reducer would refuse it. An `xyz` card dropped
 * on an occupied monster slot goes on top of the stack; Shift attaches it under instead.
 */
export function dropAction(board: Board, card: number, zone: ZoneId | null, shift: boolean, xyz = false): Action | null {
  if (!zone) return null
  const variant = overStack(board, zone, xyz) ? (shift ? 'material' : 'top') : shift ? shifted(board, zone) : 'plain'
  // a plain drop on the card's own pile is a no-op; only a pile variant (deck bottom, face-down, face-up) repositions it
  if (variant === 'plain' && locate(board, card)?.zone === zone) return null
  const action = variantAction(card, zone, variant)
  return isValid(board, action) ? action : null
}

/**
 * Every valid destination for the card's menu, in `ZONES` order. An occupied slot or the card's own slot offers nothing.
 * An `xyz` card is offered the top of an occupied monster slot first, then the place under it as a material.
 */
export function moveOptions(board: Board, card: number, xyz = false): { zone: ZoneId; variant: MoveVariant; action: Action }[] {
  const out: { zone: ZoneId; variant: MoveVariant; action: Action }[] = []
  for (const zone of ZONES) {
    const variants: MoveVariant[] =
      overStack(board, zone, xyz) ? ['top', 'material']
      : isSlot(zone) ? ['plain', isMonsterSlot(zone) && board.zones[zone].length ? 'top' : 'set']
      : PILE_VARIANTS[zone]
    for (const variant of variants) {
      const action = variantAction(card, zone, variant)
      if (isValid(board, action)) out.push({ zone, variant, action })
    }
  }
  return out
}

/** How the menu brings a card into play: summoned or set, or a Spell or Trap played face-up and activated. */
export type Placing = How | 'activate'
/** What decides where a card can stand. */
export type PlaceKind = 'monster' | 'spell' | 'fieldSpell'
/** The position a Special Summon comes in: the other ways into play have one of their own. */
export type Stance = { face: Face; pos: Pos }

const MAIN_ZONES: ZoneId[] = ['m0', 'm1', 'm2', 'm3', 'm4']
const BACK_ZONES: ZoneId[] = ['s0', 's1', 's2', 's3', 's4']

/** Every empty zone the card can come into play on, and what playing it there logs. Only a Special Summon reaches the Extra Monster Zones. */
export function placeOptions(board: Board, card: number, how: Placing, kind: PlaceKind, stance?: Stance): { zone: ZoneId; actions: Action[] }[] {
  const zones = kind === 'fieldSpell' ? (['field'] as ZoneId[]) : kind === 'spell' ? BACK_ZONES : how === 'special' ? [...MAIN_ZONES, 'emz0' as const, 'emz1' as const] : MAIN_ZONES
  return zones.flatMap((zone) => {
    const move: Action =
      how === 'activate' ? { t: 'move', card, to: zone }
      : how === 'set' ? { t: 'move', card, to: zone, face: 'down', ...(kind === 'monster' && { pos: 'def' as const }), how }
      : { t: 'move', card, to: zone, how, ...stance }
    if (board.zones[zone].length || !isValid(board, move)) return []
    return [{ zone, actions: how === 'activate' ? [move, { t: 'activate', card, targets: [] }] : [move] }]
  })
}
