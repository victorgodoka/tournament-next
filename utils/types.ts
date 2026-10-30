/**
 * Shapes returned by omega-server-v3 (see its PROFILE_API.md). Dates are ISO 8601 strings and
 * numbers are raw: format both at render time. An absent field was withheld; `null` means unset.
 */
import type { WikiAsset, WikiDoc } from '@utils/wiki-doc'

export type CardArt = {
  /** Card passcode. The client builds the image URL. */
  id: number
  /** `null` when the passcode is unknown. Treat it as "no label", not an error. */
  name: string | null
}

type Deck = {
  name: string | null
  art: CardArt | null
}

type Accent = 'green' | 'magenta'

export type Region = 'north_america' | 'latam' | 'brazil' | 'eu_west' | 'eu_east' | 'middle_east' | 'africa' | 'asia' | 'oceania'

export type SocialNetwork = 'instagram' | 'x' | 'youtube' | 'twitch' | 'website'

export type ProfileSocial = {
  network: SocialNetwork
  /** Display text. `null` falls back to the URL host. */
  handle: string | null
  href: string
}

export type Visibility = 'everyone' | 'friends_rivals' | 'friends' | 'nobody'

export type Tier = 'Iron' | 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Master' | 'Omega'

type LadderRecord = { wins: number; loses: number; draws: number }

/** Open: live rating and record. Closed: frozen at the rollover. */
/** `day` is `YYYY-MM-DD` in the sync job's timezone; `seasonDay` 1 = the day the season opened. */
export type EloPoint = { day: string; seasonDay: number; elo: number }

export type LadderSeason = LadderRecord & {
  /** Editable by an admin: link with it, never persist it as a key. */
  code: string
  label: string
  ordinal: number
  /** Exactly one `true` per ladder. */
  open: boolean
  startsAt: string
  /** `null` on the open season. */
  endsAt: string | null
  elo: number
  tier: Tier
  /** `null` on the open season until the duelist's first game is synced. */
  rank: number | null
  /**
   * Open season only: one point per day from the daily ladder sync, oldest first. Today's live value
   * is `elo`, not the last point. `[]` before anything is recorded.
   */
  eloHistory?: EloPoint[]
}

export type LadderStats = {
  /** Live rating. Can be negative. */
  elo: number
  tier: Tier
  allTime: LadderRecord
  /** Newest first. The open season is always there, even at 0-0-0. */
  seasons: LadderSeason[]
  /** Recent results, oldest first. One character per duel: `W`, `L` or `D`. */
  recent: string | null
  topDeck: { name: string; art: CardArt } | null
  topDeckMeta: { duels: number; wins: number } | null
}

/** Which season is running now on one ladder. Nothing about the duelist. */
export type CurrentSeason = Pick<LadderSeason, 'code' | 'label' | 'ordinal' | 'startsAt'> & {
  format: 'TCG' | 'Genesys'
  accent: Accent
}

/** A format ladder. `played: false` means the duelist never entered it. */
export type Ladder = { format: 'TCG' | 'Genesys'; accent: Accent } & (
  | ({ played: true } & LadderStats)
  | { played: false }
)

type MatchSide = {
  id: string
  name: string | null
  avatar: string | null
  cosmetics: Cosmetics
  deck: string | null
  /** 0–3 distinct cards from the deck. */
  cards: CardArt[]
}

/** Always from the profile owner's point of view. */
export type Match = {
  /** Always `ranked:<n>`: history is ranked only. */
  id: string
  /** `null` is a draw or unfinished duel, not a loss. */
  win: boolean | null
  score: { self: number; opponent: number }
  format: string
  event: string
  when: string | null
  self: MatchSide
  opponent: MatchSide
}

export type MatchPage = {
  matches: Match[]
  /** `null` is the only stop condition. */
  nextCursor: string | null
}

