import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { twMerge } from "tailwind-merge";
import { Footer } from "@ui/footer";
import { Header } from "@ui/header";
import { AvatarFrame } from "@ui/avatar";
import { TierBadge } from "@ui/tier-badge";
import { EmptyBox } from "@omega/profile/empty-box";
import { PrivateNotice } from "@omega/profile/private-notice";
import { Skeleton } from "@omega/analytics/primitives";
import { getPlayerStatistics, infographicHrefs } from "@utils/statistics";
import { getPlayerTournamentStats } from "@utils/tournaments";
import type { Match, Profile, RankedLadderId } from "@utils/types";
import { RankedDashboard, type LadderStanding } from "./RankedDashboard";
import { standingOf } from "./insights";
import { StatisticsFilters } from "./StatisticsFilters";
import { TournamentSummary } from "./TournamentSummary";
import { TournamentReport } from "./TournamentReport";
import { InfographicLinks } from "@omega/infographic/infographic-links";

export type SeasonChoice = { code: string; label: string; format: 'TCG' | 'Genesys'; open: boolean }

/** Every season the duelist has a record in, played ladders first; an unplayed ladder offers its open season. */
export const seasonChoices = (profile: Extract<Profile, { isPrivate: false }>): SeasonChoice[] => {
  const played = profile.ladders.flatMap((ladder) =>
    ladder.played ? ladder.seasons.map(({ code, label, open }) => ({ code, label, open, format: ladder.format })) : [],
  )
  const unplayed = profile.currentSeasons
    .filter(({ format }) => !played.some((choice) => choice.format === format))
    .map(({ code, label, format }) => ({ code, label, format, open: true }))
  return [...played, ...unplayed]
}

/** Ranked: one season or every season of a ladder. Tournaments: one format or all, a param of its own. */
export type StatisticsSelection = { view: 'ranked' | 'tournaments'; season?: string; ladder: RankedLadderId; tournamentFormat?: string }

const LADDER: Record<RankedLadderId, 'TCG' | 'Genesys'> = { tcg: 'TCG', genesys: 'Genesys' }

const Loading = ({ label }: { label: string }) => <Skeleton rows={6} label={label} />

/** The slow part (a few seconds cold): streamed behind a skeleton so the head and the filters paint at once. */
const RankedBody = async ({ profileId, selection, standing, matches, cookie }: {
  profileId: string
  selection: StatisticsSelection
  standing: LadderStanding | null
  matches: Match[]
  cookie: string | null
}) => {
  const t = await getTranslations('PlayerStatistics')
  const result = await getPlayerStatistics(profileId, selection.season ? { season: selection.season } : { ladder: selection.ladder }, cookie)
  if (!result.ok) {
    if (result.status === 403) return <PrivateNotice />
    return <EmptyBox title={result.status === 404 ? t('errors.noSeason') : t('errors.title')}>{result.status === 404 ? t('errors.noSeasonBody') : t('errors.body')}</EmptyBox>
  }
  if (!result.data.matches.analyzed) return <EmptyBox title={t('errors.noGames')}>{t('errors.noGamesBody')}</EmptyBox>
  return <RankedDashboard data={result.data} standing={standing} matches={matches} profileId={profileId} />
}

const TournamentBody = async ({ profileId, format, base, cookie }: { profileId: string; format?: string; base: string; cookie: string | null }) => {
  const t = await getTranslations('PlayerStatistics')
  const data = await getPlayerTournamentStats(profileId, cookie, format).catch(() => null)
  if (!data) return <EmptyBox title={t('errors.tournaments')}>{t('errors.body')}</EmptyBox>
  const href = (f?: string) => `${base}?${new URLSearchParams({ view: 'tournaments', ...(f ? { format: f } : {}) })}`
  return (
    <>
      {data.formats.length ? (
        <nav aria-label={t('tournaments.format')} className="flex flex-wrap items-center gap-2">
          <Chip href={href()} on={!format}>{t('tournaments.allFormats')}</Chip>
          {data.formats.map((f) => (
            <Chip key={f.format} href={href(f.format)} on={f.format === format}>{f.format} · {f.tournaments}</Chip>
          ))}
        </nav>
      ) : null}
      <TournamentReport data={data} />
    </>
  )
}

const Chip = ({ href, on, children }: { href: string; on: boolean; children: React.ReactNode }) => (
  <Link
    href={href}
    aria-current={on ? 'page' : undefined}
    scroll={false}
    className={twMerge('inline-flex min-h-9 items-center gap-2 border px-3 signal-chip', on ? 'border-cyan bg-ground-cyan text-cyan' : 'border-line text-ink-dim hover:border-cyan hover:text-cyan')}
  >
    {children}
  </Link>
)

type PlayerStatisticsProps = {
  profile: Profile
  choices: SeasonChoice[]
  selection: StatisticsSelection
  cookie: string | null
}

