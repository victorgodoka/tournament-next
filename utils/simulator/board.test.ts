import { describe, expect, it } from 'vitest'
import type { Deck } from '@utils/deck/types'
import { apply, chainAt, destroyedBy, initial, isMonsterSlot, isSlot, isValid, kindsIn, locate, nextPhase, shuffleAction, stepCards, timeline, validRun } from './board'
import type { Action, Board, Face, Pos, ZoneId } from './types'

const deck: Deck = { main: [101, 102, 103, 104, 105, 106, 107, 108, 109, 110], extra: [201, 202, 203], side: [] }
const b0 = initial(deck)
const ids = Array.from({ length: 13 }, (_, i) => i)

const run = (...actions: Action[]): Board => actions.reduce(apply, b0)
const zone = (b: Board, id: number) => locate(b, id)?.zone
const draw = (n: number): Action => ({ t: 'draw', n })
const mv = (card: number, to: ZoneId, o: { at?: 'top' | 'bottom'; face?: Face; pos?: Pos } = {}): Action => ({ t: 'move', card, to, ...o })
const counter = (card: number, delta: number): Action => ({ t: 'counter', card, delta })
const negate = (card: number, on: boolean): Action => ({ t: 'negate', card, on })
const flip = (card: number, face: Face, pos: Pos): Action => ({ t: 'flip', card, face, pos })
const activate = (card: number, targets: number[]): Action => ({ t: 'activate', card, targets })

/** Applying an invalid action must hand back the very same board. */
const rejects = (b: Board, a: Action) => {
  expect(isValid(b, a)).toBe(false)
  expect(apply(b, a)).toBe(b)
}

