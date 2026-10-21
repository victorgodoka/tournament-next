import { canonicalOf, withCopies } from '@utils/combo/deck-cards'
import { randomSeed } from '@utils/combo/rng'
import { addRole, removeRole, toggleRole } from '@utils/combo/roles'
import { DEFAULT_DRAW, DEFAULT_EFFECTS, EFFECT_IDS, LIMITS, type Banish, type Build, type Calculation, type Draw, type Hand, type Roles, type Rule, type Subject } from '@utils/combo/types'
import { EMPTY_DECK, MAX_COPIES, type CardMap, type Deck } from '@utils/deck/types'

/** The saved deck behind a build: what a roles save needs. Never part of the share link. */
export type Saved = { revision: number; ownerId: string }

export type CalcState = {
  calc: Calculation
  /** The build the editor shows; the compare table and the link carry them all. */
  active: number
  /** Per build, aligned with `calc.builds`: the deck as loaded. What-if copies edit the build, Restore comes back here. */
  originals: Deck[]
  /** Per build, aligned with `calc.builds`. */
  saved: (Saved | null)[]
}

export type CalcAction =
  /** Replaces the active build. Roles of cards still in the new deck stay; the build's own roles merge in. */
  | { type: 'load'; build: Build; saved: Saved | null; cards?: CardMap }
  /** Appends a build and shows it. Ignored at the limit. */
  | { type: 'addBuild'; build: Build; saved: Saved | null }
  /** A what-if copy of the active build: same deck, roles and format, no saved deck behind it. Ignored at the limit. */
  | { type: 'duplicateBuild'; name: string }
  /** Ignored with one build left. */
  | { type: 'removeBuild'; index: number }
  | { type: 'setActive'; index: number }
  /** A saved deck arrived and every build it backs adopts its format and roles. Ignored when no build points at it. */
  | { type: 'deckMeta'; deckId: string; format: number | null; roles: Roles; saved: Saved | null }
  /** Only the saved deck's revision and owner: a share link keeps its own format and roles. Ignored when no build points at it. */
  | { type: 'setSaved'; deckId: string; saved: Saved | null }
  | { type: 'rename'; name: string }
  | { type: 'setFormat'; format: number | null }
  | { type: 'toggleRole'; id: number; role: string }
  /** Puts the tag on the card (`on`) or takes it off; the same state back when it is already so. */
  | { type: 'setRole'; id: number; role: string; on: boolean }
  | { type: 'setCopies'; id: number; copies: number; passcode: number; cards: CardMap }
  | { type: 'restoreDeck' }
  | { type: 'addHand'; hand?: Hand }
  | { type: 'removeHand'; index: number }
  | { type: 'renameHand'; index: number; name: string }
  | { type: 'addRule'; hand: number; rule: Rule }
  | { type: 'setRule'; hand: number; index: number; rule: Rule }
  | { type: 'removeRule'; hand: number; index: number }
  | { type: 'setDraw'; draw: Partial<Draw> }
  | { type: 'setFocus'; focus: Subject | null }
  /** The simulator's seed: Deal again moves it. */
  | { type: 'setSeed'; seed: number }
  /** Resolve this draw-effect card when it is drawn. Ignored for a card the simulator has no script for. */
  | { type: 'toggleEffect'; id: number }
  | { type: 'setBanish'; card: 'prosperity' | 'extravagance'; count: Banish }

/** A fresh calculation deals from a random seed; tests pass one. */
export const emptyCalculation = (seed: number = randomSeed()): Calculation => ({
  builds: [{ name: '', deck: EMPTY_DECK, roles: new Map(), format: null, deckId: null }],
  analysis: { hands: [] },
  draw: DEFAULT_DRAW,
  focus: null,
  seed,
  effects: DEFAULT_EFFECTS,
})

export const initialState = (calc: Calculation, saved: Saved | null = null): CalcState => ({
  calc,
  active: 0,
  originals: calc.builds.map((b) => b.deck),
  saved: calc.builds.map((_, i) => (i === 0 ? saved : null)),
})

const DEFAULT_HAND: Hand = { name: '', rules: [{ subject: { kind: 'role', role: 'Starter' }, min: 1, max: null }] }

const clamp = (n: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, Math.round(n)))

const clampRule = (rule: Rule): Rule => {
  const min = clamp(rule.min, LIMITS.rule)
  return { ...rule, min, max: rule.max === null ? null : clamp(rule.max, [min, LIMITS.rule[1]]) }
}

/** `into` plus every role of `from`, deduped, capped at 8 per card. */
const mergeRoles = (into: Roles, from: Roles): Roles => {
  let out = into
  for (const [id, list] of from) for (const role of list) out = addRole(out, id, role)
  return out
}

const at = <T,>(list: readonly T[], index: number, value: T): T[] => list.map((v, i) => (i === index ? value : v))

const build = (s: CalcState): Build => s.calc.builds[s.active]!

const patchBuild = (s: CalcState, patch: Partial<Build>): CalcState => ({
  ...s,
  calc: { ...s.calc, builds: at(s.calc.builds, s.active, { ...build(s), ...patch }) },
})

const patchHands = (s: CalcState, hands: Hand[]): CalcState => ({ ...s, calc: { ...s.calc, analysis: { hands } } })

const patchHand = (s: CalcState, index: number, f: (hand: Hand) => Hand): CalcState => {
  const hand = s.calc.analysis.hands[index]
  return hand ? patchHands(s, s.calc.analysis.hands.map((h, i) => (i === index ? f(h) : h))) : s
}

