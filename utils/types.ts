/**
 * Shapes returned by omega-server-v3 (see its PROFILE_API.md). Dates are ISO 8601 strings and
 * numbers are raw: format both at render time. An absent field was withheld; `null` means unset.
 */

export type CardArt = {
  /** Card passcode. The client builds the image URL. */
  id: number
  /** `null` when the passcode is unknown. Treat it as "no label", not an error. */
  name: string | null
}

export type Deck = {
  name: string | null
  art: CardArt | null
}

export type Accent = 'green' | 'magenta'

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

export type LadderStats = {
  season: string | null
  /** Live rating. Can be negative. */
  elo: number
  tier: Tier
  wins: number
  loses: number
  draws: number
  /** Recent results, oldest first. One character per duel: `W`, `L` or `D`. */
  recent: string | null
  topDeck: { name: string; art: CardArt } | null
  topDeckMeta: { duels: number; wins: number } | null
}

/** A format ladder. `played: false` means the duelist never entered it. */
export type Ladder = { format: 'TCG' | 'Genesys'; accent: Accent } & (
  | ({ played: true } & LadderStats)
  | { played: false }
)

export type MatchSide = {
  id: string
  name: string | null
  deck: string | null
  /** 0–3 distinct cards from the deck. */
  cards: CardArt[]
}

/** Always from the profile owner's point of view. */
export type Match = {
  /** `ranked:<n>` or `casual:<n>`. */
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
  /** The viewer's standing with this duelist. `none` when signed out or viewing your own. */
  relation: RelationStatus
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

export type SelfProfile = ProfileIdentity & ProfileSettings

/** `isPrivate` is computed for this viewer: everything but the identity is withheld. */
export type Profile = ProfileIdentity & (
  | { isPrivate: true }
  | ({ isPrivate: false } & Omit<ProfileSettings, 'visibility'> & MatchPage & {
    /** Only present when the viewer owns the profile, which also means they can edit it. */
    visibility?: Visibility
    duelsPlayed: number
    /** Always `TCG` then `Genesys`. */
    ladders: Ladder[]
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

export interface WelcomeData {
  players: WelcomePlayers
  games: WelcomeGames
}

export interface WelcomePlayers {
  last24h: number
  previous24h: number
  updatedAt: string
}

export interface WelcomeGames {
  last24h: WelcomeLast24h
  previous24h: WelcomePrevious24h
  updatedAt: string
}

export interface WelcomeLast24h {
  tcg: number
  genesys: number
  casual: number
}

export interface WelcomePrevious24h {
  tcg: number
  genesys: number
  casual: number
}