/** Always sent, so a private page still shows whose profile it is. */
export type ProfileIdentity = {
  /** Discord snowflake. Keep it a string, it exceeds 2^53. */
  id: string
  displayName: string | null
  handle: string | null
  avatar: string | null
  lastLogin: string | null
  /** Game `accountrank >= 1`. Staff are VIP too; the raw rank is never exposed. */
  isVip: boolean
  /** @deprecated Alias of `isVip`. */
  isDonator: boolean
  /** The site's one full admin. Only a badge: routes are gated by the site role. */
  isAdmin: boolean
  /** When the battlepass ends. Can be in the past: check `hasPass`, not `!== null`. */
  passDueDate: string | null
  /** `passDueDate` is set and still in the future. */
  hasPass: boolean
  /** The viewer's standing with this duelist. `none` when signed out or viewing your own. */
  relation: RelationStatus
  /** Visible profile: `profile` + `avatar` slots. Private: `avatar` only. */
  cosmetics: Cosmetics
}

/** Owner-editable settings, as `PATCH /profiles/me` returns them. */
export type ProfileSettings = {
  /** Small markdown subset: paragraphs, bullets, bold, italic, strike, code, links. */
  bio: string
  region: Region | null
  coverImageId: string | null
  visibility: Visibility
  favoriteCard: CardArt | null
  /** `null` when neither part is set. */
  favoriteDeck: Deck | null
  socials: ProfileSocial[]
}

/** `isPrivate` is computed for this viewer: everything but the identity is withheld. */
export type Profile = ProfileIdentity & (
  | { isPrivate: true }
  | ({ isPrivate: false } & Omit<ProfileSettings, 'visibility'> & MatchPage & {
    /** Only present when the viewer owns the profile, which also means they can edit it. */
    visibility?: Visibility
    duelsPlayed: number
    /** The open season of each ladder, same order as `ladders`. Names the season even for an unplayed ladder. */
    currentSeasons: CurrentSeason[]
    /** Always `TCG` then `Genesys`. */
    ladders: Ladder[]
    /** Swiss-tournament record: totals, titles and the 3 latest entries. */
    tournaments: PlayerTournaments
  })
)

/** `PATCH /profiles/me` body. Omitted keys stay unchanged; `null` clears a nullable field. */
export type ProfileSettingsPatch = Partial<{
  bio: string
  region: Region | null
  visibility: Visibility
  coverImageId: string | null
  favoriteCardId: number | null
  favoriteDeckName: string | null
  favoriteDeckCardId: number | null
  socials: ProfileSocial[]
}>

/* Messenger shapes (see omega-server-v3 MESSENGER.md). */

/** What the duelist picks. Only ever appears in their own `me.presence`. */
export type ChosenPresence = 'ready' | 'busy' | 'invisible'

/** What everyone sees for everyone else. Computed by the server, never on the client. */
export type Presence = 'ready' | 'online' | 'away' | 'busy' | 'offline'

/** How the viewer filed another duelist. Private: the other side never learns it. */
export type Relation = 'friend' | 'rival'

/** The viewer's standing with one duelist. An incoming request carries no kind. */
export type RelationStatus =
  | { state: 'none' }
  | { state: 'incoming' }
  | { state: 'outgoing' | 'linked'; kind: Relation }

export type Identity = {
  /** Discord snowflake. Keep it a string. */
  id: string
  displayName: string | null
  /** No `@`. */
  username: string | null
  avatar: string | null
  /** Frame and bubble. Replaced live by the `cosmetics` SSE event. */
  cosmetics: Cosmetics
}

export type Song = {
  videoId: string
  /** `null` if YouTube didn't answer when it was saved. */
  title: string | null
}

export type RosterEntry = Identity & {
  kind: Relation
  nickname: string | null
  note: string | null
  presence: Presence
  /** Always `null` while offline. */
  status: string | null
  song: Song | null
}

export type Panel = {
  me: Identity & { presence: ChosenPresence; status: string | null; song: Song | null }
  /** Accepted links only, sorted by presence then name. */
  roster: RosterEntry[]
  incomingRequests: number
  unreadChats: number
}

export type Requests = {
  incoming: (Identity & { requestedAt: string })[]
  outgoing: (Identity & { kind: Relation; requestedAt: string })[]
}

export type BlockedDuelist = Identity & { blockedAt: string }

