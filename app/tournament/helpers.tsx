import { twMerge } from 'tailwind-merge'
import type { CardFrame } from '@utils/deck/model'
import type { DeckCard, Standing, TournamentDeck, TournamentPlayer, TournamentRound } from '@utils/types'

/** Only `standings` carries full players; rounds reference them by id. */
export type Roster = Map<string, TournamentPlayer>
export const rosterOf = (standings: Standing[]): Roster => new Map(standings.map(({ player }) => [player.id, player]))

/** A duelist's result in one round. `pending`: still being played; `none`: not paired (dropped, or no pairing yet). */
export type RoundResult = 'W' | 'L' | 'D' | 'BYE' | 'pending' | 'none'

export const resultIn = (round: TournamentRound | undefined, playerId: string): RoundResult => {
  if (!round) return 'none'
  if (round.bye === playerId) return 'BYE'
  const match = round.matches.find((m) => m.player1 === playerId || m.player2 === playerId)
  if (!match) return 'none'
  if (match.outcome === 'unplayed') return 'pending'
  if (match.outcome === 'draw') return 'D'
  return match.outcome === (match.player1 === playerId ? 'player1' : 'player2') ? 'W' : 'L'
}

const PILL: Record<RoundResult, string> = {
  W: 'bg-win/15 text-win',
  L: 'bg-loss/15 text-loss',
  D: 'bg-draw/15 text-draw',
  BYE: 'bg-azure-lift/15 text-azure-lift',
  pending: 'border border-dashed border-line-mid text-ink-muted',
  none: 'border border-dashed border-line-mid text-ink-muted',
}
const TEXT: Record<RoundResult, string> = { W: 'W', L: 'L', D: 'D', BYE: 'BYE', pending: '⋯', none: '—' }

/** One round's result as a tinted mono pill. `label` names the pending and empty ones, which only show a glyph. */
export const Pill = ({ result, label, className }: { result: RoundResult; label?: string; className?: string }) => (
  <span
    aria-label={label}
    className={twMerge('inline-flex h-5.5 min-w-5.5 items-center justify-center rounded-xs px-1 font-mono text-[11px] leading-none font-bold', PILL[result], className)}
  >
    {TEXT[result]}
  </span>
)

/** Passcode → card frame, joined from `/cards`: the tournament API sends no card type. */
export type Frames = Record<number, CardFrame>

export const FRAME_BG: Record<CardFrame, string> = {
  normal: 'bg-type-normal',
  effect: 'bg-type-effect',
  ritual: 'bg-type-ritual',
  fusion: 'bg-type-fusion',
  synchro: 'bg-type-synchro',
  xyz: 'bg-type-xyz',
  link: 'bg-type-link',
  spell: 'bg-type-spell',
  trap: 'bg-type-trap',
}

/** Game order: monster frames, then spells, then traps. */
const FRAME_ORDER: CardFrame[] = ['normal', 'effect', 'ritual', 'fusion', 'synchro', 'xyz', 'link', 'spell', 'trap']
const rankOf = (frame: CardFrame | undefined) => (frame ? FRAME_ORDER.indexOf(frame) : FRAME_ORDER.length)

/** Monsters, spells, traps, then cards `/cards` didn't know; by name within a group. */
export const sortByFrame = (cards: DeckCard[], frames: Frames) =>
  [...cards].sort((a, b) => rankOf(frames[a.id]) - rankOf(frames[b.id]) || (a.name ?? '').localeCompare(b.name ?? ''))

/** Monsters, spells and traps among `cards`, counting copies. Cards without a known frame fall in none. */
export const kindsOf = (cards: DeckCard[], frames: Frames) => {
  const kinds = { monsters: 0, spells: 0, traps: 0 }
  for (const card of cards) {
    const frame = frames[card.id]
    if (frame === 'spell') kinds.spells += card.count
    else if (frame === 'trap') kinds.traps += card.count
    else if (frame) kinds.monsters += card.count
  }
  return kinds
}

/** The deck as the game names it, else its top archetype, else its stat grouping. */
export const deckName = (deck: TournamentDeck | null) => deck?.name ?? deck?.archetypes[0]?.name ?? deck?.archetype ?? null

/** Chart series, fixed order: archetype shares in a deck, archetypes in the stats. */
export const SERIES = [1, 2, 3, 4, 5, 6].map((n) => `var(--color-series-${n})`)

export const META = 'signal-sm text-ink-muted'
