import { canonicalOf, withCopies } from '@utils/combo/deck-cards'
import { addRole, toggleRole } from '@utils/combo/roles'
import { DEFAULT_DRAW, LIMITS, type Build, type Calculation, type Draw, type Hand, type Roles, type Rule, type Subject } from '@utils/combo/types'
import { EMPTY_DECK, MAX_COPIES, type CardMap, type Deck } from '@utils/deck/types'

/** The saved deck behind the build: what a roles save needs. Never part of the share link. */
export type Saved = { revision: number; ownerId: string }

export type CalcState = {
  calc: Calculation
  /** The deck as loaded: what-if copies edit the build, Restore comes back here. */
  original: Deck
  saved: Saved | null
}

export type CalcAction =
  /** Replaces the build. Roles of cards still in the new deck stay; the build's own roles merge in. */
  | { type: 'load'; build: Build; saved: Saved | null; cards?: CardMap }
  /** The saved deck behind the build arrived and its format and roles are adopted. Ignored when the build moved to another deck meanwhile. */
  | { type: 'deckMeta'; deckId: string; format: number | null; roles: Roles; saved: Saved | null }
  /** Only the saved deck's revision and owner: a share link keeps its own format and roles. Ignored when the build moved on. */
  | { type: 'setSaved'; deckId: string; saved: Saved | null }
  | { type: 'rename'; name: string }
  | { type: 'setFormat'; format: number | null }
  | { type: 'toggleRole'; id: number; role: string }
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

export const emptyCalculation = (): Calculation => ({
  builds: [{ name: '', deck: EMPTY_DECK, roles: new Map(), format: null, deckId: null }],
  analysis: { hands: [] },
  draw: DEFAULT_DRAW,
  focus: null,
})

export const initialState = (calc: Calculation, saved: Saved | null = null): CalcState => ({ calc, original: calc.builds[0]!.deck, saved })

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

const build = (s: CalcState): Build => s.calc.builds[0]!

const patchBuild = (s: CalcState, patch: Partial<Build>): CalcState => ({
  ...s,
  calc: { ...s.calc, builds: [{ ...build(s), ...patch }, ...s.calc.builds.slice(1)] },
})

const patchHands = (s: CalcState, hands: Hand[]): CalcState => ({ ...s, calc: { ...s.calc, analysis: { hands } } })

const patchHand = (s: CalcState, index: number, f: (hand: Hand) => Hand): CalcState => {
  const hand = s.calc.analysis.hands[index]
  return hand ? patchHands(s, s.calc.analysis.hands.map((h, i) => (i === index ? f(h) : h))) : s
}

export const calculatorReducer = (s: CalcState, a: CalcAction): CalcState => {
  switch (a.type) {
    case 'load': {
      const cards = a.cards ?? new Map()
      const inDeck = new Set([...a.build.deck.main, ...a.build.deck.extra, ...a.build.deck.side].map((p) => canonicalOf(p, cards)))
      const kept: Roles = new Map([...build(s).roles].filter(([id]) => inDeck.has(id)))
      return {
        calc: { ...s.calc, builds: [{ ...a.build, roles: mergeRoles(kept, a.build.roles) }, ...s.calc.builds.slice(1)] },
        original: a.build.deck,
        saved: a.saved,
      }
    }
    case 'deckMeta':
      if (build(s).deckId !== a.deckId) return s
      return { ...patchBuild(s, { format: a.format, roles: mergeRoles(build(s).roles, a.roles) }), saved: a.saved }
    case 'setSaved':
      return build(s).deckId === a.deckId ? { ...s, saved: a.saved } : s
    case 'rename':
      return patchBuild(s, { name: a.name.slice(0, LIMITS.name) })
    case 'setFormat':
      return patchBuild(s, { format: a.format })
    case 'toggleRole': {
      const roles = toggleRole(build(s).roles, a.id, a.role)
      return roles === build(s).roles ? s : patchBuild(s, { roles })
    }
    case 'setCopies': {
      const deck = build(s).deck
      return patchBuild(s, { deck: { ...deck, main: withCopies(deck.main, a.id, clamp(a.copies, [0, MAX_COPIES]), a.cards, a.passcode) } })
    }
    case 'restoreDeck':
      return patchBuild(s, { deck: s.original })
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
  }
}