export type ChatMessage = {
  /** Bigint as string. Compare with `BigInt`. */
  id: string
  mine: boolean
  body: string
  createdAt: string
}

export type ChatSummary = Identity & {
  nickname: string | null
  lastMessage: ChatMessage
  unread: number
}

export type ChatPage = {
  /** Newest first. */
  messages: ChatMessage[]
  nextCursor: string | null
}

export type PresenceEvent = Pick<RosterEntry, 'id' | 'presence' | 'status' | 'song'>

/** `GET /welcome` (WELCOME_API.md §2). Ranked duels only; windows end on the full hour. */
export interface WelcomeData {
  players: WelcomePlayers
  games: WelcomeGames
  /** `null` for a few minutes after a server restart: hide the block. */
  meta: (Record<WelcomeLadder, WelcomeMeta> & { updatedAt: string }) | null
  tournaments: {
    /** Newest first. Usually 0 or 1. */
    live: WelcomeTournament[]
    /** Last 6 finished, every format, newest first. */
    recent: WelcomeTournament[]
    /** Next 6, staff schedule and the game's recurring scheduler mixed, soonest first. */
    upcoming: WelcomeUpcoming[]
  }
}

export type WelcomeLadder = 'tcg' | 'genesys'

/** One ladder's last 24 h (WELCOME_API.md §2.2). Shares are fractions of decklists, 2 per duel. */
export type WelcomeMeta = {
  duels: number
  /** Top 3 archetypes by decks. */
  decks: { archetype: number[]; name: string | null; metaShare: number; duels: number; winRate: number | null }[]
  /** Top 5 cards by `inDecks`. */
  cards: { id: number; name: string; inDecks: number; inMain: number; inSide: number; used: number }[]
}

/**
 * A tournament on the calendar (TOURNAMENT_API.md §3.6), from one of three sources:
 * `omega` ran in the game (id = tournament id), `panel` is on the staff schedule (id = schedule id,
 * pre-registration on the site), `scheduler` is the game's recurring tournament (id `null`, join
 * in the game client). Ids are not unique across sources: key on `source` + `id` (+ `startsAt`).
 */
export type CalendarEntry = {
  id: number | null
  source: 'omega' | 'panel' | 'scheduler'
  status: 'scheduled' | 'live' | 'finished'
  startsAt: string
  endedAt: string | null
  banlist: string | null
  format: string | null
  mode: TournamentSettings['mode']
  /** `null` for `omega`: the game doesn't record it. */
  structure: 'swiss' | 'single_elimination' | null
  requiresPass: boolean | null
  rewardTp: boolean | null
  /** `omega`: entrants. `panel`: pre-registrations. `scheduler`: `null`. */
  players: number | null
  /** `site` = pre-register on its page, `ingame` = only in the game client, `null` = already started. */
  registration: 'site' | 'ingame' | null
}

/** The home page's upcoming list: calendar entries that haven't started (WELCOME_API.md §2.3). */
export type WelcomeUpcoming = CalendarEntry

/** A duelist pre-registered for a scheduled tournament, oldest first. */
type ScheduledPlayer = {
  id: string
  name: string | null
  avatar: string | null
  registeredAt: string
  cosmetics: Cosmetics
}

/** `GET /tournaments/scheduled/{id}` (TOURNAMENT_API.md §3.7); the POST/DELETE return the same body. */
export type ScheduledTournament = {
  tournament: CalendarEntry
  /** Set once staff link it to the game tournament: its page is `/tournament/{omegaTournamentId}`. */
  omegaTournamentId: number | null
  registration: {
    /** `false` from `startsAt` on, or once linked. */
    open: boolean
    /** `null` without a session. */
    registered: boolean | null
    players: ScheduledPlayer[]
  }
}

/** A tournament on the home page (WELCOME_API.md §2.3). */
export type WelcomeTournament = {
  id: number
  name: string
  status: TournamentStatus
  banlist: string
  format: string
  /** Ladder season code (`tcg-1`) or the lowercased format (`edison`). Picks the banner. */
  season: string
  players: number
  rounds: number
  startedAt: string
  endedAt: string | null
  winner: (TournamentPlayer & { points: number; archetype: string | null }) | null
}

