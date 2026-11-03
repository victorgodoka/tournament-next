/**
 * The public ranked statistics: omega-server-v3 docs/front/STATISTICS_API.md.
 * Rates are 0–1 fractions, `null` when their denominator is 0; `games` are the deck's own games.
 */
import type { Size } from '@omega/infographic/infographic'
import { API_URL } from '@utils/auth'
import { log } from '@utils/log'
import type { RankedLadderId, Tier } from '@utils/types'

/**
 * The wide and tall URLs of one PNG route: `path?…query&size=wide|tall`. Not beside `InfographicLinks`:
 * that is a client module, and PlayerStatistics, a server component, calls this.
 */
export const infographicHrefs = (path: string, query: Record<string, string>): Record<Size, string> => ({
  wide: `${path}?${new URLSearchParams({ ...query, size: 'wide' })}`,
  tall: `${path}?${new URLSearchParams({ ...query, size: 'tall' })}`,
})

/** Hourly counts by UTC hour, moved to a clock `offset` hours behind UTC (`getTimezoneOffset() / 60`). */
export const localHours = (hours: readonly number[], offset: number) => hours.map((_, hour) => hours[Math.floor(((hour + offset) % 24 + 24) % 24)] ?? 0)

export type Result<T> = { ok: true; data: T } | { ok: false; status: number }

export type Window = 'season' | 'last7'
/** What every statistics page reads from the URL. `season` (a code) wins over `ladder` server-side. */
export type Scope = { ladder: RankedLadderId; season?: string; window: Window; band: string }
export type StatisticsScope = Pick<Scope, 'ladder' | 'season'> & Partial<Scope>

