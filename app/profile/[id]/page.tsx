import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import ProfilePage from '@app/profile'
import { getProfile, MATCH_PAGE_SIZE } from '@utils/profile'
import { pageMetadata } from '@utils/metadata'
import { parseBio } from "@utils/remark";

type ProfileRouteProps = { params: Promise<{ id: string }>; searchParams: Promise<{ as?: string }> }

/** Forwards the visitor's session so the API answers for them, not for an anonymous server. */
const loadProfile = async (id: string, asVisitor = false) => getProfile(id, (await headers()).get('cookie'), MATCH_PAGE_SIZE, asVisitor)

export async function generateMetadata({ params }: ProfileRouteProps) {
  const { id } = await params
  const profile = await loadProfile(id)

  if (!profile) return pageMetadata({ title: 'Profile not found', path: `/profile/${id}`, noIndex: true })

  const name = profile.displayName ?? profile.handle ?? 'Unknown duelist'
  return pageMetadata({
    title: profile.handle && profile.displayName ? `${profile.displayName} (${profile.handle})` : name,
    path: `/profile/${id}`,
    description: profile.isPrivate ? undefined : profile.bio?.split('\n')[0] || undefined,
    // A private profile is private to *this* visitor, so never let crawlers index the gated version.
    noIndex: profile.isPrivate,
  })
}

const ProfileRoute = async ({ params, searchParams }: ProfileRouteProps) => {
  const { id } = await params
  // "View as visitor": the API applies it only for the owner, for anyone else it changes nothing.
  const asVisitor = (await searchParams).as === 'visitor'
  const profile = await loadProfile(id, asVisitor)
  if (!profile) notFound()

  // Copy instead of mutate: `generateMetadata` shares this cached object and needs the raw markdown.
  if (profile.isPrivate || !profile.bio) return <ProfilePage profile={profile} asVisitor={asVisitor} />
  return <ProfilePage profile={{ ...profile, bio: await parseBio(profile.bio) }} asVisitor={asVisitor} />
}

export default ProfileRoute