interface WelcomePlayers {
  last24h: number
  previous24h: number
  updatedAt: string
}

interface WelcomeGames {
  last24h: Record<WelcomeLadder, number>
  previous24h: Record<WelcomeLadder, number>
  updatedAt: string
}

/**
 * Tournaments (see omega-server-v3 TOURNAMENT_API.md). Every endpoint is public and read-only.
 * Player ids are Discord snowflakes, so they stay strings. Rates are fractions, never percentages.
 */

export type TournamentStatus = 'live' | 'finished'

export type TournamentPlayer = {
  id: string
  /** `null` when the game has no Discord data for the duelist. */
  name: string | null
  handle: string | null
  avatar: string | null
  cosmetics: Cosmetics
}

type TournamentSettings = {
  mode: 'single' | 'match' | 'tag'
  masterRule: number
  /** Raw value that doesn't match the old site's labels. Show `format` instead. */
  region: number
  timer: number
  draw: boolean
  startingHand: number
  noShuffle: boolean
  isPublic: boolean
  startingLp: number
  duelRule: number
  allowBeta: boolean
  unknownHighBits: string
}

export type TournamentSummary = {
  id: number
  status: TournamentStatus
  /** Free text from the game, and the value the `banlist` filter takes. */
  banlist: string
  /** `TCG`, `Genesys`, `Edison` or `Rush Duel`. Never show the raw `OCG` banlist text. */
  format: string
  /** Swiss rounds. There is no top cut. */
  rounds: number
  players: number
  startedAt: string
  /** `null` while live. */
  endedAt: string | null
  /** Legal-card release window for retro formats. Only Edison sets it. */
  cardPool: { releasedFrom: string | null; releasedUntil: string | null }
  settings: TournamentSettings
  /** What each bit means is unknown: raw data or nothing. */
  extraRules: { raw: string; bits: number[] }
  /** Rank 1 of the computed standings. `null` while live. */
  winner: (TournamentPlayer & { points: number }) | null
}

export type DeckCard = {
  /** Passcode: card art, and `GET /cards/{id}`. */
  id: number
  name: string | null
  count: number
  /** Fusion/Synchro/Xyz/Link, even when the copy sits in `side`. */
  extra: boolean
}

export type TournamentDeck = {
  /** Engine cards excluded, a mix reads `"A / B"`. Show this when present; `null` for no named archetype. */
  name: string | null
  /** A stat grouping, not a deck name: the most-copied archetype, engine included. Can differ from `name`. */
  archetype: string | null
  /** Top 3 by copies in main + extra. `art` is the passcode of that archetype's most-copied card **in this deck**. */
  archetypes: { name: string; cards: number; art: number }[]
  main: DeckCard[]
  extra: DeckCard[]
  side: DeckCard[]
  /** The game's deck code, for a copy button. */
  code: string
}

export type Standing = {
  /** Computed by the API — the game stores neither placements nor tiebreakers. */
  rank: number
  player: TournamentPlayer
  points: number
  wins: number
  loses: number
  draws: number
  /** Rounds with no opponent. Already counted inside `wins`. */
  byes: number
  dropped: boolean
  tiebreakers: {
    opponentsMatchWin: number
    opponentsOpponentsMatchWin: number
    /** 8 digits, `AABBBCCC`: points, OMW%, OOMW%. The order sorts on this string, descending. */
    kts: string
  }
  /** `null` only when the stored deck code can't be decoded. */
  deck: TournamentDeck | null
}

type MatchOutcome = 'player1' | 'player2' | 'draw' | 'unplayed'

export type TournamentMatch = {
  /** Unique only within the round: key on round number + room. */
  room: number
  player1: string
  player2: string
  /** The official result. It doesn't always agree with `score`, and it still wins. */
  outcome: MatchOutcome
  score: { player1: number; player2: number }
  games: { winner: 'player1' | 'player2' | 'draw' }[]
  /**
   * Who went first **in game 1**. `null` on unplayed matches and on the rows where the game
   * didn't record it. Games 2 and 3 are not knowable: only bit 0 of the stored field reproduces.
   */
  first: 'player1' | 'player2' | null
  endedAt: string | null
}

