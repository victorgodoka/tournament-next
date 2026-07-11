import { API_ENDPOINTS } from '@const'
import { apiFailure, apiSuccess, isRecord, type ApiResult } from '@lib/api-result'
import type {
  ProfileCustomizationData,
  UpdateProfileResponse,
} from './profile.types'

function parseCustomizationData(
  body: unknown,
): ProfileCustomizationData | null {
  if (!isRecord(body)) return null

  if (
    body.success === true &&
    'data' in body &&
    isRecord(body.data)
  ) {
    return body.data as unknown as ProfileCustomizationData
  }

  return null
}

export async function getPlayerCustomization(
  discordId: string,
): Promise<ApiResult<ProfileCustomizationData>> {
  try {
    const url = `${API_ENDPOINTS.DUELISTS_UNITE_V3}/duelist?id=${encodeURIComponent(discordId)}`
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

export async function updatePlayerCustomization(
  formData: FormData,
): Promise<UpdateProfileResponse> {
  const url = `${API_ENDPOINTS.DUELISTS_UNITE_V3}/duelist`
  const response = await fetch(url, { method: 'POST', body: formData })

  if (!response.ok) {
    throw new Error('Failed to update player customization')
  }

  const body: unknown = await response.json()
  const data = parseCustomizationData(body)

  if (!data) {
    throw new Error('Invalid response format from server')
  }

  return { data }
}
