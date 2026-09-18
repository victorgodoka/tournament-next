import { Footer } from "@ui/footer";
import { Header } from "@ui/header";
import { FriendsPanel } from "@omega/friends-panel";
import { PrivateNotice, ProfileCover, ProfileMasthead, ProfileMeta } from "@omega/profile";
import { formatNumber } from "@omega/profile/labels";
import { coverUrl } from "@utils/profile";
import type { Profile } from "@utils/types";
import { MatchHistory } from "./sections/MatchHistory";
import { RankedStanding } from "./sections/RankedStanding";

type ProfilePageProps = {
  profile: Profile
}

const ProfileBody = ({ profile }: { profile: Profile }) => {
  if (profile.isPrivate) {
    return (
      <>
        <ProfileMasthead {...profile} />
        <PrivateNotice />
      </>
    )
  }

  const cover = coverUrl(profile.coverImageId)
  const { favoriteCard, favoriteDeck } = profile

  return (
    <>
      {cover && <ProfileCover src={cover} handle={profile.handle ?? profile.displayName ?? ''} />}

      <ProfileMasthead {...profile} isOwner={profile.visibility !== undefined} hasCover={!!cover}>
        <ProfileMeta
          cells={[
            { label: 'Favorite card', value: favoriteCard?.name ?? 'None yet', art: favoriteCard ?? undefined, labelClassName: 'text-gold' },
            { label: 'Favorite deck', value: favoriteDeck?.name ?? 'None yet', art: favoriteDeck?.art ?? undefined, labelClassName: 'text-cyan' },
            { label: 'Duels played', value: formatNumber(profile.duelsPlayed) },
          ]}
        />
      </ProfileMasthead>

      <RankedStanding ladders={profile.ladders} />
      <MatchHistory profileId={profile.id} matches={profile.matches} nextCursor={profile.nextCursor} duelsPlayed={profile.duelsPlayed} />
    </>
  )
}

const ProfilePage = ({ profile }: ProfilePageProps) => (
  <>
    <Header />
    <main className="flex min-h-dvh flex-col overflow-x-hidden pt-16">
      <ProfileBody profile={profile} />
    </main>
    <Footer />
    <FriendsPanel />
  </>
)

export default ProfilePage
