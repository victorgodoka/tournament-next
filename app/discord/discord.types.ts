export interface DiscordUser {
  id: string
  username: string
  avatar: string | null
  discriminator: string
  public_flags?: number
  flags?: number
  banner?: string | null
  accent_color?: number | null
  global_name: string | null
  avatar_decoration_data?: unknown | null
  collectibles?: {
    nameplate?: {
      sku_id: string
      asset: string
      label: string
      palette: string
    }
  } | null
  display_name_styles?: unknown | null
  banner_color?: string | null
  clan?: unknown | null
  primary_guild?: unknown | null
  mfa_enabled?: boolean
  locale?: string
  premium_type?: number
}

export type DiscordMe = Pick<DiscordUser, 'id' | 'username' | 'avatar' | 'global_name'>

export interface DiscordUserResponse {
  ok: boolean
  data?: DiscordMe
  message?: string
}

export interface PlayerProfileEnvelope {
  success: true
  data: import('../../types/player.types').PlayerData | null
}

export interface PlayerDataResponse {
  ok: boolean
  data?: import('../../types/player.types').PlayerData
  message?: string
  status?: number
}
