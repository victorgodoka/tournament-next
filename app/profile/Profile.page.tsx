import { AdBanner } from "@omega/ads/ad-banner";
import { Button } from "@ui/button";
import { Chip } from "@ui/chip";
import { Footer } from "@ui/footer";
import { Header } from "@ui/header";
import { Icon } from "@ui/icon";
import { ProfileHeader } from "@ui/profile-header";
import type { Stat } from "@ui/stat-grid";
import { LocalTime } from "@omega/profile/local-time";
import { SongPlayer } from "@omega/profile/song-player";
import { formatNumber, formatRate, formatRecord, REGION_LABEL, VISIBILITY_LABEL } from "@omega/profile/labels";
import type { Ladder, Profile } from "@utils/types";
import { About } from "./sections/About";
import { DeckCharts } from "./sections/DeckCharts";
import { FreeLadders, VipLadders } from "./sections/Ladders";
import { LastSeen } from "./sections/LastSeen";
import { HistoryHidden, MatchHistory, type SeasonOption } from "./sections/MatchHistory";
import { RelationActions } from "./sections/RelationActions";
import { RecentTournaments, TournamentRecord } from "./sections/TournamentRecord";
import { Rail } from "./sections/rail";

type PublicProfile = Extract<Profile, { isPrivate: false }>

const DAY_MONTH: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }

const openOf = (ladder: Ladder) => (ladder.played ? ladder.seasons.find((s) => s.open) : undefined)

const eloStat = (ladder: Ladder): Stat => {
  const label = `${ladder.format} Elo`
  if (!ladder.played) return { label, value: '—', hint: 'Not played yet' }
  if (ladder.eloHidden || ladder.elo == null) return { label, value: '—', hint: 'Hidden' }
  const rank = openOf(ladder)?.rank
  return {
    label,
    value: formatNumber(ladder.elo),
    tone: ladder.format === 'TCG' ? 'cyan' : undefined,
    hint: `${ladder.tier}${rank != null ? ` · #${formatNumber(rank)}` : ''}`,
  }
}

/** The win rate of the season with the most duels (VIP header). */
const seasonRateStat = (ladders: Ladder[]): Stat | null => {
  const seasons = ladders.flatMap((ladder) => {
    const open = openOf(ladder)
    return open ? [{ format: ladder.format, ...open, duels: open.wins + open.loses + open.draws }] : []
  })
  const best = seasons.sort((a, b) => b.duels - a.duels)[0]
  return best?.duels ? { label: 'Season win rate', value: formatRate(best.wins, best.duels), hint: `${formatRecord(best)} in ${best.format}` } : null
}

const headerStats = (profile: PublicProfile): { stats: Stat[]; mobile: Stat[] } => {
  const titles: Stat = { label: 'Tournament titles', value: formatNumber(profile.tournaments.titles), tone: 'gold', hint: `${formatNumber(profile.tournaments.played)} entered` }
  const rate = profile.view.vip ? seasonRateStat(profile.ladders) : null
  const elos = profile.ladders.map(eloStat)
  return {
    stats: [{ label: 'Duels played', value: formatNumber(profile.duelsPlayed), hint: 'TCG + Genesys, lifetime' }, ...elos, ...(rate ? [rate] : []), titles],
    mobile: [
      { label: 'Duels', value: formatNumber(profile.duelsPlayed) },
      ...elos.map((stat) => ({ label: stat.label, value: stat.value, tone: stat.tone })),
      { label: 'Titles', value: titles.value, tone: 'gold' },
    ],
  }
}

/** Seasons the duel history can be filtered by: the open one of each ladder, and the closed ones when allowed. */
const historySeasons = (profile: PublicProfile): SeasonOption[] => {
  if (!profile.view.pastSeasonMatches) return []
  return profile.ladders.flatMap((ladder) =>
    ladder.played
      ? ladder.seasons.map((s) => ({ code: s.code, label: s.label, open: s.open, ladder: ladder.format === 'TCG' ? ('tcg' as const) : ('genesys' as const) }))
      : [],
  )
}

