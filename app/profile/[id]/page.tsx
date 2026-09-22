import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import ProfilePage from '@app/profile'
import { getProfile, MATCH_PAGE_SIZE } from '@utils/profile'
import { pageMetadata } from '@utils/metadata'
import { parseBio } from "@utils/remark";

type ProfileRouteProps = { params: Promise<{ id: string }> }

/** Forwards the visitor's session so the API answers for them, not for an anonymous server. */
const loadProfile = async (id: string) => getProfile(id, (await headers()).get('cookie'), MATCH_PAGE_SIZE)

export async function generateMetadata({ params }: ProfileRouteProps) {
  const { id } = await params
  const profile = await loadProfile(id)

  if (!profile) return pageMetadata({ title: 'Profile not found', path: `/profile/${id}`, noIndex: true })

  const name = profile.displayName ?? profile.handle ?? 'Unknown duelist'
  return pageMetadata({
    title: profile.handle && profile.displayName ? `${profile.displayName} (${profile.handle})` : name,
    path: `/profile/${id}`,
    description: profile.isPrivate ? undefined : profile.bio.split('\n')[0] || undefined,
    // A private profile is private to *this* visitor, so never let crawlers index the gated version.
    noIndex: profile.isPrivate,
  })
}

const ProfileRoute = async ({ params }: ProfileRouteProps) => {
  const { id } = await params
  const profile = await loadProfile(id)
  if (!profile) notFound()

  // Copy instead of mutate: `generateMetadata` shares this cached object and needs the raw markdown.
  if (profile.isPrivate) return <ProfilePage profile={profile} />
  return <ProfilePage profile={{ ...profile, bio: await parseBio(profile.bio) }} />
}

export default ProfileRoute
