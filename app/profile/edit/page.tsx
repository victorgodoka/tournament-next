import { redirect } from 'next/navigation'
import { noIndexMetadata } from '@lib/page-metadata'
import { getSessionToken, decodeSessionUserId } from '@lib/session.server'
import { getPlayerCustomization } from '../profile.api'
import { extractCardsFromResponse, searchCards } from '@lib/cards.api'
import ProfileEditClient from './profile-edit.client'
import type { CardOption, ProfileEditValues } from './profile-edit.types'
import './profile-edit.styles.css'

export const metadata = noIndexMetadata(
  'Edit Profile',
  '/profile/edit',
  'Edit your YGO Omega player profile settings.',
)

/** Resolve a favorite-card id into a {id, name} option so the picker shows the
 * saved card by name instead of a bare number. Failure degrades to no name. */
async function resolveFavorite(favorite: number | string | null | undefined): Promise<CardOption | null> {
  if (favorite === null || favorite === undefined || favorite === '') return null
  const id = String(favorite)

  try {
    const response = await searchCards({ id, region: 'ALL', method: 'POST' })
    const card = extractCardsFromResponse(response)[0]
    return { id, name: card?.name_en || card?.name_pt || `Card ${id}` }
  } catch {
    return { id, name: `Card ${id}` }
  }
}

const ProfileEditPage = async () => {
  const token = await getSessionToken()
  const userId = decodeSessionUserId(token)
  if (!userId) redirect('/?notice=signin')

  const result = await getPlayerCustomization(userId)
  const data = result.ok ? result.data : null

  const favorite = await resolveFavorite(data?.duelist_favorite)

  const initialValues: ProfileEditValues = {
    bio: data?.duelist_bio ?? '',
    favorite,
    socialX: data?.socialX ?? '',
    socialInstagram: data?.socialInstagram ?? '',
    socialYoutube: data?.socialYoutube ?? '',
    socialTwitch: data?.socialTwitch ?? '',
    hideMatchHistory: data?.hide_history === 1,
    coverFile: null,
    coverUrl: data?.duelist_banner_url ?? '',
  }

  return <ProfileEditClient userId={userId} initialValues={initialValues} />
}

export default ProfileEditPage
