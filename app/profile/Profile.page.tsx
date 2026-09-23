import { Footer } from "@ui/footer";
import { Header } from "@ui/header";
import { FriendsPanel } from "@omega/friends-panel";
import { CardArt } from "@omega/card-art";
import { PrivateNotice } from "@omega/profile/private-notice";
import { ProfileBio } from "@omega/profile/profile-bio";
import { ProfileMasthead } from "@omega/profile/profile-masthead";
import { MICRO_LABEL } from "@omega/profile/accent";
import { SectionHead } from "@ui/section-head";
import type { CardArt as CardArtType, Profile } from "@utils/types";
import { MatchHistory } from "./sections/MatchHistory";
import { RankedStanding } from "./sections/RankedStanding";
import { TournamentRecord } from "./sections/TournamentRecord";

type ProfilePageProps = {
  profile: Profile
}

type Favourite = { label: string; name: string | null; art: CardArtType | null }

const Favourites = ({ num, items }: { num: string; items: Favourite[] }) => (
  <section id="favourites" className="pt-section">
    <SectionHead num={num}>Favourites</SectionHead>
    <ul className="mt-3.5 grid max-w-130 grid-cols-2 gap-[clamp(12px,2vw,24px)]">
      {items.map(({ label, name, art }) => (
        <li key={label}>
          <p className={`${MICRO_LABEL} mb-2`}>{label}</p>
          {art ? <CardArt art={art} sizes="260px" className="aspect-square border border-line-strong" /> : null}
          {name ? <p className="mt-2.5 text-ink display-6">{name}</p> : null}
        </li>
      ))}
    </ul>
  </section>
)

const ProfileBody = ({ profile }: { profile: Profile }) => {
  if (profile.isPrivate) {
    return (
      <div className="mx-auto w-full max-w-page px-gutter">
        <ProfileMasthead {...profile} />
        <PrivateNotice />
      </div>
    )
  }

  const { favoriteCard, favoriteDeck } = profile
  const favourites = [
    favoriteCard && { label: 'Card', name: favoriteCard.name, art: favoriteCard },
    favoriteDeck && (favoriteDeck.name || favoriteDeck.art) && { label: 'Deck', name: favoriteDeck.name, art: favoriteDeck.art },
  ].filter((item): item is Favourite => !!item)

  // Optional sections drop out, so number the ones that render.
  let count = 0
  const num = () => String(++count).padStart(2, '0')

  return (
    <div className="mx-auto w-full max-w-page px-gutter">
      <ProfileMasthead {...profile} />

      {/* On desktop the bio and favourites share a row; either one alone takes the full width. */}
      <div className={profile.bio && favourites.length ? "lg:grid lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-x-[clamp(28px,4vw,56px)]" : undefined}>
        {profile.bio ? (
          <section id="about" className="pt-section">
            <SectionHead num={num()}>About</SectionHead>
            <ProfileBio markdown={profile.bio} className="mt-3.5 text-ink-dim body-sm" />
          </section>
        ) : null}

        {favourites.length ? <Favourites num={num()} items={favourites} /> : null}
      </div>

      <RankedStanding num={num()} profileId={profile.id} ladders={profile.ladders} currentSeasons={profile.currentSeasons} matches={profile.matches} />
      {/* Optional chaining: the field is new, so a server that predates it sends nothing. */}
      {profile.tournaments?.played ? (
        <TournamentRecord num={num()} profileId={profile.id} tournaments={profile.tournaments} />
      ) : null}
      <MatchHistory
        num={num()}
        profileId={profile.id}
        matches={profile.matches}
        nextCursor={profile.nextCursor}
        duelsPlayed={profile.duelsPlayed}
      />
    </div>
  )
}

const ProfilePage = ({ profile }: ProfilePageProps) => (
  <>
    <Header />
    <main className="flex min-h-dvh flex-col overflow-x-hidden pt-16 pb-[clamp(56px,7vw,96px)]">
      <ProfileBody profile={profile} />
    </main>
    <Footer />
    <FriendsPanel />
  </>
)

export default ProfilePage
