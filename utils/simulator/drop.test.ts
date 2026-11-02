import { describe, expect, it } from 'vitest'
import type { Deck } from '@utils/deck/types'
import { apply, initial, isValid } from './board'
import { dropAction, placeOptions, type PlaceKind } from './drop'
import type { Action, Board, How, ZoneId } from './types'
import { ZONES } from './types'

const deck: Deck = { main: [101, 102, 103, 104, 105, 106, 107, 108, 109, 110], extra: [201, 202, 203], side: [] }
const mv = (card: number, to: ZoneId): Action => ({ t: 'move', card, to })
// 6 drawn (hand 0..5), then card 0 in m0 and card 1 in s0; hand is [2,3,4,5], deck [6..9]
const base = [{ t: 'draw', n: 6 } as Action, mv(0, 'm0'), mv(1, 's0')].reduce(apply, initial(deck))
const withStack = apply(base, mv(2, 'm0')) // m0 = [0, 2]
const move = (card: number, to: ZoneId, o: { at?: 'top' | 'bottom'; face?: 'up' | 'down'; pos?: 'atk' | 'def' } = {}): Action => ({ t: 'move', card, to, ...o })

describe('simulator drop', () => {
  it('null zone, own slot and a material onto its own slot give null', () => {
    expect(dropAction(base, 2, null, false)).toBeNull()
    expect(dropAction(base, 2, null, true)).toBeNull()
    expect(dropAction(base, 0, 'm0', false)).toBeNull()
    expect(dropAction(base, 0, 'm0', true)).toBeNull()
    expect(dropAction(base, 1, 's0', true)).toBeNull()
    expect(dropAction(withStack, 2, 'm0', false)).toBeNull()
    expect(dropAction(withStack, 2, 'm0', true)).toBeNull()
  })

  it('an unknown card gives null', () => {
    expect(dropAction(base, 99, 'gy', false)).toBeNull()
  })

  it('empty monster slot: plain move, Shift sets face-down DEF', () => {
    expect(dropAction(base, 2, 'm1', false)).toEqual(move(2, 'm1'))
    expect(dropAction(base, 2, 'm1', true)).toEqual(move(2, 'm1', { face: 'down', pos: 'def' }))
    expect(dropAction(base, 2, 'emz0', true)).toEqual(move(2, 'emz0', { face: 'down', pos: 'def' }))
  })

  it('occupied monster slot: the card goes on top, Shift attaches it as a material', () => {
    expect(dropAction(base, 2, 'm0', false)).toEqual(move(2, 'm0', { at: 'top' }))
    expect(dropAction(base, 2, 'm0', true)).toEqual(move(2, 'm0'))
    expect(apply(base, dropAction(base, 2, 'm0', false)!).zones.m0).toEqual([2, 0])
  })

  it('empty spell or field slot: plain, Shift sets face-down; occupied gives null', () => {
    expect(dropAction(base, 2, 's1', false)).toEqual(move(2, 's1'))
    expect(dropAction(base, 2, 's1', true)).toEqual(move(2, 's1', { face: 'down' }))
    expect(dropAction(base, 2, 'field', false)).toEqual(move(2, 'field'))
    expect(dropAction(base, 2, 'field', true)).toEqual(move(2, 'field', { face: 'down' }))
    expect(dropAction(base, 2, 's0', false)).toBeNull()
    expect(dropAction(base, 2, 's0', true)).toBeNull()
  })

  it('Shift per pile: deck bottom, banished face-down, extra face-up, hand and GY plain', () => {
    expect(dropAction(base, 2, 'deck', false)).toEqual(move(2, 'deck'))
    expect(dropAction(base, 2, 'deck', true)).toEqual(move(2, 'deck', { at: 'bottom' }))
    expect(dropAction(base, 2, 'banished', false)).toEqual(move(2, 'banished'))
    expect(dropAction(base, 2, 'banished', true)).toEqual(move(2, 'banished', { face: 'down' }))
    expect(dropAction(base, 2, 'extra', false)).toEqual(move(2, 'extra'))
    expect(dropAction(base, 2, 'extra', true)).toEqual(move(2, 'extra', { face: 'up' }))
    expect(dropAction(base, 0, 'hand', false)).toEqual(move(0, 'hand'))
    expect(dropAction(base, 0, 'hand', true)).toEqual(move(0, 'hand'))
    expect(dropAction(base, 2, 'gy', false)).toEqual(move(2, 'gy'))
    expect(dropAction(base, 2, 'gy', true)).toEqual(move(2, 'gy'))
  })

  it('a drop onto the card own pile without Shift gives null', () => {
    expect(dropAction(base, 2, 'hand', false)).toBeNull()
    expect(dropAction(base, 2, 'hand', true)).toBeNull()
    expect(dropAction(base, 6, 'deck', false)).toBeNull()
    expect(dropAction(base, 6, 'deck', true)).toEqual(move(6, 'deck', { at: 'bottom' }))
    expect(dropAction(base, 10, 'extra', false)).toBeNull()
    expect(dropAction(base, 10, 'extra', true)).toEqual(move(10, 'extra', { face: 'up' }))
    const gy = apply(base, mv(2, 'gy'))
    expect(dropAction(gy, 2, 'gy', false)).toBeNull()
    expect(dropAction(gy, 2, 'gy', true)).toBeNull()
  })

  it('every action dropAction returns passes isValid', () => {
    const boards: [Board, number][] = [[base, 0], [base, 1], [base, 2], [base, 6], [base, 10], [withStack, 2], [withStack, 0]]
    for (const [board, card] of boards) {
      for (const zone of ZONES) {
        for (const shift of [false, true]) {
          const a = dropAction(board, card, zone, shift)
          if (a) expect(isValid(board, a)).toBe(true)
        }
      }
    }
  })

  describe('placeOptions', () => {
    const start = initial({ main: [1, 2, 3], extra: [4], side: [] })
    const zones = (how: How, kind: PlaceKind, board = start) => placeOptions(board, 0, how, kind).map(({ zone }) => zone)

    it('a monster takes a Main Monster Zone; only a Special Summon reaches the Extra Monster Zones', () => {
      expect(zones('normal', 'monster')).toEqual(['m0', 'm1', 'm2', 'm3', 'm4'])
      expect(zones('special', 'monster')).toEqual(['m0', 'm1', 'm2', 'm3', 'm4', 'emz0', 'emz1'])
    })

    it('a Spell or Trap takes the back row, a Field Spell its own zone', () => {
      expect(zones('set', 'spell')).toEqual(['s0', 's1', 's2', 's3', 's4'])
      expect(zones('set', 'fieldSpell')).toEqual(['field'])
    })

    it('an occupied zone is not offered', () => {
      expect(zones('normal', 'monster', apply(start, { t: 'move', card: 1, to: 'm2' }))).toEqual(['m0', 'm1', 'm3', 'm4'])
    })

    it('says how the card came in and sets it face-down', () => {
      expect(placeOptions(start, 0, 'normal', 'monster')[0]!.action).toEqual({ t: 'move', card: 0, to: 'm0', how: 'normal' })
      expect(placeOptions(start, 0, 'set', 'monster')[0]!.action).toEqual({ t: 'move', card: 0, to: 'm0', face: 'down', pos: 'def', how: 'set' })
      expect(placeOptions(start, 0, 'set', 'spell')[0]!.action).toEqual({ t: 'move', card: 0, to: 's0', face: 'down', how: 'set' })
    })

    it('brings a Special Summon in at the position asked for', () => {
      expect(placeOptions(start, 0, 'special', 'monster', { face: 'down', pos: 'def' })[0]!.action).toEqual({ t: 'move', card: 0, to: 'm0', how: 'special', face: 'down', pos: 'def' })
    })
  })
})
