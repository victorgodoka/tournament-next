import { describe, expect, it } from 'vitest'
import { DEFAULT_DRAW, type Build, type Roles } from '@utils/combo/types'
import type { Deck } from '@utils/deck/types'
import { calculatorReducer, emptyCalculation, initialState, type CalcState } from './calculator.reducer'

const build = (deck: Partial<Deck>, roles: Roles = new Map()): Build => ({
  name: '',
  deck: { main: [], extra: [], side: [], ...deck },
  roles,
  format: null,
  deckId: null,
})

describe('calculator reducer', () => {
  it("load keeps roles of cards that stay and merges the new build's roles", () => {
    const s0 = initialState({ ...emptyCalculation(), builds: [build({ main: [1, 2] }, new Map([[1, ['Starter']], [2, ['Brick']]]))] }, { revision: 1, ownerId: 'u1' })
    const s1 = calculatorReducer(s0, { type: 'load', build: build({ main: [1, 3] }, new Map([[1, ['engine']], [3, ['Hand Trap']]])), saved: null })
    expect(s1.calc.builds[0]!.roles).toEqual(new Map([[1, ['Starter', 'engine']], [3, ['Hand Trap']]]))
    expect(s1.originals[0]).toEqual({ main: [1, 3], extra: [], side: [] })
    expect(s1.saved[0]).toBeNull()
  })
  it('deckMeta adopts the saved deck\'s format, roles and revision, only for the deck the build came from', () => {
    const s0 = initialState({ ...emptyCalculation(), builds: [{ ...build({ main: [1] }), deckId: 'abcdefabcdefabcd' }] })
    const s1 = calculatorReducer(s0, { type: 'deckMeta', deckId: 'abcdefabcdefabcd', format: 2, roles: new Map([[1, ['Starter']]]), saved: { revision: 3, ownerId: 'u1' } })
    expect(s1.calc.builds[0]).toMatchObject({ deckId: 'abcdefabcdefabcd', format: 2, roles: new Map([[1, ['Starter']]]) })
    expect(s1.saved[0]).toEqual({ revision: 3, ownerId: 'u1' })
    // A reply for a deck the build has left (the user picked another one meanwhile) is dropped.
    expect(calculatorReducer(s1, { type: 'deckMeta', deckId: 'bbbbbbbbbbbbbbbb', format: 9, roles: new Map([[1, ['Brick']]]), saved: { revision: 1, ownerId: 'u2' } })).toBe(s1)
  })
  it('setSaved learns the revision and owner without touching format or roles', () => {
    const s0 = initialState({ ...emptyCalculation(), builds: [{ ...build({ main: [1] }, new Map([[1, ['Starter']]])), format: 4, deckId: 'abcdefabcdefabcd' }] })
    const s1 = calculatorReducer(s0, { type: 'setSaved', deckId: 'abcdefabcdefabcd', saved: { revision: 7, ownerId: 'u1' } })
    expect(s1.saved[0]).toEqual({ revision: 7, ownerId: 'u1' })
    expect(s1.calc.builds[0]).toMatchObject({ format: 4, roles: new Map([[1, ['Starter']]]) })
    expect(calculatorReducer(s1, { type: 'setSaved', deckId: 'bbbbbbbbbbbbbbbb', saved: null })).toBe(s1)
  })
  it('what-if copies edit main and restore brings the loaded deck back', () => {
    const s0 = initialState({ ...emptyCalculation(), builds: [build({ main: [1, 1, 2] })] })
    const s1 = calculatorReducer(s0, { type: 'setCopies', id: 1, copies: 3, passcode: 1, cards: new Map() })
    expect(s1.calc.builds[0]!.deck.main).toEqual([1, 1, 2, 1])
    const s2 = calculatorReducer(s1, { type: 'setCopies', id: 1, copies: 0, passcode: 1, cards: new Map() })
    expect(s2.calc.builds[0]!.deck.main).toEqual([2])
    expect(calculatorReducer(s2, { type: 'setCopies', id: 1, copies: 9, passcode: 1, cards: new Map() }).calc.builds[0]!.deck.main).toEqual([2, 1, 1, 1])
    expect(calculatorReducer(s2, { type: 'restoreDeck' }).calc.builds[0]!.deck.main).toEqual([1, 1, 2])
  })
  it('toggles roles, renames and sets the format', () => {
    const s0 = initialState({ ...emptyCalculation(), builds: [build({ main: [1] })] })
    const s1 = calculatorReducer(s0, { type: 'toggleRole', id: 1, role: 'Starter' })
    expect(s1.calc.builds[0]!.roles.get(1)).toEqual(['Starter'])
    expect(calculatorReducer(s1, { type: 'toggleRole', id: 1, role: 'starter' }).calc.builds[0]!.roles.has(1)).toBe(false)
    expect(calculatorReducer(s1, { type: 'rename', name: 'x'.repeat(90) }).calc.builds[0]!.name).toHaveLength(80)
    expect(calculatorReducer(s1, { type: 'setFormat', format: 4 }).calc.builds[0]!.format).toBe(4)
  })
  it('clamps rules and draw settings', () => {
    const s0 = calculatorReducer(initialState(emptyCalculation()), { type: 'addHand' })
    expect(s0.calc.analysis.hands[0]).toEqual({ name: '', rules: [{ subject: { kind: 'role', role: 'Starter' }, min: 1, max: null }] })
    const s1 = calculatorReducer(s0, { type: 'setRule', hand: 0, index: 0, rule: { subject: { kind: 'role', role: 'Starter' }, min: 25, max: 1 } })
    expect(s1.calc.analysis.hands[0]!.rules[0]).toEqual({ subject: { kind: 'role', role: 'Starter' }, min: 20, max: 20 })
    expect(calculatorReducer(s1, { type: 'setDraw', draw: { turn: 0, extraDraws: 99 } }).calc.draw).toEqual({ ...DEFAULT_DRAW, turn: 1, extraDraws: 20 })
    expect(calculatorReducer(s1, { type: 'setDraw', draw: { handSize: 0 } }).calc.draw.handSize).toBe(1)
    const twelve = Array.from({ length: 11 }).reduce<CalcState>((s) => calculatorReducer(s, { type: 'addHand' }), s0)
    expect(twelve.calc.analysis.hands).toHaveLength(12)
    expect(calculatorReducer(twelve, { type: 'addHand' })).toBe(twelve)
  })
  it('adds, edits and removes hands and rules, and sets the focus', () => {
    const s0 = calculatorReducer(initialState(emptyCalculation()), { type: 'addHand', hand: { name: 'Combo', rules: [] } })
    const s1 = calculatorReducer(s0, { type: 'addRule', hand: 0, rule: { subject: { kind: 'card', id: 7 }, min: 1, max: null } })
    expect(s1.calc.analysis.hands[0]!.rules).toHaveLength(1)
    expect(calculatorReducer(s1, { type: 'renameHand', index: 0, name: 'y'.repeat(50) }).calc.analysis.hands[0]!.name).toHaveLength(40)
    expect(calculatorReducer(s1, { type: 'removeRule', hand: 0, index: 0 }).calc.analysis.hands[0]!.rules).toEqual([])
    expect(calculatorReducer(s1, { type: 'removeHand', index: 0 }).calc.analysis.hands).toEqual([])
    expect(calculatorReducer(s1, { type: 'setFocus', focus: { kind: 'card', id: 7 } }).calc.focus).toEqual({ kind: 'card', id: 7 })
  })
  it('adds, duplicates, selects and removes builds, keeping originals and saved aligned', () => {
    const s0 = initialState({ ...emptyCalculation(), builds: [build({ main: [1, 1] })] }, { revision: 1, ownerId: 'u1' })
    const s1 = calculatorReducer(s0, { type: 'addBuild', build: { ...build({ main: [2] }), deckId: 'abcdefabcdefabcd' }, saved: { revision: 4, ownerId: 'u1' } })
    expect(s1.active).toBe(1)
    expect(s1.originals).toEqual([{ main: [1, 1], extra: [], side: [] }, { main: [2], extra: [], side: [] }])
    expect(s1.saved).toEqual([{ revision: 1, ownerId: 'u1' }, { revision: 4, ownerId: 'u1' }])
    const s2 = calculatorReducer(s1, { type: 'duplicateBuild', name: 'B copy' })
    expect(s2.active).toBe(2)
    expect(s2.calc.builds[2]).toEqual({ ...s1.calc.builds[1]!, name: 'B copy', deckId: null })
    expect(s2.saved[2]).toBeNull()
    expect(s2.originals[2]).toEqual({ main: [2], extra: [], side: [] })
    const s3 = calculatorReducer(s2, { type: 'setCopies', id: 2, copies: 3, passcode: 2, cards: new Map() })
    expect(s3.calc.builds[2]!.deck.main).toEqual([2, 2, 2]) // the active build
    expect(s3.calc.builds[1]!.deck.main).toEqual([2]) // the source untouched
    expect(calculatorReducer(s3, { type: 'restoreDeck' }).calc.builds[2]!.deck.main).toEqual([2])
    const s4 = calculatorReducer(s3, { type: 'setActive', index: 0 })
    expect(s4.active).toBe(0)
    expect(calculatorReducer(s4, { type: 'setActive', index: 9 }).active).toBe(2)
    const s5 = calculatorReducer({ ...s4, active: 2 }, { type: 'removeBuild', index: 0 })
    expect(s5.calc.builds.map((b) => b.name)).toEqual(['', 'B copy'])
    expect(s5.active).toBe(1)
    expect(s5.saved).toEqual([{ revision: 4, ownerId: 'u1' }, null])
    expect(s5.originals).toHaveLength(2)
    const s6 = calculatorReducer({ ...s5, active: 0 }, { type: 'removeBuild', index: 0 })
    expect(s6.calc.builds.map((b) => b.name)).toEqual(['B copy'])
    expect(s6.active).toBe(0)
    expect(calculatorReducer(s6, { type: 'removeBuild', index: 0 })).toBe(s6)
  })
  it('stops at six builds', () => {
    const six = Array.from({ length: 5 }).reduce<CalcState>((s) => calculatorReducer(s, { type: 'addBuild', build: build({ main: [1] }), saved: null }), initialState(emptyCalculation()))
    expect(six.calc.builds).toHaveLength(6)
    expect(calculatorReducer(six, { type: 'addBuild', build: build({ main: [1] }), saved: null })).toBe(six)
    expect(calculatorReducer(six, { type: 'duplicateBuild', name: 'x' })).toBe(six)
  })
  it('load replaces the active build; deckMeta and setSaved find a build by its deck id', () => {
    const s0 = calculatorReducer(initialState({ ...emptyCalculation(), builds: [build({ main: [1] })] }), { type: 'addBuild', build: { ...build({ main: [2] }), deckId: 'abcdefabcdefabcd' }, saved: null })
    const s1 = calculatorReducer({ ...s0, active: 0 }, { type: 'load', build: build({ main: [3] }), saved: null })
    expect(s1.calc.builds.map((b) => b.deck.main)).toEqual([[3], [2]])
    expect(s1.originals[0]).toEqual({ main: [3], extra: [], side: [] })
    const s2 = calculatorReducer(s1, { type: 'deckMeta', deckId: 'abcdefabcdefabcd', format: 2, roles: new Map([[2, ['Starter']]]), saved: { revision: 3, ownerId: 'u1' } })
    expect(s2.calc.builds[1]).toMatchObject({ format: 2, roles: new Map([[2, ['Starter']]]) })
    expect(s2.calc.builds[0]!.format).toBeNull()
    expect(s2.saved).toEqual([null, { revision: 3, ownerId: 'u1' }])
    expect(calculatorReducer(s2, { type: 'setSaved', deckId: 'bbbbbbbbbbbbbbbb', saved: null })).toBe(s2)
  })
})