export type TournamentRound = {
  number: number
  startedAt: string
  /** Player id that got the bye. */
  bye: string | null
  matches: TournamentMatch[]
}

export type ArchetypeStat = {
  archetype: string
  players: number
  /** Fraction of entrants. */
  share: number
  /** Passcode of the archetype's most-copied card, for a slice image or a thumbnail. */
  artCardId: number | null
  wins: number
  loses: number
  draws: number
  /** `null` when the archetype played no match. */
  winRate: number | null
  /** Only on `GET /tournaments/stats`. */
  tournamentWins?: number
  games?: GameRecord
}

/** Games won, lost and drawn in a row's matches, from the row's deck. Absent from an API older than the field. */
export type GameRecord = { wins: number; loses: number; draws: number }

/** `games` from `archetype`'s side, like the match record. */
export type MatchupStat = { archetype: string; opponent: string; wins: number; loses: number; draws: number; games?: GameRecord }

/** Per-zone counts, so "staple of main" and "staple of side" can be separate lists. */
type CardZoneStat = { decks: number; copies: number }

export type CardStat = {
  id: number
  name: string | null
  /** Decks holding at least one copy anywhere, counted once even when the card is in main **and** side. */
  decks: number
  copies: number
  main: CardZoneStat
  extra: CardZoneStat
  side: CardZoneStat
  /** **Games** won and lost by decks carrying the card. Decklist presence, not play. */
  wins: number
  loses: number
  draws: number
}

type MatchTotals = {
  total: number
  played: number
  unplayed: number
  draws: number
  games: number
  threeGameMatches: number
  /** Game 1 only: `games` = decided game 1s with a known `first`, `wins` = how many the player on the play took. */
  onThePlay: { games: number; wins: number }
}

/** Split by card type, not zone: a sided extra-deck monster is in `extra`. Each list is its own top N by `decks`. */
type CardStats = { main: CardStat[]; extra: CardStat[] }

export type TournamentStats = {
  matches: MatchTotals
  archetypes: ArchetypeStat[]
  matchups: MatchupStat[]
  cards: CardStats
}

export type TournamentDetail = {
  tournament: TournamentSummary
  standings: Standing[]
  rounds: TournamentRound[]
  stats: TournamentStats
}

export type TournamentPage = { tournaments: TournamentSummary[]; nextCursor: string | null }

type BanlistTotals = { banlist: string; format: string; tournaments: number; entries: number }

type TournamentLeader = TournamentPlayer & {
  tournaments: number
  tournamentWins: number
  wins: number
  loses: number
  draws: number
  points: number
}

export type TournamentsStats = {
  tournaments: number
  entries: number
  uniquePlayers: number
  averagePlayers: number
  /** Also the list of valid `banlist` filter values. */
  banlists: BanlistTotals[]
  players: TournamentLeader[]
  matches: MatchTotals
  archetypes: ArchetypeStat[]
  matchups: MatchupStat[]
  cards: CardStats
}

/** `GET /tournaments/players/{id}/stats`: their finished tournaments, their side only. Matchups keep mirrors. */
export type PlayerTournamentStats = TournamentStats & {
  format: string | null
  /** Every format they played, most first: the picker. */
  formats: { format: string; tournaments: number }[]
  tournaments: number
  titles: number
  /** Their played matches, byes out; unclassified decks in (unlike `archetypes`). `games`: the games of those matches. */
  record: { wins: number; loses: number; draws: number; games?: GameRecord }
  /** Their game 1s by who went first. */
  turnOrder: Record<'first' | 'second', { games: number; wins: number }>
}

/** One tournament a duelist entered: the tournament, and their row of its standings. */
export type PlayerEntry = { tournament: TournamentSummary; standing: Standing }

