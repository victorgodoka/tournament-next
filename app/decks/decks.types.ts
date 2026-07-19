import { Card } from "@lib/cards.types"

export interface ProfileStatsData {
  opponentDecks: OpponentDeck[]
  totalGaming: string
  mostUsedArchetypes: MostUsedArchetype[]
  matchHistory: MatchHistory[]
  pagination: ProfilePagination
}

export interface PlayerDecksResponse {
  tcg: ProfileStatsData
  genesys: ProfileStatsData
}

export interface OpponentDeck {
  deck?: string
  wins: number
  loss: number
  total: number
  ids?: number[]
}

export interface MostUsedArchetype {
  deck: string
  wins: number
  loss: number
  total: number
  ids?: number[]
}

export interface MatchHistory {
  duelist: {
    id: string
    deck: Array<{
      archetype: string
      ids: number[]
      qtd: number
    }>
    discord: {
      username: string
      avatar: string
      displayname: string
    }
  }
  opponent: {
    id: string
    deck: Array<{
      archetype: string
      ids: number[]
      qtd: number
    }>
    discord: {
      username: string
      avatar: string
      displayname: string
    }
  }
  winner: string
  isWinner: boolean
  isDraw: boolean
  start: string
  end: string
}

export interface ProfilePagination {
  currentPage: number
  pageSize: number
  totalMatches: number
  totalPages: number
}

export interface SavedDecksProps {
  sortBy?: 'likes' | 'comments' | 'created_at'
  order?: 'asc' | 'desc'
  page?: number
  limit?: number
  name?: string;
  tag?: string;
  archetype?: string;
}

export interface SavedDecksResponse {
  success: boolean
  data: SavedDeck[]
  pagination: SavedDecksPagination
  filters: Filters
}

export interface SavedDecksPagination {
  page: number
  limit: number
  total: number
  totalPages: number
}
export interface Filters {
  availableArchetypes: string[]
}

export interface SavedDeck {
  id: number
  user_id: string
  code: string
  name: string
  cover_id: number | null
  archetypes: string[]
  tags: string[]
  private: boolean
  created_at: string
  updated_at: string
  likes?: number
  comment_count?: number
  username: string
  displayname: string
  avatar: string
}

export interface SavedDeckDetails {
  id: number
  user_id: string
  code: string
  name: string
  cover_id: number | null
  archetypes: string[]
  tags: string[]
  private: boolean
  created_at: string
  updated_at: string
  fullDeck: FullDeck
  user: DiscordUser
}

export interface SavedDeckComments {
  success: boolean
  count: number
  data: Comment[]
}

export interface Comment {
  id: number
  deck_id: number
  user_id: string
  comment: string
  parent_id: number | null
  created_at: string
  updated_at: string
  user: DiscordUser
}

interface DiscordUser {
  discord_id: string
  username: string
  avatar: string | null
  displayname: string | null
}

export interface ConvertDeckResponse {
  success: boolean
  data: ConvertedDeck
}

export interface ConvertedDeck {
  code: string
  primaryArchetype: string
  primaryArchetypeWeighted: string
  primaryArchetypes: string[]
  category: string
  archetypes: Archetype[]
  totalCards: number
  mainDeckSize: number
  sideDeckSize: number
  uniqueCards: number[]
  fullDeck: FullDeck
  uniqueCardsData: Card[]
}

export interface Archetype {
  name: string
  count: number
  percentage: number
}

export interface FullDeck {
  main: number[]
  side: number[]
}

export interface Set {
  code: string
  name: string
}

export interface BanlistData {
  tcg?: Banlist
  ocg?: Banlist
  wcs: Banlist
}

export interface Banlist {
  banlist: string
  value: number
  status: string
}

export interface DecksPageProps {
  initialData: SavedDecksResponse | null
  initialError: string | null
}