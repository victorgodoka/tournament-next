import { describe, expect, it } from 'vitest'
import type { Deck } from '@utils/deck/types'
import { apply, initial, isValid } from './board'
import { dropAction, moveOptions } from './drop'
import type { Action, Board, ZoneId } from './types'
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

  it('occupied monster slot: material, Shift goes on top', () => {
    expect(dropAction(base, 2, 'm0', false)).toEqual(move(2, 'm0'))
    expect(dropAction(base, 2, 'm0', true)).toEqual(move(2, 'm0', { at: 'top' }))
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

  it('moveOptions lists only valid actions and never the own slot', () => {
    const opts = moveOptions(base, 2)
    expect(opts.length).toBeGreaterThan(0)
    for (const o of opts) expect(isValid(base, o.action)).toBe(true)
    expect(opts.some((o) => o.zone === 's0')).toBe(false)
    expect(opts.filter((o) => o.zone === 'm0').map((o) => o.variant)).toEqual(['plain', 'top'])
    expect(moveOptions(base, 0).some((o) => o.zone === 'm0')).toBe(false)
    expect(moveOptions(withStack, 2).some((o) => o.zone === 'm0')).toBe(false)
  })

  it('moveOptions follows ZONES order and offers each zone its variants', () => {
    const opts = moveOptions(base, 2)
    const order = opts.map((o) => ZONES.indexOf(o.zone))
    expect(order).toEqual([...order].sort((x, y) => x - y))
    const variants = (zone: ZoneId) => opts.filter((o) => o.zone === zone).map((o) => o.variant)
    expect(variants('deck')).toEqual(['top', 'bottom'])
    expect(variants('extra')).toEqual(['plain', 'faceUp'])
    expect(variants('gy')).toEqual(['plain'])
    expect(variants('banished')).toEqual(['plain', 'faceDown'])
    expect(variants('m1')).toEqual(['plain', 'set'])
    expect(variants('emz1')).toEqual(['plain', 'set'])
    expect(variants('s1')).toEqual(['plain', 'set'])
    expect(variants('field')).toEqual(['plain', 'set'])
    expect(variants('s0')).toEqual([])
  })

  it('moveOptions actions match what dropAction builds for the same variant', () => {
    const opts = moveOptions(base, 2)
    const action = (zone: ZoneId, variant: string) => opts.find((o) => o.zone === zone && o.variant === variant)?.action
    expect(action('m1', 'set')).toEqual(dropAction(base, 2, 'm1', true))
    expect(action('m0', 'top')).toEqual(dropAction(base, 2, 'm0', true))
    expect(action('s1', 'set')).toEqual(dropAction(base, 2, 's1', true))
    expect(action('deck', 'bottom')).toEqual(dropAction(base, 2, 'deck', true))
    expect(action('banished', 'faceDown')).toEqual(dropAction(base, 2, 'banished', true))
    expect(action('extra', 'faceUp')).toEqual(dropAction(base, 2, 'extra', true))
    expect(action('gy', 'plain')).toEqual(dropAction(base, 2, 'gy', false))
  })
})
