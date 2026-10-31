import { Button } from "@ui/button";
import { AdBanner } from "@omega/ads/ad-banner";
import { Footer } from "@ui/footer";
import { Header } from "@ui/header";
import { Icon } from "@ui/icon";
import { Chip } from "@ui/chip";
import { Panel } from "@ui/panel";
import { ProfileHeader } from "@ui/profile-header";
import type { Stat } from "@ui/stat-grid";
import { CardArt } from "@omega/card-art";
import { LocalTime } from "@omega/profile/local-time";
import { SongPlayer } from "@omega/profile/song-player";
import { formatNumber, REGION_LABEL, SOCIAL, VISIBILITY_LABEL } from "@omega/profile/labels";
import type { CardArt as CardArtType, Ladder, Profile, ProfileSocial } from "@utils/types";
import { Ladders } from "./sections/Ladders";
import { MatchHistory } from "./sections/MatchHistory";
import { RelationActions } from "./sections/RelationActions";
import { TournamentRecord } from "./sections/TournamentRecord";
import { Rail } from "./sections/rail";

type PublicProfile = Extract<Profile, { isPrivate: false }>

const DAY_MONTH: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
const LAST_SEEN: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
const LABEL = "font-mono text-[10px] leading-3 tracking-[0.16em] uppercase text-ink-muted"

const eloStat = (ladder: Ladder): Stat => {
  if (!ladder.played) return { label: `${ladder.format} Elo`, value: '—', hint: 'Not played yet' }
  const season = ladder.seasons.find((s) => s.open)
  const rank = season?.rank != null ? ` · #${formatNumber(season.rank)} in ${season.label}` : ''
  return { label: `${ladder.format} Elo`, value: formatNumber(ladder.elo), tone: 'cyan', hint: `${ladder.tier}${rank}` }
}

const headerStats = (profile: PublicProfile): Stat[] => [
  { label: 'Duels played', value: formatNumber(profile.duelsPlayed), hint: 'TCG + Genesys, lifetime' },
  ...profile.ladders.map(eloStat),
  {
    label: 'Tournament titles',
    value: formatNumber(profile.tournaments?.titles ?? 0),
    tone: 'gold',
    hint: `${formatNumber(profile.tournaments?.played ?? 0)} entered`,
  },
]

/** The API sends no label for a bare website, so fall back to the URL host (PROFILE_API.md §4.6). */
const hostOf = (href: string) => {
  try {
    return new URL(href).host.replace(/^www\./, '')
  } catch {
    return href
  }
}

const socialText = ({ network, handle, href }: ProfileSocial) =>
  network === 'website' ? handle ?? hostOf(href) : `${SOCIAL[network].label} · ${handle ?? hostOf(href)}`

const Fact = ({ label, top, children }: { label: string; top?: boolean; children: React.ReactNode }) => (
  <div className={`grid grid-cols-[96px_minmax(0,1fr)] gap-3 bg-surface-100 px-3.5 py-3 ${top ? 'items-start' : 'items-center'}`}>
    <span className={`${LABEL} ${top ? 'pt-1' : ''}`}>{label}</span>
    {children}
  </div>
)

const CardFact = ({ art, title, sub, mono }: { art: CardArtType | null; title: string; sub?: string | null; mono?: boolean }) => (
  <div className="flex min-w-0 items-center gap-3">
    {art ? <CardArt art={art} sizes="40px" className="h-14.5 w-10 shrink-0 rounded-xs border border-line-mid" /> : null}
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="font-bold text-ink">{title}</span>
      {sub ? <span className={mono ? 'font-mono text-xs leading-4 text-ink-muted' : 'text-[13px] leading-4.5 text-ink-muted'}>{sub}</span> : null}
    </div>
  </div>
)

const About = ({ bio, region, favoriteCard, favoriteDeck, socials }: PublicProfile) => {
  const deck = favoriteDeck && (favoriteDeck.name || favoriteDeck.art) ? favoriteDeck : null
  const facts = region || favoriteCard || deck || socials.length
  if (!bio && !facts) return null

  return (
    <>
      <Rail num="03" label="About" />
      <Panel label="About" className="flex flex-col gap-5">
        {bio ? (
          <div
            className="flex flex-col gap-2.5 text-[15px] leading-6 text-ink-dim [&_*]:m-0 [&_a]:text-cyan [&_a]:underline [&_a]:underline-offset-3 [&_strong]:text-ink"
            dangerouslySetInnerHTML={{ __html: bio }}
          />
        ) : null}
        {facts ? (
          <div className="flex flex-col gap-px border border-line bg-line">
            {region ? (
              <Fact label="Region">
                <span className="font-semibold text-ink">{REGION_LABEL[region]}</span>
              </Fact>
            ) : null}
            {favoriteCard ? (
              <Fact label="Favorite card">
                <CardFact art={favoriteCard} title={favoriteCard.name ?? 'Unknown card'} sub={String(favoriteCard.id)} mono />
              </Fact>
            ) : null}
            {deck ? (
              <Fact label="Favorite deck">
                <CardFact art={deck.art} title={deck.name ?? deck.art?.name ?? 'Unnamed deck'} sub={deck.name ? deck.art?.name : null} />
              </Fact>
            ) : null}
            {socials.length ? (
              <Fact label="Socials" top>
                <div className="flex flex-col gap-1.5">
                  {socials.map((social) => (
                    <a key={social.network} href={social.href} target="_blank" rel="noopener noreferrer" className="text-cyan underline underline-offset-3 hover:decoration-2">
                      {socialText(social)}
                    </a>
                  ))}
                </div>
              </Fact>
            ) : null}
          </div>
        ) : null}
      </Panel>
    </>
  )
}

