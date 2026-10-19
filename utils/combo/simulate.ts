import { satisfies } from './atoms'
import type { DeckCard } from './deck-cards'
import type { Rng } from './rng'
import { DRAW_EFFECTS, type Analysis, type Banish, type EffectKind, type Effects, type Hand, type Roles, type Subject } from './types'

/** The main deck as canonical ids: `ids[lo..]` is still in the deck, `ids[..lo)` has left it (hand, banished, bottom). */
export type Pile = { ids: number[]; lo: number }

/** Each card's id `copies` times, in deck order. */
export const expandIds = (cards: readonly DeckCard[]): number[] => cards.flatMap((c) => Array<number>(c.copies).fill(c.id))
export const newPile = (ids: readonly number[]): Pile => ({ ids: [...ids], lo: 0 })
export const poolSize = (pile: Pile): number => pile.ids.length - pile.lo

/** One Fisher–Yates step: a uniformly random card still in the deck comes to the front and leaves it. */
export const drawOne = (pile: Pile, rng: Rng): number | undefined => {
  const n = poolSize(pile)
  if (n === 0) return undefined
  const j = pile.lo + rng.int(n)
  const card = pile.ids[j]!
  pile.ids[j] = pile.ids[pile.lo]!
  pile.ids[pile.lo] = card
  pile.lo++
  return card
}

/** The last `k` cards drawn go back into the deck. Where they sit is irrelevant: the next draw is uniform over the pool. */
export const putBack = (pile: Pile, k: number): void => {
  pile.lo -= k
}

const count = (hand: readonly number[], roles: Roles, s: Subject): number => hand.reduce((sum, id) => (satisfies(id, roles, s) ? sum + 1 : sum), 0)

/** A hand with no rules is unfinished, never playable, as in `evaluate`. */
export const handPasses = (hand: readonly number[], roles: Roles, h: Hand): boolean =>
  h.rules.length > 0 &&
  h.rules.every((r) => {
    const c = count(hand, roles, r.subject)
    return c >= r.min && (r.max === null || c <= r.max)
  })

export type Skipped = 'lock' | 'once' | 'extraDeck' | 'deck'
export type EffectLog = { effect: EffectKind; drew: number[]; excavated: number[]; added: number | null; skipped: Skipped | null }
export type Context = { roles: Roles; analysis: Analysis; effects: Effects; extraSize: number }

/** What the Extra Deck lets a card banish: the wanted count, else 3, else nothing. */
export const banishable = (wanted: Banish, extraSize: number): 0 | 3 | 6 => (extraSize >= wanted ? wanted : extraSize >= 3 ? 3 : 0)

/**
 * The index of the excavated card to add: for each hand in order that the current hand misses, the first card that
 * completes it; else the first card that advances any rule (a subject still below that rule's max); else the first.
 */
export const pickExcavated = (excavated: readonly number[], hand: readonly number[], roles: Roles, analysis: Analysis): number => {
  for (const h of analysis.hands) {
    if (handPasses(hand, roles, h)) continue
    const i = excavated.findIndex((id) => handPasses([...hand, id], roles, h))
    if (i >= 0) return i
  }
  const advances = (id: number) => analysis.hands.some((h) => h.rules.some((r) => satisfies(id, roles, r.subject) && (r.max === null || count(hand, roles, r.subject) < r.max)))
  return Math.max(0, excavated.findIndex(advances))
}

const ORDER = Object.keys(DRAW_EFFECTS) as EffectKind[]
const ONCE: ReadonlySet<EffectKind> = new Set(['desires', 'prosperity', 'duality'])

/**
 * Resolves the toggled effect cards in `hand`, in the fixed order, under the cards' own rules: once per turn where the
 * text says so, Extravagance and Prosperity lock effect draws, Prosperity is refused after an effect draw, Extravagance
 * only as the first effect of the turn. Rounds repeat while something resolved, so an effect drawn by an effect resolves
 * too. Mutates `hand` and `pile`.
 */