export const BANDS = ['aggregate', 'all', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Omega'] as const

/** `searchParams` to a scope; anything the API would answer 400 to is the default. */
export const scopeFrom = (q: { ladder?: string | string[]; season?: string | string[]; window?: string | string[]; band?: string | string[] }): Scope => ({
  ladder: q.ladder === 'genesys' ? 'genesys' : 'tcg',
  season: typeof q.season === 'string' && q.season ? q.season : undefined,
  window: q.window === 'last7' ? 'last7' : 'season',
  band: (BANDS as readonly unknown[]).includes(q.band) ? (q.band as string) : 'aggregate',
})

export const scopeQuery = ({ ladder, season, window = 'season', band = 'aggregate' }: StatisticsScope) =>
  new URLSearchParams({ ...(season ? { season } : { ladder }), ...(window === 'season' ? {} : { window }), ...(band === 'aggregate' ? {} : { band }) }).toString()

/** The aggregate band has nothing to show: the API answers 404, or serves its row with no games. */
export const aggregateEmpty = (result: Result<{ fit: { games: number } }>) => (result.ok ? result.data.fit.games === 0 : result.status === 404)

export const statisticsHref = (scope: StatisticsScope) => `/statistics?${scopeQuery(scope)}`
/** `*` stays readable in the path; `>` goes as %3E. */
export const deckHref = (key: string, scope: StatisticsScope) => `/statistics/archetypes/${encodeURIComponent(key)}?${scopeQuery(scope)}`
export const cardHref = (id: number, scope: StatisticsScope) => `/statistics/cards/${id}?${scopeQuery(scope)}`

export type Season = { id: number; code: string; ladder: RankedLadderId; label: string; startsAt: string; endsAt: string | null; sweptThrough: string | null }
/** Games each filter removed (on the `all` band only), and the aggregate band's floor tier. */
export type Dropped = { players: number; lists: number; iron: number; total: number }
/** The tier marks (min `wrExpected` per tier) and floors the build ran with. */
export type TierRules = { t1: number; t15: number; t2: number; t3: number; t4: number; minShare: number; minPlayers: number }
export type Fit = {
  band: string; players: number; games: number; decks: number; firstEffect: number; ratingEffect: number; matchupStrength: number; cardStrength: number; phiMedian: number
  builtAt: string; dropped: Dropped | null; aggregateFloor: string
  /** `null` from a build before 2026-11-03, absent from an older server. */
  tiers?: TierRules | null
}

export type DeckStat = {
  /** `''` unknown, `A`, `A>B` (A leads) or `A*` (every key A leads, summed). Use it as the id; `name` is only the label. */
  key: string
  name: string | null
  /** The card that stands for it (sample-deck cover, else its most included card); absent from an older server. */
  face?: number | null
  games: number
  matches: number
  players: number
  share: number
  wins: number
  losses: number
  draws: number
  wrRaw: number | null
  strength: number
  strengthSe: number
  phi: number
  /** The headline: the win rate the model expects against the window's field, with its 95% interval. */
  wrExpected: number
  wrLo: number
  wrHi: number
  /** `null` under the floors (0.5% share, 10 duelists) or the anchors, even with `wrExpected` present. */
  tier: 1 | 1.5 | 2 | 3 | 4 | null
  firstEffect: number
  firstSe: number
  g1Games: number
  g1Wr: number | null
  postGames: number
  postWr: number | null
  firstG1Wr: number | null
  secondG1Wr: number | null
  /** Their games; `null` from a build before 2026-11-03, absent from an older server. */
  firstG1Games?: number | null
  secondG1Games?: number | null
  pilotShare: number
  mirrorShare: number
}

export type Matchup = {
  key: string
  opponent: string
  opponentName: string | null
  opponentFace?: number | null
  games: number
  wins: number
  losses: number
  draws: number
  wrRaw: number | null
  /** What the strengths, who went first and the ratings predict for the pair. */
  wrExpected: number
  /** The observed rate shrunk toward `wrExpected`; `wrLo`/`wrHi` is its interval. */
  wrAdjusted: number
  wrLo: number
  wrHi: number
  firstWr: number | null
  secondWr: number | null
}

export type Week = { key: string; week: number; firstDay: string; games: number; share: number; strength: number; se: number; wrExpected: number; jump: -1 | 0 | 1 }

export type CardStat = {
  /** The deck's key, `*` on the whole-window row. */
  key: string
  card: number
  /** The deck's name, on the rows of a card's page only. */
  name?: string | null
  lists: number
  inclusion: number
  copies: number | null
  sideRate: number
  playRate: number | null
  /** Logit effect on winning of having it in the list; `null` under 10% or over 90% of the lists, or under 200 games. */
  effect: number | null
  effectSe: number | null
  activations: number
  responded: number
  extra: boolean
}

/** `winRate`: the deck's in the games the card showed up; `winRateWithout`: in the rest (absent from an older server). */
export type AgainstCard = { id: number; name: string | null; games: number; rate: number; winRate: number | null; winRateWithout?: number | null }

export type Meta = { season: Season; window: Window; band: string; bands: { band: string; games: number }[]; fit: Fit; decks: DeckStat[]; weeks: Week[] }
export type DeckAnswer = { deck: DeckStat; matchups: Matchup[]; cards: CardStat[]; weeks: Week[]; byBand: (DeckStat & { band: string })[]; against: AgainstCard[]; sampleDeck: SampleDeck | null }
export type CardAnswer = { card: { id: number; name: string | null; extra: boolean }; all: CardStat; byDeck: CardStat[] }

export type Tally = { games: number; wins: number; losses: number; draws: number }
export type Tally3 = Omit<Tally, 'games'>
type PlayerEstimate = Tally & { name: string | null; wr: number | null; wrLo: number | null; wrHi: number | null }
/**
 * One slice of the duelist's games against an average pilot in the same games (`xWr`). The verdict and `pveLo`/`pveHi`
 * are the raw interval; `pveShrunk` only ranks highlights. Rates are null when `n` is 0.
 */
export type PlayerSlice = {
  n: number; wins: number; xWins: number | null; xWr: number | null; pve: number | null; winsAbove: number | null
  pveShrunk: number | null; pveLo: number | null; pveHi: number | null; deff: number
  verdict: 'above' | 'below' | 'unclear' | null
}
export type PlayerDeck = PlayerEstimate & {
  key: string; face?: number | null; mirrors: number; ladder: DeckStat | null; selfShare: number | null; performance: PlayerSlice
  splits: { g1First: PlayerSlice; g1Second: PlayerSlice; g1: PlayerSlice; post: PlayerSlice }
}
export type PlayerMatchup = PlayerEstimate & { key: string; opponent: string; opponentName: string | null; face?: number | null; opponentFace?: number | null; ladder: Matchup | null; performance: PlayerSlice }
/** `opponent: 'other'`: every opponent with no strength of its own on the ladder, `rogue` of them. */
export type PlayerOpponent = { deck: string | null; opponent: string; name: string | null; face: number | null; games: number; mirrors: number; rogue: number | null; share: number | null; performance: PlayerSlice }
export const OTHER_OPPONENT = 'other'
/** One per duel, newest first: [day ISO, duel result, deck key | null, the opponent's, games won, lost, drawn]. */
export type TimelineRow = [day: string | null, result: 'W' | 'L' | 'D' | null, deck: string | null, opponent: string | null, wins: number, losses: number, draws: number]
export type PlayerPeriod = 'season' | 'last7'
export type PlayerWeek = PlayerSlice & { week: number; firstDay: string }
export type PlayerAnswer = {
  season: Season | null
  period?: PlayerPeriod
  since?: string | null
  record: Tally & { matches?: number; matchWins?: number; matchLosses?: number; matchDraws?: number }
  performance?: PlayerSlice & { coverage: number }
  benchmark?: { builtAt: string | null; pilotStrength: number | null; ratingMean: number | null; selfShareWarn: number }
  opponentRating?: number | null
  splits?: { g1First: PlayerSlice; g1Second: PlayerSlice }
  decks: PlayerDeck[]
  matchups: PlayerMatchup[]
  opponents?: PlayerOpponent[]
  running?: number[]
  highlights?: { bestDeck: string | null; worstDeck: string | null; bestOpponent?: string | null; toughestOpponent?: string | null }
  progress?: { deck: string | null; weeks: PlayerWeek[] }
  timeline: TimelineRow[]
}

export type MatchupCall = 'favorable' | 'neutral' | 'unfavorable'
/** The API sends no verdict: a matchup is called only when its interval excludes the expected rate. */
export const matchupCall = ({ wrLo, wrHi, wrExpected }: Pick<Matchup, 'wrLo' | 'wrHi' | 'wrExpected'>): MatchupCall =>
  wrExpected < wrLo ? 'favorable' : wrExpected > wrHi ? 'unfavorable' : 'neutral'

/** A matchup list hides anything smaller by default: under it, the interval says more than the rate. */
export const MIN_MATCHUP_GAMES = 100

/** The decks proper: `A*` rows repeat the games of the keys they sum, and `''` is nobody's deck. */
export const plainDecks = <D extends { key: string }>(decks: readonly D[]): D[] => decks.filter((d) => d.key && !d.key.endsWith('*'))

/** The card that leads a key: `''` for the unknown, `A` for `A`, `A>B` and `A*`. */
export const leadOf = (key: string) => key.split(/[>*]/)[0]!

export type Family = { family: DeckStat; members: DeckStat[] }

/** One family per `A*` row, most played first, with the plain keys A leads (most played first); a family may have no members. */
export const families = (decks: readonly DeckStat[]): Family[] => {
  const byShare = [...decks].sort((a, b) => b.share - a.share)
  return byShare.filter((d) => d.key.endsWith('*')).map((family) => ({ family, members: plainDecks(byShare).filter((d) => leadOf(d.key) === leadOf(family.key)) }))
}

export type ShareWeek = Pick<Week, 'key' | 'week' | 'firstDay' | 'games' | 'share'>

/** The weeks of each family: its members' rows summed per week, under the `A*` key; a week no member played has no row. */
export const familyWeeks = (weeks: readonly Week[], list: readonly Family[]): ShareWeek[] =>
  list.flatMap(({ family, members }) => {
    const keys = new Set(members.map((m) => m.key))
    const sums = new Map<number, ShareWeek>()
    for (const w of weeks) {
      if (!keys.has(w.key)) continue
      const sum = sums.get(w.week) ?? { key: family.key, week: w.week, firstDay: w.firstDay, games: 0, share: 0 }
      sum.games += w.games
      sum.share += w.share
      sums.set(w.week, sum)
    }
    return [...sums.values()].sort((a, b) => a.week - b.week)
  })

export type BestAgainst = { key: string; wr: number; games: number; opponents: { key: string; wr: number }[] }

/** The deck with the best share-weighted adjusted rate against the `top` most played, with its rate against each; one missing any of them doesn't count. */
export const bestAgainst = (decks: readonly DeckStat[], matchups: readonly Pick<Matchup, 'key' | 'opponent' | 'wrAdjusted' | 'games'>[], top = 5): BestAgainst | null => {
  const played = [...decks].sort((a, b) => b.share - a.share).slice(0, top)
  const cell = new Map(matchups.map((m) => [`${m.key}|${m.opponent}`, m]))
  let best: BestAgainst | null = null
  for (const { key } of decks) {
    let sum = 0
    let weight = 0
    let games = 0
    const opponents: BestAgainst['opponents'] = []
    let complete = true
    for (const opponent of played) {
      if (opponent.key === key) continue
      const m = cell.get(`${key}|${opponent.key}`)
      if (!m) {
        complete = false
        break
      }
      sum += m.wrAdjusted * opponent.share
      weight += opponent.share
      games += m.games
      opponents.push({ key: opponent.key, wr: m.wrAdjusted })
    }
    if (complete && weight && (!best || sum / weight > best.wr)) best = { key, wr: sum / weight, games, opponents }
  }
  return best
}

/** Under the tier floors: the page lists it apart, as untiered. Without the build's rules nothing is set apart. */
export const underFloors = (d: Pick<DeckStat, 'share' | 'players'>, tiers: TierRules | null | undefined) => !!tiers && (d.share < tiers.minShare || d.players < tiers.minPlayers)

/** The card that stands for a deck: the server's `face`, else nothing (the initial stands in). */
export const faceCard = (d: { face?: number | null }) => (d.face ? { id: d.face, name: null } : undefined)

const sigma = (x: number) => 1 / (1 + Math.exp(-x))
const logit = (p: number) => Math.log(p / (1 - p))

/** A logit value (`firstEffect`, a card's `effect`) as points of win rate around 50%: σ(x) − 0.5. */
export const effectPoints = (x: number) => (sigma(x) - 0.5) * 100

/** A week's 95% band: its `se` is on the logit scale. */
export const weekBand = ({ wrExpected, se }: Pick<Week, 'wrExpected' | 'se'>) => ({ lo: sigma(logit(wrExpected) - 1.96 * se), hi: sigma(logit(wrExpected) + 1.96 * se) })

/** In this share of the lists or more, a card is the deck's core; under it, a flex slot. */
export const CORE_RATE = 0.8
export const coreFlex = <C extends Pick<CardStat, 'inclusion'>>(cards: readonly C[]) => ({ core: cards.filter((c) => c.inclusion >= CORE_RATE), flex: cards.filter((c) => c.inclusion < CORE_RATE) })

const lastWeek = (weeks: readonly Pick<Week, 'week'>[]) => Math.max(0, ...weeks.map((w) => w.week))

/** The biggest share moves of the last week against the one before; a deck in only one of them doesn't count. */
export const shareMoves = (weeks: readonly Pick<Week, 'key' | 'week' | 'share'>[], top = 5) => {
  const last = lastWeek(weeks)
  const before = new Map(weeks.filter((w) => w.week === last - 1).map((w) => [w.key, w.share]))
  const moves = weeks.flatMap((w) => {
    const from = w.week === last ? before.get(w.key) : undefined
    return from === undefined ? [] : [{ key: w.key, delta: w.share - from }]
  })
  return {
    risers: moves.filter((m) => m.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, top),
    fallers: moves.filter((m) => m.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, top),
  }
}

export const weekJumps = (weeks: readonly Week[]) => {
  const last = lastWeek(weeks)
  return weeks.filter((w) => w.week === last && w.jump !== 0)
}

/** The swept days the window really holds: `last7` on day 2 of a season is 2. */
export const windowDays = ({ window, season, weeks }: Pick<Meta, 'window' | 'season' | 'weeks'>) => {
  if (!season.sweptThrough) return 0
  const first = weeks.reduce((min, w) => (w.firstDay < min ? w.firstDay : min), season.startsAt.slice(0, 10))
  const days = Math.round((Date.parse(season.sweptThrough) - Date.parse(first)) / 86_400_000) + 1
  return window === 'last7' ? Math.min(7, days) : days
}

/** Above or below the deck only when the two intervals don't touch. */
export const meVerdict = ({ wrLo, wrHi, ladder }: Pick<PlayerDeck, 'wrLo' | 'wrHi' | 'ladder'>) =>
  wrLo == null || wrHi == null || !ladder ? null : wrLo > ladder.wrHi ? ('above' as const) : wrHi < ladder.wrLo ? ('below' as const) : ('same' as const)

const read = async <T>(path: string, call: string, init: RequestInit & { next?: { revalidate: number } } = { next: { revalidate: 300 } }): Promise<Result<T>> => {
  try {
    const res = await fetch(`${API_URL}${path}`, init)
    return res.ok ? { ok: true, data: (await res.json()) as T } : { ok: false, status: res.status }
  } catch (error) {
    log('error', 'API_ERROR', { call, path, err: error })
    return { ok: false, status: 0 }
  }
}

/** Newest first; empty when the server can't answer. */
export const getSeasons = async (): Promise<Season[]> => {
  const result = await read<{ seasons: Season[] }>('/statistics/seasons', 'GET /statistics/seasons')
  return result.ok ? result.data.seasons : []
}

/** The season the API reads for a scope: `season` by code or id, else the ladder's newest swept. */
export const seasonOf = (seasons: readonly Season[], { ladder, season }: StatisticsScope) =>
  seasons.find((s) => (season ? s.code === season || String(s.id) === season : s.ladder === ladder && s.sweptThrough))

export const getMeta = (scope: Scope) => read<Meta>(`/statistics/meta?${scopeQuery(scope)}`, 'GET /statistics/meta')

export const getDeck = (key: string, scope: Scope) => read<DeckAnswer>(`/statistics/decks/${encodeURIComponent(key)}?${scopeQuery(scope)}`, 'GET /statistics/decks/:key')

export const getCard = (id: number, scope: StatisticsScope) => read<CardAnswer>(`/statistics/cards/${id}?${scopeQuery(scope)}`, 'GET /statistics/cards/:id')

export type TopDeck = Pick<DeckStat, 'key' | 'name' | 'share'> & { topCards: { id: number; name: string | null }[] }

/** The most played decks of a ladder's newest swept season with three of their cards: the sample deck's, else the most included. */
export const getTopDecks = async (ladder: RankedLadderId, top = 10): Promise<TopDeck[] | null> => {
  const scope: Scope = { ladder, window: 'season', band: 'all' }
  const meta = await getMeta(scope)
  if (!meta.ok) return null
  const decks = plainDecks(meta.data.decks).sort((a, b) => b.share - a.share).slice(0, top)
  const answers = await Promise.all(decks.map((d) => getDeck(d.key, scope)))
  return decks.map(({ key, name, share }, i) => {
    const answer = answers[i]
    const cards = answer?.ok ? (answer.data.sampleDeck?.main ?? answer.data.cards.map((c) => ({ id: c.card, name: null }))) : []
    return { key, name, share, topCards: cards.slice(0, 3).map(({ id, name: card }) => ({ id, name: card })) }
  })
}

/** Owner only (403 otherwise), live from the games: on the server, pass the incoming `cookie`. */
export const getPlayerStatistics = (id: string, { ladder, season, period }: Pick<Scope, 'ladder' | 'season'> & { period?: PlayerPeriod }, cookie: string | null) =>
  read<PlayerAnswer>(`/statistics/players/${encodeURIComponent(id)}?${scopeQuery({ ladder, season })}${period === 'last7' ? '&period=last7' : ''}`, 'GET /statistics/players/:id', { cache: 'no-store', headers: cookie ? { cookie } : undefined })

/** GET /statistics/omega: logins and ranked activity of the whole game. */
export type OmegaCard = { current: number; previous: number | null }
type TierCell = { games: number; players: number }
export type OmegaRange = 7 | 14 | 30
type OmegaLadder = {
  population: { tier: Tier; players: number }[]
  daily: { day: string; tiers: Partial<Record<Tier, TierCell>> }[]
  totals: Record<OmegaRange, Partial<Record<Tier, TierCell>>>
}
export type OmegaActivity = {
  updatedAt: string
  today: string
  cards: Record<'logins' | 'weekLogins' | 'duels' | 'weekDuels', OmegaCard>
  daily: { day: string; logins: number | null; duels: number; players: number }[]
  totals: Record<OmegaRange, TierCell>
  /** Duels started in each UTC hour, average per day. Absent from an older server. */
  hours?: number[]
  ladders: Record<RankedLadderId, OmegaLadder>
}

/** null when the server can't answer: the page goes on without the section. */
export const getOmegaActivity = async (): Promise<OmegaActivity | null> => {
  const result = await read<OmegaActivity>('/statistics/omega', 'GET /statistics/omega', { next: { revalidate: 600 } })
  return result.ok ? result.data : null
}

/**
 * A sample deck: not a played deck, the most included cards of the archetype at their usual copies,
 * inside the current banlist. Rebuilt after every sweep; `deckId` is its public deck.
 */
export type SampleDeck = {
  archetype: number[]
  name: string | null
  /** Decklists it was built from. */
  lists: number
  deckId: string | null
  coverCardId: number | null
  createdAt: string
  updatedAt: string
  main: SampleCard[]
  extra: SampleCard[]
  side: SampleCard[]
}
export type SampleCard = { id: number; name: string | null; count: number }

type FaceSource = { deck: Pick<DeckStat, 'key'>; cards: Pick<CardStat, 'card'>[]; sampleDeck: Pick<SampleDeck, 'coverCardId'> | null }

/** The card that stands for each deck, by key: no two decks on a board look the same. */
export const deckFaces = (answers: readonly FaceSource[]) => {
  const taken = new Set<number>()
  return new Map(
    answers.flatMap(({ deck, cards, sampleDeck }) => {
      const face = [sampleDeck?.coverCardId, ...cards.map((c) => c.card)].find((id): id is number => !!id && !taken.has(id))
      if (!face) return []
      taken.add(face)
      return [[deck.key, face] as const]
    }),
  )
}
