export interface LeaderboardsResponse {
  success: boolean
  message: string
  data: LeaderboardData
}

export interface LeaderboardData {
  TCG: TCG[]
  Genesys: Genesys[]
}

export interface PlayerStats {
  id: string
  username: string
  avatar?: string
  displayname: string
  wins: number
  loses: number
  draws: number
  rating: number
  winstreak: number
  losestreak: number
  games: number
  ot: string
}

export interface TCG extends PlayerStats {}
export interface Genesys extends PlayerStats {}
