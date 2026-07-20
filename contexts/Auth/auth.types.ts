import type { PlayerData } from '../../types/player.types'

export type UserActions =
  | { type: 'SET_USER'; payload: User }
  | { type: 'LOGOUT' }

export interface User {
  id: string
  username: string
  displayname: string
  avatar: string
  profile?: PlayerData
}

export interface LoginResponse {
  success: boolean
  message?: string
}

export interface VerifyResponse {
  success: boolean
  user?: {
    id: string
    iat: number
    exp: number
  }
  message?: string
}

export type LogoutOptions = {
  from?: string
  animate?: boolean
}
