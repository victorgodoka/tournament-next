/** The pure part of scripts/wiki-tier-list.ts: which decks a weekly article lists and how it says it. */
import { familyWeeks, leadOf, plainDecks, shareMoves, type DeckAnswer, type DeckStat, type Family, type Meta } from '@utils/statistics'

/**
 * The tier rules a build ran with (`fit.tiers`, from 2026-11-03 on): how far under the leader's expected win rate a deck
 * may sit for Tier 1 (the second deck only, further ones are 1.5), Tier 2 and Tier 3, as rates; past `t3Gap` is Tier 4.
 * `minShare` and `minPlayers` are the format's floors: under them a deck has no tier.
 */
export type TierRules = { t1Gap: number; t2Gap: number; t3Gap: number; minShare: number; minPlayers: number }

/** `decks` come from `listed`: best expected rate first, every one of them tiered. */
export type Ladder = { label: 'TCG' | 'Genesys'; prefix: 'tcg' | 'genesys'; meta: Meta; rules: TierRules; decks: DeckStat[]; families: Family[]; answers: Map<string, DeckAnswer> }
export type Tier = 1 | 1.5 | 2 | 3 | 4

/** Decks in Tier 1 at most: the leader and one more. The server's `T1_SLOTS`. */
export const T1_SLOTS = 2

/**
 * The build's tier rules. Refuses a build without them, or one from before the tiers became relative to the leader:
 * the method section would explain a rule the tiers don't follow.
 */
export const rulesOf = (meta: Pick<Meta, 'fit'>, label: string): TierRules => {
  const tiers = meta.fit.tiers as unknown as Partial<TierRules> | null | undefined
  const keys = ['t1Gap', 't2Gap', 't3Gap', 'minShare', 'minPlayers'] as const
  if (!tiers || keys.some((key) => typeof tiers[key] !== 'number'))
    throw new Error(`The ${label} build has no relative tier rules (fit.tiers: ${JSON.stringify(tiers ?? null)}). Rebuild the statistics on the current server before writing the articles.`)
  return tiers as TierRules
}

/** The API tiers every plain deck over the floors: those are the ones listed, best expected rate first, ties by key as the server breaks them. */
export const listed = (meta: Pick<Meta, 'decks'>) =>
  plainDecks(meta.decks)
    .filter((d) => d.tier !== null)
    .sort((a, b) => b.wrExpected - a.wrExpected || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))

export const pct = (rate: number | null | undefined, digits = 1) => `${((rate ?? 0) * 100).toFixed(digits)}%`
/** A gap in rate as points, without trailing zeros: 0.0075 is "0.75", 0.025 is "2.5". */
export const gapPoints = (gap: number) => String(Number((gap * 100).toFixed(2)))
export const and = (items: string[]) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`)
/** Without `<` or `>`: the wiki refuses raw HTML, and a setcode name can carry them, as card names do. */
export const name = (deck: Pick<DeckStat, 'key' | 'name'>) => (deck.name ?? `Archetype ${deck.key.endsWith('*') ? leadOf(deck.key) : deck.key}`).replace(/[<>]/g, '')
export const tier = (ladder: Pick<Ladder, 'decks'>, t: Tier) => ladder.decks.filter((deck) => deck.tier === t)

/** Points of expected win rate under the leader: 0 for the leader. */
export const behind = (ladder: Pick<Ladder, 'decks'>, deck: Pick<DeckStat, 'wrExpected'>) => ((ladder.decks[0]?.wrExpected ?? deck.wrExpected) - deck.wrExpected) * 100

/** The leaders, as a sentence that holds for one Tier 1 deck or for two. */
export const leaders = (ladder: Pick<Ladder, 'decks'>) => {
  const [first, second] = tier(ladder, 1)
  if (!first) return ''
  if (!second) return `**${name(first)}** holds Tier 1 alone, with an expected ${pct(first.wrExpected)} win rate and ${pct(first.share)} of the meta.`
  return `**${name(first)}** (expected ${pct(first.wrExpected)}, ${pct(first.share)} of the meta) and **${name(second)}** (expected ${pct(second.wrExpected)}, ${pct(second.share)} of the meta) share Tier 1, ${gapPoints(behind(ladder, second) / 100)} points apart.`
}

/** `family` is the `A*` row; `deck` its most played member among the listed decks, `null` when none made the floors. */
export type Move = { family: DeckStat; deck: DeckStat | null; delta: number }

const moves = (ladder: Pick<Ladder, 'decks' | 'meta' | 'families'>, kind: 'risers' | 'fallers'): Move[] => {
  const byKey = new Map(ladder.families.map((f) => [f.family.key, f]))
  const listedByKey = new Map(ladder.decks.map((d) => [d.key, d]))
  return shareMoves(familyWeeks(ladder.meta.weeks, ladder.families), Infinity)[kind].map(({ key, delta }) => {
    const { family, members } = byKey.get(key)!
    const member = members.find((m) => listedByKey.has(m.key))
    return { family, deck: member ? listedByKey.get(member.key)! : null, delta }
  })
}
/** Share moves of the last week by family, biggest first. Every family: one can move a lot before it earns a tier. */
export const risers = (ladder: Pick<Ladder, 'decks' | 'meta' | 'families'>) => moves(ladder, 'risers')
export const fallers = (ladder: Pick<Ladder, 'decks' | 'meta' | 'families'>) => moves(ladder, 'fallers')
