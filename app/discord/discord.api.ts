import { API_ENDPOINTS } from '@const'
import { isRecord } from '@lib/api-result'
import type { PlayerData } from '../../types/player.types'
import type { PlayerDataResponse } from './discord.types'

// Discord identity verification (getUser) lives server-side now, in
// /api/auth/discord/login — the raw Discord access token never reaches the
// browser, so there is nothing left for the client to call Discord with.

function isPlayerData(data: unknown): data is PlayerData {
  if (!isRecord(data)) return false

  const avatar = data.avatar

  return (
    typeof data.id === 'string' &&
    typeof data.username === 'string' &&
    typeof data.displayname === 'string' &&
    (typeof avatar === 'string' || avatar === null) &&
    typeof data.tcgwins === 'number' &&
    typeof data.tcgloses === 'number' &&
    typeof data.tcgdraws === 'number' &&
    typeof data.ocgwins === 'number' &&
    typeof data.ocgloses === 'number' &&
    typeof data.ocgdraws === 'number' &&
    typeof data.tcgrating === 'number' &&
    typeof data.ocgrating === 'number' &&
    typeof data.lastlogin === 'string' &&
    typeof data.accountrank === 'number'
  )
}

function isProfileEnvelope(
  data: unknown,
): data is { success: true; data: PlayerData | null } {
  return (
    isRecord(data) &&
    data.success === true &&
    'data' in data &&
    (data.data === null || isPlayerData(data.data))
  )
}

export async function getPlayer(discordId: string): Promise<PlayerDataResponse> {
  const baseUrl = API_ENDPOINTS.MAIN

  if (!baseUrl) {
    return {
      ok: false,
      message: 'API URL is not configured',
    }
  }

  try {
    const url = `${baseUrl}/profile?id=${encodeURIComponent(discordId)}`
    const response = await fetch(url)

    if (!response.ok) {
      return {
        ok: false,
        message: 'Failed to fetch player data',
        status: response.status,
      }
    }

    const data: unknown = await response.json()

    if (isProfileEnvelope(data)) {
      return {
        ok: true,
        data: data.data ?? undefined,
        status: response.status,
      }
    }

    if (isRecord(data) && data.success === false) {
      const message =
        typeof data.message === 'string' ? data.message : 'Player profile not found'

      return {
        ok: false,
        message,
        status: response.status,
      }
    }

    return {
      ok: false,
      message: 'Invalid response format from server',
      status: response.status,
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to fetch player data',
    }
  }
}
