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
}