const LockIcon = () => (
  <svg viewBox="0 0 24 24" width="40" height="40" aria-hidden className="fill-line-strong">
    <path fillRule="evenodd" d="M7 10V7a5 5 0 0 1 10 0v3h2v11H5V10zm2 0h6V7a3 3 0 0 0-6 0zm2 4v4h2v-4z" />
  </svg>
)

const ProfileBody = ({ profile }: { profile: Profile }) => {
  const name = profile.displayName ?? profile.handle ?? null
  const isOwner = !profile.isPrivate && profile.visibility !== undefined
  const region = !profile.isPrivate && profile.region ? REGION_LABEL[profile.region] : null

  const header = (
    <ProfileHeader
      name={name}
      handle={profile.handle}
      avatar={profile.avatar}
      cosmetics={profile.cosmetics}
      meta={[
        region,
        isOwner ? 'Your profile' : profile.lastLogin ? <>Last seen <LocalTime iso={profile.lastLogin} options={LAST_SEEN} /></> : null,
      ]}
      badges={
        profile.isVip || profile.hasPass || profile.isAdmin || isOwner ? (
          <>
            {profile.isAdmin ? <Chip tone="admin">Admin</Chip> : null}
            {profile.isVip ? <Chip tone="vip">VIP</Chip> : null}
            {profile.hasPass && profile.passDueDate ? <Chip tone="pass">Pass until <LocalTime iso={profile.passDueDate} options={DAY_MONTH} /></Chip> : null}
            {isOwner && profile.visibility ? <Chip tone="cyan">{VISIBILITY_LABEL[profile.visibility]}</Chip> : null}
          </>
        ) : null
      }
      actions={
        <>
          {/* Each deck's own visibility decides who sees it there; the owner sees all of them. */}
          {profile.isPrivate ? null : <Button variant="secondary" href={`/profile/${profile.id}/my-decks`}><Icon name="deck" />{isOwner ? 'My decks' : 'Decks'}</Button>}
          <RelationActions id={profile.id} isOwner={isOwner} relation={profile.relation} />
        </>
      }
      stats={profile.isPrivate ? undefined : headerStats(profile)}
    />
  )

  if (profile.isPrivate) {
    const first = profile.displayName?.split(' ')[0] ?? 'This duelist'
    return (
      <>
        {header}
        <Panel tone="sunken" label="Private profile" className="p-0 min-[720px]:p-0">
          <div className="flex flex-col items-center gap-4 bg-[radial-gradient(rgba(142,166,199,0.16)_1px,transparent_1.5px)] bg-size-[24px_24px] px-6 py-18 text-center">
            <LockIcon />
            <h2 className="font-display text-[32px] leading-[1.05] uppercase">This profile is private</h2>
            <p className="max-w-[52ch] text-base leading-6 text-ink-dim">
              {first}&apos;s ladders, duel history and tournaments are hidden from you. Their owner decides who can see them. A request opens the page only after it&apos;s accepted, and only if their setting includes you.
            </p>
          </div>
        </Panel>
      </>
    )
  }

  return (
    <>
      {header}
      <AdBanner id="ad-top" placement="content" />
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Rail num="01" label="Ranked ladders" stamp="Elo live · rank from last sync" />
          <Ladders name={name ?? 'Elo'} ladders={profile.ladders} currentSeasons={profile.currentSeasons ?? []} />
          <Rail num="02" label="Duel history" stamp={`Ranked only · ${formatNumber(profile.duelsPlayed)} duels`} className="mt-4" />
          <MatchHistory profileId={profile.id} matches={profile.matches} nextCursor={profile.nextCursor} />
          <AdBanner id="ad-bottom" placement="content" />
        </div>

        <aside className="flex min-w-0 flex-col gap-6">
          <About {...profile} />
          {/* Optional chaining: the field is new, so a server that predates it sends nothing. */}
          {profile.tournaments?.played ? <TournamentRecord profileId={profile.id} tournaments={profile.tournaments} /> : null}
        </aside>
      </div>
    </>
  )
}

const ProfilePage = ({ profile }: { profile: Profile }) => (
  <>
    <Header />
    <main data-clear-gutters className="flex min-h-dvh flex-col overflow-x-hidden pt-16">
      <div className="mx-auto flex w-full max-w-page flex-col gap-10 px-4 pt-10 pb-16 min-[1312px]:px-0">
        <ProfileBody profile={profile} />
      </div>
    </main>
    <Footer />
    {profile.cosmetics?.SONG ? <SongPlayer song={profile.cosmetics.SONG} /> : null}
  </>
)

export default ProfilePage