/** `GET /profiles/{id}.tournaments`. A duelist who never entered gets `played: 0` and `recent: []`. */
export type PlayerTournaments = {
  played: number
  /** Tournaments won outright. Ties on points are resolved by the Konami tiebreaker. */
  titles: number
  /** Tournament **matches**, summed across every tournament. Byes count as wins. */
  wins: number
  loses: number
  draws: number
  /** Match points summed across every tournament (`3 x wins + draws`). */
  points: number
  /** The 3 latest tournaments, newest first. */
  recent: PlayerEntry[]
}

/** `GET /tournaments/players/{id}` — the full history, cursor-paginated. */
export type PlayerTournamentPage = { entries: PlayerEntry[]; nextCursor: string | null }

/**
 * Wiki articles (see omega-server-v3 WIKI_API.md). Articles are identified by `slug` in URLs;
 * `id` is only the index cursor. `publishedAt: null` means draft, and a draft is invisible
 * without `wiki.write`.
 */

/** A duelist as the wiki names them: author, last editor, or a row in the editors panel. */
export type WikiUser = {
  /** Discord snowflake. Keep it a string. */
  id: string
  username: string | null
  avatarUrl: string | null
  cosmetics: Cosmetics
}

type WikiRole = 'USER' | 'EDITOR' | 'ANALYST' | 'ADMIN'

/** Index row. No `body`: an article can be 100 KB of Markdown. */
export type ArticleSummary = {
  id: number
  slug: string
  title: string
  /** The doc's one-line summary; `''` on a legacy Markdown article. */
  summary: string
  /** The image `doc.cover` points at. Only the index fills it; `null` without a cover. */
  cover?: WikiAsset | null
  author: WikiUser
  /** `null` is a draft. */
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  /** Only the index fills these three; an open article reads them from `ArticleSocial`. */
  views?: number
  likes?: number
  commentCount?: number
}

export type Article = ArticleSummary & {
  /** Raw Markdown. Render it through a Markdown pipeline, never as HTML. On a block article: the server's plain-text projection of `doc`. */
  body: string
  /** Block document (WIKI_API.md §5). `null`/absent on a legacy Markdown article. */
  doc?: WikiDoc | null
  /** `null` until someone other than the creation edits it; then whoever saved last. */
  updatedBy: WikiUser | null
  /** `doc.hub` / `doc.related` resolved, published only. Render links from here, never from the doc. */
  links?: ArticleLinks
  /** The page head, derived by the server. Never recompute it from the doc. */
  seo?: ArticleSeo
}

export type ArticleLink = { slug: string; title: string; summary: string }

export type ArticleLinks = { hub: ArticleLink | null; related: ArticleLink[]; children: ArticleLink[] }

export type ArticleSeo = {
  title: string
  description: string
  canonical: string
  robots: string
  keywords: string[]
  /** Already transformed to 1200×630 when it is a large enough upload: never transform it again. */
  image: { src: string; width: number; height: number; alt: string } | null
  jsonLd: Record<string, unknown>
}

/** WIKI_API §4.15. `body` is plain text: render it as text, never as Markdown or HTML. */
export type WikiComment = {
  /** Bigint as a string. */
  id: string
  /** `null` on a thread; the thread's id on a reply. */
  parentId: string | null
  /** `null` once deleted. */
  author: WikiUser | null
  /** `''` once deleted. */
  body: string
  createdAt: string
  /** A deleted thread still comes back while it has live replies: show "Comment deleted". */
  deleted: boolean
}

/** Newest thread first; replies oldest first, one level deep. */
export type WikiThread = WikiComment & { replies: WikiComment[] }

export type ArticleSocial = {
  views: number
  likes: number
  /** Whether the signed-in viewer likes it; `false` signed out. */
  liked: boolean
  comments: WikiThread[]
}

export type ArticleIndex = {
  articles: ArticleSummary[]
  /** `null` on the last page. Pass it back as `cursor`; never build an offset. */
  nextCursor: string | null
}

/** One save. The newest revision mirrors the current article. */
export type Revision = {
  /** Bigint as a string. */
  id: string
  title: string
  editor: WikiUser
  createdAt: string
}