/** Appends a build and makes it the active one. */
const append = (s: CalcState, b: Build, original: Deck, saved: Saved | null): CalcState =>
  s.calc.builds.length >= LIMITS.builds
    ? s
    : { calc: { ...s.calc, builds: [...s.calc.builds, b] }, active: s.calc.builds.length, originals: [...s.originals, original], saved: [...s.saved, saved] }

export const calculatorReducer = (s: CalcState, a: CalcAction): CalcState => {
  switch (a.type) {
    case 'load': {
      const cards = a.cards ?? new Map()
      const inDeck = new Set([...a.build.deck.main, ...a.build.deck.extra, ...a.build.deck.side].map((p) => canonicalOf(p, cards)))
      const kept: Roles = new Map([...build(s).roles].filter(([id]) => inDeck.has(id)))
      return {
        ...s,
        calc: { ...s.calc, builds: at(s.calc.builds, s.active, { ...a.build, roles: mergeRoles(kept, a.build.roles) }) },
        originals: at(s.originals, s.active, a.build.deck),
        saved: at(s.saved, s.active, a.saved),
      }
    }
    case 'addBuild':
      return append(s, a.build, a.build.deck, a.saved)
    case 'duplicateBuild':
      return append(s, { ...build(s), name: a.name.slice(0, LIMITS.name), deckId: null }, s.originals[s.active]!, null)
    case 'removeBuild': {
      const n = s.calc.builds.length
      if (n <= 1 || a.index < 0 || a.index >= n) return s
      const drop = <T,>(list: readonly T[]) => list.filter((_, i) => i !== a.index)
      // A build before the active one shifts it down; the active one gone, the next takes its place (or the last).
      const active = a.index < s.active ? s.active - 1 : Math.min(s.active, n - 2)
      return { calc: { ...s.calc, builds: drop(s.calc.builds) }, active, originals: drop(s.originals), saved: drop(s.saved) }
    }
    case 'setActive':
      return { ...s, active: clamp(a.index, [0, s.calc.builds.length - 1]) }
    case 'deckMeta': {
      const hit = s.calc.builds.map((b) => b.deckId === a.deckId)
      if (!hit.some(Boolean)) return s
      return {
        ...s,
        calc: { ...s.calc, builds: s.calc.builds.map((b, i) => (hit[i] ? { ...b, format: a.format, roles: mergeRoles(b.roles, a.roles) } : b)) },
        saved: s.saved.map((v, i) => (hit[i] ? a.saved : v)),
      }
    }
    case 'setSaved': {
      const hit = s.calc.builds.map((b) => b.deckId === a.deckId)
      return hit.some(Boolean) ? { ...s, saved: s.saved.map((v, i) => (hit[i] ? a.saved : v)) } : s
    }
    case 'rename':
      return patchBuild(s, { name: a.name.slice(0, LIMITS.name) })
    case 'setFormat':
      return patchBuild(s, { format: a.format })
    case 'toggleRole': {
      const roles = toggleRole(build(s).roles, a.id, a.role)
      return roles === build(s).roles ? s : patchBuild(s, { roles })
    }
    case 'setRole': {
      const roles = (a.on ? addRole : removeRole)(build(s).roles, a.id, a.role)
      return roles === build(s).roles ? s : patchBuild(s, { roles })
    }
    case 'setCopies': {
      const deck = build(s).deck
      return patchBuild(s, { deck: { ...deck, main: withCopies(deck.main, a.id, clamp(a.copies, [0, MAX_COPIES]), a.cards, a.passcode) } })
    }
    case 'restoreDeck':
      return patchBuild(s, { deck: s.originals[s.active]! })
    case 'addHand':
      return s.calc.analysis.hands.length >= LIMITS.hands ? s : patchHands(s, [...s.calc.analysis.hands, a.hand ?? DEFAULT_HAND])
    case 'removeHand':
      return patchHands(s, s.calc.analysis.hands.filter((_, i) => i !== a.index))
    case 'renameHand':
      return patchHand(s, a.index, (h) => ({ ...h, name: a.name.slice(0, LIMITS.handName) }))
    case 'addRule':
      return patchHand(s, a.hand, (h) => (h.rules.length >= LIMITS.rules ? h : { ...h, rules: [...h.rules, clampRule(a.rule)] }))
    case 'setRule':
      return patchHand(s, a.hand, (h) => ({ ...h, rules: h.rules.map((r, i) => (i === a.index ? clampRule(a.rule) : r)) }))
    case 'removeRule':
      return patchHand(s, a.hand, (h) => ({ ...h, rules: h.rules.filter((_, i) => i !== a.index) }))
    case 'setDraw': {
      const d = { ...s.calc.draw, ...a.draw }
      return {
        ...s,
        calc: {
          ...s.calc,
          draw: {
            going: d.going === 'second' ? 'second' : 'first',
            handSize: d.handSize === null ? null : clamp(d.handSize, LIMITS.handSize),
            extraDraws: clamp(d.extraDraws, LIMITS.extraDraws),
            turn: clamp(d.turn, LIMITS.turn),
          },
        },
      }
    }
    case 'setFocus':
      return { ...s, calc: { ...s.calc, focus: a.focus } }
    case 'setSeed':
      return { ...s, calc: { ...s.calc, seed: a.seed >>> 0 } }
    case 'toggleEffect': {
      if (!EFFECT_IDS.includes(a.id)) return s
      const { resolve } = s.calc.effects
      const next = resolve.includes(a.id) ? resolve.filter((id) => id !== a.id) : [...resolve, a.id]
      return { ...s, calc: { ...s.calc, effects: { ...s.calc.effects, resolve: next } } }
    }
    case 'setBanish':
      return { ...s, calc: { ...s.calc, effects: { ...s.calc.effects, [a.card]: a.count } } }
  }
}
