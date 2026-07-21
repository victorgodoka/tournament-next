import type { Metadata } from 'next'
import { discordAvatar } from '@assets/discord.avatar'
import { getPlayer } from '../../discord/discord.api'
import { getPlayerCustomization } from '../profile.api'
import { profileJsonLd } from '@lib/json-ld'
import { pageMetadata } from '@lib/page-metadata'
import ProfilePageClient from './profile-page.client'
import { ProfilePageProps } from '../profile.types'
import '../profile.styles.css'

export async function generateMetadata({
  params,
}: ProfilePageProps): Promise<Metadata> {
  const { id } = await params
  const path = `/profile/${id}`
  const result = await getPlayer(id)

  if (!result.ok || !result.data) {
    return pageMetadata({
      title: 'Profile Not Found',
      path,
      description: 'This YGO Omega player profile could not be found.',
      noIndex: true,
    })
  }

  const player = result.data
  const wins = player.tcgwins
  const losses = player.tcgloses
  const rating = Math.round(player.tcgrating)
  const description = `${player.displayname} on YGO Omega. TCG rating ${rating}, ${wins}W-${losses}L. View match history, decks, and stats.`
  const avatarUrl = player.avatar
    ? discordAvatar(player.id, player.avatar)
    : undefined

  return pageMetadata({
    title: `${player.displayname} — Profile`,
    path,
    description,
    images: avatarUrl ? [{ url: avatarUrl, alt: `${player.displayname} avatar` }] : undefined,
  })
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { id } = await params
  // getPlayer here is deduped with generateMetadata's call by fetch
  // memoization; customization is fetched in parallel rather than left for
  // the client to re-request after hydration.
  const [playerResult, customizationResult] = await Promise.all([
    getPlayer(id),
    getPlayerCustomization(id),
  ])

  const player = playerResult.ok ? playerResult.data ?? null : null
  const avatarUrl =
    player?.avatar ? discordAvatar(player.id, player.avatar) : undefined

  return (
    <>
      {player ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              profileJsonLd({
                id: player.id,
                displayname: player.displayname,
                avatarUrl,
                tcgRating: player.tcgrating,
                tcgWins: player.tcgwins,
                tcgLosses: player.tcgloses,
              }),
            ),
          }}
        />
      ) : null}
      <ProfilePageClient
        key={id}
        profileId={id}
        initialProfile={player}
        initialCustomization={customizationResult.ok ? customizationResult.data : null}
        initialError={playerResult.ok ? null : playerResult.message ?? 'Failed to load profile.'}
      />
    </>
  )
}
