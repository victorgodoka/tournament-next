import { API_ENDPOINTS } from '@const'
import { apiFailure, apiSuccess, isRecord, type ApiResult } from '@lib/api-result'
import type { ProfileCustomizationData } from './profile.types'

const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined

/** Field-by-field normalization — this data feeds dangerouslySetInnerHTML
 * (bio) and URL builders (socials), so no blanket casts. */
function parseCustomizationData(body: unknown): ProfileCustomizationData | null {
  if (!isRecord(body) || body.success !== true || !isRecord(body.data)) return null

  const data = body.data
  const id =
    typeof data.id === 'string' ? data.id : typeof data.id === 'number' ? String(data.id) : null
  if (id === null) return null

  return {
    id,
    duelist_bio: optionalString(data.duelist_bio),
    duelist_favorite:
      typeof data.duelist_favorite === 'number' || typeof data.duelist_favorite === 'string'
        ? data.duelist_favorite
        : null,
    duelist_banner_url: optionalString(data.duelist_banner_url),
    hide_history: typeof data.hide_history === 'number' ? data.hide_history : undefined,
    socialTwitch: optionalString(data.socialTwitch),
    socialYoutube: optionalString(data.socialYoutube),
    socialX: optionalString(data.socialX),
    socialInstagram: optionalString(data.socialInstagram),
  }
}

export async function getPlayerCustomization(
  discordId: string,
): Promise<ApiResult<ProfileCustomizationData>> {
  try {
    const url = `${API_ENDPOINTS.MAIN}/duelist?id=${encodeURIComponent(discordId)}`
    const response = await fetch(url)

    if (!response.ok) {
      return apiFailure('Failed to fetch player customization data')
    }

    const body: unknown = await response.json()
    const data = parseCustomizationData(body)

    if (!data) {
      return apiFailure('Invalid customization response')
    }

    return apiSuccess(data)
  } catch (error) {
    return apiFailure(
      error instanceof Error
        ? error.message
        : 'Failed to fetch player customization data',
    )
  }
}