export const PlayerStatistics = async ({ profile, choices, selection, cookie }: PlayerStatisticsProps) => {
  const t = await getTranslations('PlayerStatistics')
  const tIg = await getTranslations("Infographic.profile")
  const locale = await getLocale()
  const name = profile.displayName ?? profile.handle ?? t('unknown')
  const base = `/profile/${profile.id}/statistics`
  // Owner-only, even on a public profile: only the self profile carries `visibility`. The API checks too.
  const visible = !profile.isPrivate && profile.visibility !== undefined ? profile : null
  const standing = visible ? standingOf(visible, selection) : null
  const format = LADDER[selection.ladder]
  // The profile's first page of ranked matches, this format only (the history mixes both ladders).
  const matches = visible ? visible.matches.filter((m) => m.format.toLowerCase().includes(format.toLowerCase())) : []

  return (
    <>
      <Header />
      <main data-clear-gutters className="flex min-h-dvh flex-col overflow-x-hidden pt-16 pb-[clamp(56px,7vw,96px)]">
        <div className="mx-auto flex w-full max-w-page flex-col gap-8 px-gutter pt-8">
          {/* Compact head: who, the two tabs, and the rank of the pick */}
          <header className="flex flex-wrap items-center gap-5 border-b border-line pb-5">
            {profile.avatar ? (
              <div className="relative size-16 shrink-0 border-3 border-space-000 bg-surface-100 shadow-lift">
                <Image src={profile.avatar} alt="" fill sizes="64px" className="object-cover" />
                <AvatarFrame cosmetics={profile.cosmetics} />
              </div>
            ) : null}
            <div className="flex min-w-0 flex-col">
              <h1 className="truncate text-ink display-2">{name}</h1>
              {profile.handle ? <span className="text-ink-muted signal-sm">@{profile.handle}</span> : null}
            </div>
            <nav aria-label={t('tabs.label')} className="flex gap-1">
              <Link href={`/profile/${profile.id}`} className="inline-flex min-h-10 items-center px-4 text-ink-dim signal hover:text-cyan">{t('tabs.profile')}</Link>
              <span aria-current="page" className="inline-flex min-h-10 items-center border-b-2 border-cyan px-4 text-cyan signal">{t('tabs.statistics')}</span>
            </nav>
            {standing ? (
              <div className="ml-auto flex items-center gap-3">
                <TierBadge tier={standing.tier} size="lg" />
                <span className="flex flex-col text-right">
                  <span className="text-ink-muted signal-sm">{t('currentRank', { format })}</span>
                  <span className="font-mono text-sm text-ink">{standing.rank ? `#${standing.rank}` : '—'} · {standing.elo}</span>
                </span>
              </div>
            ) : null}
          </header>

          {profile.isPrivate ? (
            <PrivateNotice />
          ) : !visible ? (
            <EmptyBox title={t('errors.ownerOnly')}>{t('errors.ownerOnlyBody')}</EmptyBox>
          ) : (
            <>
              {/* One row of tabs for the whole page: TCG, Genesys (ranked) and Tournaments. */}
              <div className="flex flex-wrap items-end justify-between gap-4">
                <h2 className="display-3">{selection.view === 'tournaments' ? t('tournaments.title') : t('ranked')}</h2>
                <StatisticsFilters
                  base={base}
                  choices={choices}
                  season={selection.season}
                  ladder={selection.ladder}
                  view={selection.view}
                  keep={selection.tournamentFormat ? { format: selection.tournamentFormat } : {}}
                />
              </div>
              {/* Owner's own numbers as PNGs to share: the same pick as on screen. */}
              <InfographicLinks
                label={t('infographic.label')}
                hint={t('infographic.hint')}
                busy={t('infographic.busy')}
                failed={t('infographic.failed')}
                sizes={{ wide: t('infographic.wide'), tall: t('infographic.tall') }}
                items={(selection.view === 'tournaments' ? (['tournaments'] as const) : (['overview', 'decks', 'matchups'] as const)).map((section) => ({
                  label: tIg(`sections.${section}`),
                  file: `${profile.handle ?? profile.id}-${section}`,
                  hrefs: infographicHrefs(`${base}/infographic/${section}`, {
                    ...(selection.view === 'tournaments'
                      ? selection.tournamentFormat ? { format: selection.tournamentFormat } : {}
                      : selection.season ? { season: selection.season } : { ladder: selection.ladder }),
                    locale,
                  }),
                }))}
              />
              {selection.view === 'tournaments' ? (
                <section aria-label={t('tournaments.title')} className="flex flex-col gap-5">
                  <TournamentSummary tournaments={profile.tournaments} />
                  <Suspense key={selection.tournamentFormat ?? ''} fallback={<Loading label={t('loadingTournaments')} />}>
                    <TournamentBody profileId={profile.id} format={selection.tournamentFormat} base={base} cookie={cookie} />
                  </Suspense>
                </section>
              ) : !choices.length ? (
                <EmptyBox title={t('errors.noSeason')}>{t('errors.noRanked')}</EmptyBox>
              ) : (
                // Keyed by the pick so switching streams a fresh skeleton instead of holding the old numbers.
                <Suspense key={selection.season ?? selection.ladder} fallback={<Loading label={t('loadingRanked')} />}>
                  <RankedBody profileId={profile.id} selection={selection} standing={standing} matches={matches} cookie={cookie} />
                </Suspense>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}