export const resolveEffects = (hand: number[], pile: Pile, ctx: Context, rng: Rng): EffectLog[] => {
  const logs: EffectLog[] = []
  const used = new Set<EffectKind>()
  /** Copies attempted and refused, per kind: never attempted again (the refusal only gets firmer). */
  const blocked: Record<EffectKind, number> = { extravagance: 0, prosperity: 0, duality: 0, desires: 0, upstart: 0 }
  let drawLocked = false
  let drewByEffect = false
  let resolved = 0

  const draw = (n: number): number[] => Array.from({ length: n }, () => drawOne(pile, rng)!)
  const skip = (effect: EffectKind, skipped: Skipped): EffectLog => ({ effect, drew: [], excavated: [], added: null, skipped })
  const done = (effect: EffectKind, drew: number[] = [], excavated: number[] = [], added: number | null = null): EffectLog => ({ effect, drew, excavated, added, skipped: null })
  /** The pot is spent before anything else happens: it is no longer a card in hand. */
  const spend = (id: number) => hand.splice(hand.indexOf(id), 1)

  const attempt = (kind: EffectKind): EffectLog => {
    const id = DRAW_EFFECTS[kind]
    if (ONCE.has(kind) && used.has(kind)) return skip(kind, 'once')
    switch (kind) {
      case 'extravagance': {
        if (resolved > 0 || drawLocked) return skip(kind, 'lock')
        const n = banishable(ctx.effects.extravagance, ctx.extraSize)
        if (n === 0) return skip(kind, 'extraDeck')
        if (poolSize(pile) < n / 3) return skip(kind, 'deck')
        spend(id)
        const drew = draw(n / 3)
        hand.push(...drew)
        drawLocked = true
        drewByEffect = true
        return done(kind, drew)
      }
      case 'prosperity': {
        if (drewByEffect) return skip(kind, 'lock')
        const n = banishable(ctx.effects.prosperity, ctx.extraSize)
        if (n === 0) return skip(kind, 'extraDeck')
        if (poolSize(pile) < n) return skip(kind, 'deck')
        spend(id)
        used.add(kind)
        const excavated = draw(n)
        const added = excavated[pickExcavated(excavated, hand, ctx.roles, ctx.analysis)]!
        hand.push(added)
        drawLocked = true
        return done(kind, [], excavated, added)
      }
      case 'duality': {
        if (poolSize(pile) < 3) return skip(kind, 'deck')
        spend(id)
        used.add(kind)
        const excavated = draw(3)
        const pick = pickExcavated(excavated, hand, ctx.roles, ctx.analysis)
        // The chosen card takes the first excavated slot; the other two go back into the deck.
        const first = pile.lo - 3
        pile.ids[first + pick] = pile.ids[first]!
        pile.ids[first] = excavated[pick]!
        putBack(pile, 2)
        hand.push(excavated[pick]!)
        return done(kind, [], excavated, excavated[pick]!)
      }
      case 'desires': {
        if (drawLocked) return skip(kind, 'lock')
        if (poolSize(pile) < 12) return skip(kind, 'deck')
        spend(id)
        used.add(kind)
        draw(10) // banished face-down: out of the deck, never in hand
        const drew = draw(2)
        hand.push(...drew)
        drewByEffect = true
        return done(kind, drew)
      }
      case 'upstart': {
        if (drawLocked) return skip(kind, 'lock')
        if (poolSize(pile) < 1) return skip(kind, 'deck')
        spend(id)
        const drew = draw(1)
        hand.push(...drew)
        drewByEffect = true
        return done(kind, drew)
      }
    }
  }

  let again = true
  while (again) {
    again = false
    for (const kind of ORDER) {
      const id = DRAW_EFFECTS[kind]
      if (!ctx.effects.resolve.includes(id)) continue
      let copies = hand.filter((c) => c === id).length - blocked[kind]
      while (copies-- > 0) {
        const log = attempt(kind)
        logs.push(log)
        if (log.skipped) blocked[kind]++
        else {
          resolved++
          again = true
        }
      }
    }
  }
  return logs
}
