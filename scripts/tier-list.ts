/** The pure part of scripts/wiki-tier-list.ts: which decks a weekly article lists and how it says it. */
import { familyWeeks, plainDecks, shareMoves, type DeckAnswer, type DeckStat, type Family, type Meta } from '@utils/statistics'

/** The API's own floors for a tier: under them a deck can't be ranked, not even as "outside the tiers". */
export const MIN_SHARE = 0.005
export const MIN_PLAYERS = 10

/** `decks` come from `listed`: best expected rate first, and `tier` is `null` under the last anchor. */
export type Ladder = { label: 'TCG' | 'Genesys'; prefix: 'tcg' | 'genesys'; meta: Meta; decks: DeckStat[]; families: Family[]; answers: Map<string, DeckAnswer> }
export type Tier = 1 | 1.5 | 2 | 3 | 4

export const listed = (meta: Pick<Meta, 'decks'>) => plainDecks(meta.decks).filter((d) => d.share >= MIN_SHARE && d.players >= MIN_PLAYERS).sort((a, b) => b.wrExpected - a.wrExpected)

export const pct = (rate: number | null | undefined, digits = 1) => `${((rate ?? 0) * 100).toFixed(digits)}%`
export const and = (items: string[]) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`)
export const name = (deck: Pick<DeckStat, 'key' | 'name'>) => deck.name ?? `Archetype ${deck.key}`
export const tier = (ladder: Pick<Ladder, 'decks'>, t: Tier) => ladder.decks.filter((deck) => deck.tier === t)

/** The leaders, as a sentence that holds for one Tier 1 deck or for several. */
export const leaders = (ladder: Pick<Ladder, 'decks'>) => {
  const top = tier(ladder, 1)
  const [only] = top
  if (top.length === 1 && only) return `**${name(only)}** sits alone in Tier 1 with ${pct(only.share)} of the meta and an expected ${pct(only.wrExpected)} win rate.`
  return `${and(top.map((deck) => `**${name(deck)}** (${pct(deck.share)} of the meta, expected ${pct(deck.wrExpected)})`))} share Tier 1.`
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