/** `doc: null` on a revision saved before the article had blocks: render `body` as Markdown then. */
export type RevisionDetail = Revision & { body: string; doc: WikiDoc | null }

/** `GET /wiki/editors`. Rows with `role: 'ADMIN'` are not editable. */
export type WikiEditor = WikiUser & { role: WikiRole }

/** `POST /wiki`. An article is born a draft: `published` defaults to `false`. */
export type ArticleDraft = {
  /** Trimmed, 1–120 characters. */
  title: string
  /** Markdown, 1–100 000 characters. No raw HTML, and every link must be `http(s)`. */
  body: string
  /** Defaults to a slug derived from the title. */
  slug?: string
  published?: boolean
}

/** `POST /wiki` for a block article. The title and the searchable `body` are derived from `doc` on the server. */
export type DocArticleDraft = {
  doc: WikiDoc
  slug?: string
  published?: boolean
}

/** `PATCH /wiki/{slug}` for a block article. `doc` is replaced whole, never merged. */
export type DocArticlePatch = Partial<{
  doc: WikiDoc
  slug: string
  /** Only with `slug` (alone it is a 400). Default `true`: the old address answers 301. */
  redirect: boolean
  published: boolean
}>

/** `PATCH /wiki/{slug}`. At least one key; an absent key leaves the column alone. */
export type ArticlePatch = Partial<{
  title: string
  body: string
  /** A new `title` never moves the URL: send `slug` to do that. */
  slug: string
  published: boolean
}>

/* ------------------------------------------------------------------ *
 * Ranked ladders — omega-server-v3 RANKED_API.md
 * ------------------------------------------------------------------ */

/** The only two queues. `ocg` is a MySQL column prefix, never a ladder: sending it is a 400. */
export type RankedLadderId = 'tcg' | 'genesys'
export type RankedFormat = 'TCG' | 'Genesys'

/** `ordinal` is the season number within its own format; `id` is a sequence shared by both. */
export type RankedSeason = {
  id: number
  code: string
  label: string
  ordinal: number
}

/**
 * One row of the snapshot. `elo` is the ladder number — there is no per-queue "points" column —
 * and `tier` is its band, computed by the server. Don't recompute either.
 */
export type LeaderboardEntry = {
  /** 1-based, dense, and also the cursor. */
  rank: number
  /** Discord snowflake. Keep it a string. */
  id: string
  /** `null` for a duelist who never authenticated through Discord. Not rare. */
  name: string | null
  handle: string | null
  avatar: string | null
  cosmetics: Cosmetics
  elo: number
  tier: Tier
  wins: number
  loses: number
  draws: number
}

export type LeaderboardPage = {
  ladder: RankedLadderId
  format: RankedFormat
  /** The open season of that ladder. `null` means `entries` is empty. */
  season: RankedSeason | null
  /**
   * When the game server was read — the honest "as of" for the whole list. Never `null` from the
   * API; `null` here only means the page is our own fallback because the API was unreachable.
   * A page whose `syncedAt` differs from the first page's means the walk crossed a refresh.
   */
  syncedAt: string | null
  /** `wins`/`loses`/`draws` are the season's record, and only duelists who played it are listed. */
  entries: LeaderboardEntry[]
  /** `null` on the last page. Pass it back as `cursor`; never build an offset. */
  nextCursor: string | null
}

/** A closed season. The open one is never in this list — it is the leaderboard. */
export type PastSeason = {
  code: string
  label: string
  ordinal: number
  startsAt: string
  endsAt: string
  /** Duelists in the final results: everyone with at least one game in the season. */
  standings: number
}

export type PastSeasons = { ladder: RankedLadderId; format: RankedFormat; seasons: PastSeason[] }

/** An equipped cosmetic as the profile, messenger and auth APIs embed it. */
export type Cosmetic = { itemId: string; name: string; assetUrl: string | null; ext: string | null; data: Record<string, unknown> }

/** Slot (the item type, e.g. `WEBDECO`) → item. `{}` when nothing is equipped. */
export type Cosmetics = Record<string, Cosmetic>