describe('simulator board', () => {
  it('initial: main top-first in deck, extra face-down, turn 1', () => {
    expect(b0.zones.deck).toEqual(ids.slice(0, 10))
    expect(b0.zones.extra).toEqual([10, 11, 12])
    expect(b0.cards[0]).toEqual({ id: 0, code: 101, face: 'up', pos: 'atk', counters: {}, negated: false })
    expect(b0.cards[10]!.face).toBe('down')
    expect(b0.cards[10]!.code).toBe(201)
    expect(b0.turn).toBe(1)
    for (const z of Object.keys(b0.zones) as ZoneId[]) if (z !== 'deck' && z !== 'extra') expect(b0.zones[z]).toEqual([])
  })

  it('stepCards names the cards a step plays: a draw takes the deck top, a shuffle or an end of turn none', () => {
    expect(stepCards(draw(3), b0)).toEqual([0, 1, 2])
    expect(stepCards(mv(4, 'm0'), b0)).toEqual([4])
    expect(stepCards(activate(4, [5]), b0)).toEqual([4])
    expect(stepCards(counter(4, 1), b0)).toEqual([4])
    expect(stepCards({ t: 'shuffle', order: ids.slice(0, 10) }, b0)).toEqual([])
    expect(stepCards({ t: 'endTurn' }, b0)).toEqual([])
  })

  it('locate finds a card, isSlot and isMonsterSlot classify zones', () => {
    expect(locate(b0, 11)).toEqual({ zone: 'extra', index: 1 })
    expect(locate(b0, 13)).toBeNull()
    expect(['m0', 'emz1', 's4', 'field'].map((z) => isSlot(z as ZoneId))).toEqual([true, true, true, true])
    expect(['deck', 'hand', 'extra', 'gy', 'banished'].map((z) => isSlot(z as ZoneId))).toEqual([false, false, false, false, false])
    expect(['m4', 'emz0'].every((z) => isMonsterSlot(z as ZoneId))).toBe(true)
    expect(['s0', 'field', 'gy'].some((z) => isMonsterSlot(z as ZoneId))).toBe(false)
  })

  it('draw takes from the top in order and stops at an empty deck', () => {
    expect(run(draw(3)).zones.hand).toEqual([0, 1, 2])
    expect(run(draw(3)).zones.deck).toEqual([3, 4, 5, 6, 7, 8, 9])
    const empty = run(draw(99))
    expect(empty.zones.hand).toHaveLength(10)
    rejects(empty, draw(1))
    rejects(b0, draw(0))
  })

  it('move to an empty slot takes it; face and pos default to up and atk', () => {
    const set = run(draw(1), mv(0, 'm2', { face: 'down', pos: 'def' }))
    expect(set.zones.m2).toEqual([0])
    expect(set.zones.hand).toEqual([])
    expect(set.cards[0]).toMatchObject({ face: 'down', pos: 'def' })
    const plain = run(draw(1), mv(0, 'm2'))
    expect(plain.cards[0]).toMatchObject({ face: 'up', pos: 'atk' })
  })

  it('move to an occupied monster slot appends a material', () => {
    const b = run(draw(2), mv(0, 'm0'), mv(1, 'm0'))
    expect(b.zones.m0).toEqual([0, 1])
    expect(b.zones.hand).toEqual([])
  })

  it('at top on an occupied monster slot puts the card over the whole stack', () => {
    const b = run(draw(3), mv(0, 'm0'), mv(1, 'm0'), mv(2, 'm0', { at: 'top' }))
    expect(b.zones.m0).toEqual([2, 0, 1])
  })

  it('a monster with materials that becomes a material brings them along', () => {
    const stacks = [draw(3), mv(0, 'm0'), mv(1, 'm0'), mv(2, 'm1')]
    const under = run(...stacks, mv(0, 'm1'))
    expect(under.zones.m1).toEqual([2, 0, 1])
    expect(under.zones.m0).toEqual([])
    expect(run(...stacks, mv(0, 'm1', { at: 'top' })).zones.m1).toEqual([0, 1, 2])
  })

  it('materials travel to another monster slot and go to the GY top otherwise', () => {
    const stack = [draw(6), mv(5, 'gy'), mv(0, 'm0'), mv(1, 'm0')]
    const moved = run(...stack, mv(0, 'm3'))
    expect(moved.zones.m3).toEqual([0, 1])
    expect(moved.zones.m0).toEqual([])
    const bounced = run(...stack, mv(0, 'hand'))
    expect(bounced.zones.gy).toEqual([1, 5])
    expect(bounced.zones.m0).toEqual([])
    expect(zone(bounced, 0)).toBe('hand')
    expect(run(...stack, mv(0, 'gy')).zones.gy).toEqual([0, 1, 5])
    const wide = run(draw(3), mv(0, 'm0'), mv(1, 'm0'), mv(2, 'm0'), mv(0, 'banished'))
    expect(wide.zones.gy).toEqual([1, 2])
    expect(wide.zones.banished).toEqual([0])
    const spell = run(draw(2), mv(0, 'm0'), mv(1, 'm0'), mv(0, 's0'))
    expect(spell.zones.s0).toEqual([0])
    expect(spell.zones.gy).toEqual([1])
  })

  it('moving a material detaches only that card', () => {
    const b = run(draw(3), mv(0, 'm0'), mv(1, 'm0'), mv(2, 'm0'), mv(1, 'gy'))
    expect(b.zones.m0).toEqual([0, 2])
    expect(b.zones.gy).toEqual([1])
  })

  it('an occupied spell or field slot is invalid', () => {
    for (const slot of ['s0', 's3', 'field'] as const) {
      const b = run(draw(2), mv(0, slot))
      rejects(b, mv(1, slot))
      rejects(b, mv(1, slot, { at: 'top' }))
      rejects(b, mv(0, slot))
    }
    rejects(run(draw(1), mv(0, 'm0')), mv(0, 'm0'))
  })

  it('leaving the field clears counters and negate and resets pos to atk', () => {
    const field = run(draw(1), mv(0, 'm0', { pos: 'def' }), counter(0, 3), negate(0, true))
    expect(field.cards[0]).toMatchObject({ pos: 'def', counters: { '': 3 }, negated: true })
    for (const to of ['hand', 'gy', 'deck', 'banished', 'extra'] as const) {
      expect(apply(field, mv(0, to)).cards[0]).toMatchObject({ pos: 'atk', counters: {}, negated: false })
    }
    expect(apply(field, mv(0, 'm1')).cards[0]).toMatchObject({ counters: { '': 3 }, negated: true })
  })

  it('a card under a stack is reset like one that left the field', () => {
    const b = run(draw(2), mv(0, 'm0', { pos: 'def' }), counter(0, 2), negate(0, true), mv(1, 'm1'), mv(0, 'm1'))
    expect(b.cards[0]).toMatchObject({ face: 'up', pos: 'atk', counters: {}, negated: false })
    const over = run(draw(2), mv(0, 'm0'), counter(0, 2), mv(1, 'm0', { at: 'top' }))
    expect(over.zones.m0).toEqual([1, 0])
    expect(over.cards[0]!.counters).toEqual({})
  })

  it('a destroy is a move to the GY or Banished, marked as one; anywhere else, or with another flag, it is refused', () => {
    const b = run(draw(1), mv(0, 'm0'))
    expect(apply(b, { t: 'move', card: 0, to: 'gy', destroy: true }).zones.gy).toEqual([0])
    expect(apply(b, { t: 'move', card: 0, to: 'banished', destroy: true }).zones.banished).toEqual([0])
    expect(destroyedBy({ t: 'move', card: 0, to: 'gy', destroy: true }, b)).toEqual({ card: 0, from: 'm0' })
    expect(destroyedBy(mv(0, 'gy'), b)).toBeNull()
    rejects(b, { t: 'move', card: 0, to: 'hand', destroy: true })
    rejects(b, { t: 'move', card: 0, to: 'gy', destroy: false as unknown as true })
  })

  it('a tag stays on the card through moves and off the field; an empty one takes it off', () => {
    const b = run(draw(1), { t: 'tag', card: 0, text: 'Negates once' })
    expect(b.cards[0]!.tag).toBe('Negates once')
    expect(run(draw(1), { t: 'tag', card: 0, text: 'x' }, mv(0, 'm0'), mv(0, 'gy')).cards[0]!.tag).toBe('x')
    expect(apply(b, { t: 'tag', card: 0, text: '' }).cards[0]).not.toHaveProperty('tag')
    rejects(b0, { t: 'tag', card: 99, text: 'x' })
    rejects(b0, { t: 'tag', card: 0, text: 'x'.repeat(41) })
  })

  it('face per destination: gy, hand and deck up; banished up unless down; extra down unless up', () => {
    for (const to of ['gy', 'hand', 'deck'] as const) {
      expect(run(draw(1), mv(0, to, { face: 'down' })).cards[0]!.face).toBe('up')
    }
    expect(run(draw(1), mv(0, 'banished')).cards[0]!.face).toBe('up')
    expect(run(draw(1), mv(0, 'banished', { face: 'down' })).cards[0]!.face).toBe('down')
    expect(run(draw(1), mv(0, 'extra')).cards[0]!.face).toBe('down')
    expect(run(draw(1), mv(0, 'extra', { face: 'up' })).cards[0]!.face).toBe('up')
    expect(run(draw(1), mv(0, 'banished', { face: 'down' }), mv(0, 'gy')).cards[0]!.face).toBe('up')
  })

  it('pile at top inserts first, bottom appends; the hand always appends', () => {
    const gy = run(draw(3), mv(0, 'gy'), mv(1, 'gy'), mv(2, 'gy', { at: 'bottom' }))
    expect(gy.zones.gy).toEqual([1, 0, 2])
    const topped = run(draw(2), mv(0, 'banished', { at: 'top' }), mv(1, 'banished', { at: 'top' }))
    expect(topped.zones.banished).toEqual([1, 0])
    const deckTop = run(draw(1), mv(0, 'deck'))
    expect(deckTop.zones.deck[0]).toBe(0)
    const deckBottom = run(draw(1), mv(0, 'deck', { at: 'bottom' }))
    expect(deckBottom.zones.deck.at(-1)).toBe(0)
    expect(deckBottom.zones.deck).toHaveLength(10)
    const hand = run(draw(3), mv(0, 'm0'), mv(0, 'hand', { at: 'top' }))
    expect(hand.zones.hand).toEqual([1, 2, 0])
    expect(run(mv(10, 'extra', { at: 'bottom' })).zones.extra).toEqual([11, 12, 10])
  })

  it('shuffle needs a permutation of the current deck', () => {
    const reversed = [...ids.slice(0, 10)].reverse()
    expect(run({ t: 'shuffle', order: reversed }).zones.deck).toEqual(reversed)
    rejects(b0, { t: 'shuffle', order: ids.slice(0, 9) })
    rejects(b0, { t: 'shuffle', order: [0, 0, ...ids.slice(2, 10)] })
    rejects(b0, { t: 'shuffle', order: [...ids.slice(0, 9), 10] })
    rejects(b0, { t: 'shuffle', order: [] })
    rejects(run(draw(99)), { t: 'shuffle', order: [] })
  })

  it('counter clamps to 0..99 and only touches a field card that is not a material', () => {
    const on = run(draw(2), mv(0, 'm0'), mv(1, 'm0'))
    expect(apply(on, counter(0, 5)).cards[0]!.counters).toEqual({ '': 5 })
    expect(apply(apply(on, counter(0, 5)), counter(0, -99)).cards[0]!.counters).toEqual({})
    expect(apply(apply(on, counter(0, 99)), counter(0, 99)).cards[0]!.counters).toEqual({ '': 99 })
    rejects(on, counter(0, 100))
    rejects(on, counter(0, 0))
    rejects(on, counter(0, 1.5))
    rejects(on, counter(1, 1))
    rejects(b0, counter(0, 1))
    const spell = run(draw(1), mv(0, 's2'), counter(0, 2))
    expect(spell.cards[0]!.counters).toEqual({ '': 2 })
  })

  it('counters of a kind are counted apart from the plain ones, and a kind at 0 is dropped', () => {
    const on = run(draw(1), mv(0, 'm0'), counter(0, 2), { t: 'counter', card: 0, delta: 1, kind: 'Spell' })
    expect(on.cards[0]!.counters).toEqual({ '': 2, Spell: 1 })
    expect(apply(on, { t: 'counter', card: 0, delta: -1, kind: 'Spell' }).cards[0]!.counters).toEqual({ '': 2 })
    expect(kindsIn([counter(0, 1), { t: 'counter', card: 0, delta: 1, kind: 'Spell' }, { t: 'counter', card: 0, delta: 1, kind: 'Spell' }, { t: 'counter', card: 0, delta: 1, kind: 'Ice' }])).toEqual(['Spell', 'Ice'])
    rejects(on, { t: 'counter', card: 0, delta: 1, kind: '' })
    rejects(on, { t: 'counter', card: 0, delta: 1, kind: 'x'.repeat(21) })
  })

  it('negate and flip only touch a field card that is not a material', () => {
    const on = run(draw(2), mv(0, 'm0'), mv(1, 'm0'))
    expect(apply(on, negate(0, true)).cards[0]!.negated).toBe(true)
    expect(apply(apply(on, negate(0, true)), negate(0, false)).cards[0]!.negated).toBe(false)
    expect(apply(on, flip(0, 'down', 'def')).cards[0]).toMatchObject({ face: 'down', pos: 'def' })
    for (const a of [negate(1, true), flip(1, 'down', 'def'), negate(2, true), flip(2, 'down', 'def')]) rejects(on, a)
  })

  it('activate is valid for any card and returns the same board', () => {
    const b = run(draw(1))
    expect(isValid(b, activate(0, [3]))).toBe(true)
    expect(apply(b, activate(0, [3]))).toBe(b)
    expect(isValid(b, activate(5, []))).toBe(true)
    rejects(b, activate(0, [13]))
    rejects(b, activate(0, [-1]))
  })

  it('Life Points start at 8000 on each side, move by the delta and stop at 0', () => {
    expect(b0.lp).toEqual({ me: 8000, rival: 8000 })
    expect(run({ t: 'lp', side: 'rival', delta: -1500 }).lp).toEqual({ me: 8000, rival: 6500 })
    expect(run({ t: 'lp', side: 'me', delta: 500 }).lp.me).toBe(8500)
    expect(run({ t: 'lp', side: 'me', delta: -9000 }).lp.me).toBe(0)
    rejects(b0, { t: 'lp', side: 'me', delta: 0 })
    rejects(b0, { t: 'lp', side: 'me', delta: 1.5 })
    rejects(b0, { t: 'lp', side: 'me', delta: 1000000 })
  })

  it('the phase is set by hand, runs round, and a new turn opens in Main 1', () => {
    expect(b0.phase).toBe('main1')
    expect(run({ t: 'phase', to: 'battle' }).phase).toBe('battle')
    expect(run({ t: 'phase', to: 'end' }, { t: 'endTurn' }).phase).toBe('main1')
    expect(nextPhase('main1')).toBe('battle')
    expect(nextPhase('end')).toBe('draw')
  })

  it('chainAt is the run of activations up to the step on screen, the first link first', () => {
    const log: Action[] = [activate(1, []), draw(1), activate(2, []), activate(3, [2])]
    expect(chainAt(log, 0)).toEqual([])
    expect(chainAt(log, 1)).toEqual([1])
    expect(chainAt(log, 2)).toEqual([])
    expect(chainAt(log, 3)).toEqual([2])
    expect(chainAt(log, 4)).toEqual([2, 3])
  })

  it('endTurn adds a turn', () => {
    expect(run({ t: 'endTurn' }).turn).toBe(2)
    expect(run({ t: 'endTurn' }, { t: 'endTurn' }).turn).toBe(3)
  })

  it('ids out of range are invalid', () => {
    for (const id of [13, -1]) {
      for (const a of [mv(id, 'gy'), flip(id, 'up', 'atk'), negate(id, true), counter(id, 1), activate(id, [])]) rejects(b0, a)
    }
  })

  it('every card is in exactly one zone after any action', () => {
    const script: (Action | ((b: Board) => Action))[] = [
      draw(5),
      mv(0, 'm0'),
      mv(1, 'm0'),
      mv(2, 'm0', { at: 'top' }),
      mv(10, 'emz0'),
      mv(3, 's0', { face: 'down' }),
      mv(4, 'field'),
      counter(3, 2),
      negate(10, true),
      flip(10, 'up', 'def'),
      mv(2, 'm1'),
      mv(0, 'gy'),
      mv(2, 'emz0'),
      mv(10, 'banished', { face: 'down' }),
      (b) => ({ t: 'shuffle', order: [...b.zones.deck].reverse() }),
      draw(2),
      mv(3, 'hand'),
      mv(4, 'deck', { at: 'bottom' }),
      mv(11, 'extra', { at: 'bottom', face: 'up' }),
      mv(12, 'm4'),
      counter(12, 1),
      mv(12, 'extra'),
      { t: 'endTurn' },
      mv(10, 'extra', { face: 'up' }),
      activate(7, [1]),
      mv(9, 'm2'),
      mv(8, 'm2'),
      mv(3, 'm2', { at: 'top' }),
      mv(3, 'gy'),
      mv(6, 'hand'),
    ]
    expect(script).toHaveLength(30)
    let b = b0
    for (const step of script) {
      const a = typeof step === 'function' ? step(b) : step
      expect(isValid(b, a)).toBe(true)
      b = apply(b, a)
      expect(Object.values(b.zones).flat().sort((x, y) => x - y)).toEqual(ids)
    }
    expect(b.zones.gy).toEqual([3, 9, 8, 2, 1, 0])
  })

  it('timeline is deterministic and starts at initial', () => {
    const log = [draw(5), mv(0, 'm0'), mv(1, 'm0'), { t: 'endTurn' } as Action]
    const boards = timeline(deck, log)
    expect(boards).toHaveLength(log.length + 1)
    expect(boards[0]).toEqual(initial(deck))
    expect(timeline(deck, log)).toEqual(boards)
    expect(boards.at(-1)).toEqual(run(...log))
    expect(timeline(deck, [])).toEqual([b0])
  })

  it('validRun checks each action on the board the ones before it leave', () => {
    expect(validRun(b0, [])).toBe(true)
    // a counter needs the card on the field: invalid on b0, valid once the move before it ran
    expect(isValid(b0, counter(0, 2))).toBe(false)
    expect(validRun(b0, [mv(0, 'm0'), counter(0, 2)])).toBe(true)
    // each move is valid on b0, but the second finds the slot the first one filled
    expect(isValid(b0, mv(1, 's0'))).toBe(true)
    expect(validRun(b0, [mv(0, 's0'), mv(1, 's0')])).toBe(false)
    // the second draw finds the deck the first one emptied
    expect(isValid(b0, draw(1))).toBe(true)
    expect(validRun(b0, [draw(10), draw(1)])).toBe(false)
  })

  it('shuffleAction gives a valid permutation', () => {
    const a = shuffleAction(b0, () => 0.5)
    expect(isValid(b0, a)).toBe(true)
    expect(a.order).not.toEqual(b0.zones.deck)
    expect(b0.zones.deck).toEqual(ids.slice(0, 10))
    expect(isValid(b0, shuffleAction(b0))).toBe(true)
  })
})