const LockIcon = () => (
  <svg viewBox="0 0 24 24" width="40" height="40" aria-hidden className="fill-line-strong">
    <path fillRule="evenodd" d="M7 10V7a5 5 0 0 1 10 0v3h2v11H5V10zm2 0h6V7a3 3 0 0 0-6 0zm2 4v4h2v-4z" />
  </svg>
)

/** Shown to the owner on `?as=visitor`: what everyone else sees, and the way back. */
const VisitorBanner = ({ id }: { id: string }) => (
  <div className="flex flex-wrap items-center gap-4 border border-cyan bg-ground-cyan px-4 py-3">
    <Icon name="eye" className="text-cyan" />
    <span className="text-sm text-ink">You are viewing your profile as a visitor sees it.</span>
    <Button size="sm" variant="secondary" href={`/profile/${id}`} className="ml-auto">Back to your profile</Button>
  </div>
)

const ProfileBody = ({ profile, asVisitor }: { profile: Profile; asVisitor: boolean }) => {
  const name = profile.displayName ?? profile.handle ?? null
  const first = profile.displayName?.split(' ')[0] ?? 'This duelist'
  const isOwner = !profile.isPrivate && profile.visibility !== undefined
  const region = !profile.isPrivate && profile.region ? REGION_LABEL[profile.region] : null

  const header = (
    <ProfileHeader
      name={name}
      handle={profile.handle}
      avatar={profile.avatar}
      cosmetics={profile.cosmetics}
      cover={!profile.isPrivate ? profile.coverImage : null}
      meta={[
        isOwner ? 'Your profile' : null,
        profile.lastLogin ? <LastSeen iso={profile.lastLogin} /> : null,
      ]}
      badges={
        <>
          {profile.isAdmin ? <Chip tone="admin">Admin</Chip> : null}
          {profile.isVip ? <Chip tone="vip">VIP</Chip> : null}
          {region ? <Chip tone="cyan">{region}</Chip> : null}
          {profile.hasPass && profile.passDueDate ? (
            <Chip tone="pass">
              Pass<span className="max-md:hidden"> until <LocalTime iso={profile.passDueDate} options={DAY_MONTH} /></span>
            </Chip>
          ) : null}
          {isOwner && profile.visibility === 'nobody' && profile.isVip ? <Chip tone="neutral">{VISIBILITY_LABEL.nobody}</Chip> : null}
        </>
      }
      actions={
        <>
          {/* Statistics are owner-only, even on a public profile. */}
          {isOwner ? <Button variant="secondary" href={`/profile/${profile.id}/statistics`} className="max-md:hidden"><Icon name="chart" />Statistics</Button> : null}
          {/* Each deck's own visibility decides who sees it there; the owner sees all of them. */}
          {profile.isPrivate ? null : <Button variant="secondary" href={`/profile/${profile.id}/my-decks`} className="max-md:hidden"><Icon name="deck" />{isOwner ? 'My decks' : 'Decks'}</Button>}
          <RelationActions id={profile.id} isOwner={isOwner} relation={profile.relation} />
        </>
      }
      {...(profile.isPrivate ? {} : (({ stats, mobile }) => ({ stats, mobileStats: mobile }))(headerStats(profile)))}
    />
  )

  if (profile.isPrivate) {
    return (
      <>
        {asVisitor ? <VisitorBanner id={profile.id} /> : null}
        {header}
        <section aria-label="Private profile" className="cut notch [--cut:var(--cut-lg)] [--edge:var(--color-line)] [--fill:var(--color-space-000)]">
          <div className="flex flex-col items-center gap-4 bg-[radial-gradient(rgba(142,166,199,0.16)_1px,transparent_1.5px)] bg-size-[24px_24px] px-6 py-18 text-center">
            <LockIcon />
            <h2 className="display-2">This profile is private</h2>
            <p className="max-w-[52ch] text-base leading-6 text-ink-dim">
              {first}&apos;s ladders, duel history and tournaments are hidden. Only {first} can see them.
            </p>
          </div>
        </section>
      </>
    )
  }

  const { view } = profile
  let n = 0
  const next = () => String(++n).padStart(2, '0')

  const history = view.matches ? (
    <MatchHistory
      profileId={profile.id}
      first={first}
      vip={view.vip}
      matchWindow={view.matchWindow}
      delayed={view.delayed}
      seasons={historySeasons(profile)}
      asVisitor={asVisitor}
      matches={profile.matches}
      nextCursor={profile.nextCursor}
      events={profile.events}
      eloDays={profile.eloDays}
    />
  ) : (
    <HistoryHidden first={first} />
  )

  if (!view.vip) {
    const ranked = next()
    const duels = next()
    const about = next()
    const tours = next()
    return (
      <>
        {asVisitor ? <VisitorBanner id={profile.id} /> : null}
        {header}
        <Rail num={ranked} label="Ranked & tournaments" stamp="Rank from last sync" />
        <FreeLadders ladders={profile.ladders} currentSeasons={profile.currentSeasons} tournaments={profile.tournaments} />
        <AdBanner id="ad-mid" placement="content" className="md:hidden" />
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-5">
            <Rail num={duels} label="Duel history" stamp={view.matchWindow ? (view.matchWindow === 'season' ? 'This season' : `Last ${view.matchWindow.replace('d', '')} days`) : undefined} />
            {history}
          </div>
          {/* Stretched to the duel history's height: the sticky half page needs room to stick. */}
          <aside className="flex min-w-0 flex-col gap-6 lg:self-stretch">
            <AdBanner id="ad-aside" placement="aside" />
            <About num={about} vip={false} favoriteCard={profile.favoriteCard} favoriteDeck={profile.favoriteDeck} />
            <RecentTournaments tournaments={profile.tournaments} num={tours} />
            <div className="sticky top-20 max-lg:hidden"><AdBanner id="ad-aside-2" placement="tall" /></div>
          </aside>
        </div>
      </>
    )
  }

  const ranked = next()
  const duels = next()
  const about = next()
  const decks = view.deckStats ? next() : ''
  const tours = next()
  return (
    <>
      {asVisitor ? <VisitorBanner id={profile.id} /> : null}
      {header}
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Rail num={ranked} label="Ranked ladders" stamp="Elo live · rank from last sync" />
          <VipLadders ladders={profile.ladders} currentSeasons={profile.currentSeasons} first={first} charts={view.charts} />
          <Rail num={duels} label="Duel history" stamp="Ranked only" className="mt-4" />
          {history}
        </div>
        <aside className="flex min-w-0 flex-col gap-6">
          <AdBanner id="ad-aside" placement="aside" />
          <About num={about} vip bio={profile.bio} socials={profile.socials} favoriteCard={profile.favoriteCard} favoriteDeck={profile.favoriteDeck} />
          {view.deckStats ? <DeckCharts profileId={profile.id} num={decks} asVisitor={asVisitor} /> : null}
          {profile.tournaments.played ? <TournamentRecord profileId={profile.id} tournaments={profile.tournaments} num={tours} /> : null}
        </aside>
      </div>
    </>
  )
}

const ProfilePage = ({ profile, asVisitor = false }: { profile: Profile; asVisitor?: boolean }) => (
  <>
    <Header />
    {/* `clip`, not `hidden`: `hidden` makes main a scroll container and the aside's sticky ad stops sticking. */}
    <main data-clear-gutters className="flex min-h-dvh flex-col overflow-x-clip pt-16">
      <AdBanner id="ad-top" placement="content" slim className="mx-auto w-full max-w-page px-4 pt-5 min-[1312px]:px-0" />
      <div className="mx-auto flex w-full max-w-page flex-col gap-10 px-4 pt-7 pb-16 max-md:gap-5 max-md:pt-0 min-[1312px]:px-0">
        <ProfileBody profile={profile} asVisitor={asVisitor} />
      </div>
    </main>
    <Footer />
    {profile.cosmetics?.SONG ? <SongPlayer song={profile.cosmetics.SONG} /> : null}
  </>
)

export default ProfilePage
