import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { twMerge } from "tailwind-merge";
import { Footer } from "@ui/footer";
import { Header } from "@ui/header";
import { AvatarFrame } from "@ui/avatar";
import { Eyebrow } from "@ui/eyebrow";
import { EmptyBox } from "@omega/profile/empty-box";
import { PrivateNotice } from "@omega/profile/private-notice";
import { Skeleton } from "@omega/analytics/primitives";
import { getPlayerStatistics } from "@utils/statistics";
import { getPlayerTournamentStats } from "@utils/tournaments";
import type { Profile, RankedLadderId } from "@utils/types";
import { RankedReport } from "./RankedReport";
import { TournamentReport } from "./TournamentReport";

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

/** Ranked: one season, or every season of a ladder. Tournaments: one format or all. Global: everything. */
export type StatisticsView =
  | { view: 'ranked'; season?: string; ladder?: RankedLadderId }
  | { view: 'tournaments'; format?: string }
  | { view: 'global' }

const LADDER: Record<RankedLadderId, 'TCG' | 'Genesys'> = { tcg: 'TCG', genesys: 'Genesys' }

const Loading = ({ label }: { label: string }) => (
  <div className="pt-section"><Skeleton rows={6} label={label} /></div>
)

const Chip = ({ href, on, children }: { href: string; on: boolean; children: React.ReactNode }) => (
  <Link
    href={href}
    aria-current={on ? 'page' : undefined}
    scroll={false}
    className={twMerge(
      'inline-flex min-h-11 items-center gap-2 border px-3 signal-chip',
      on ? 'border-cyan bg-ground-cyan text-cyan' : 'border-line text-ink-dim hover:border-cyan hover:text-cyan',
    )}
  >
    {children}
  </Link>
)

/** The slow part (a few seconds cold): streamed behind a skeleton so the head and the pickers paint at once. */
const RankedBody = async ({ playerId, query, cookie }: { playerId: string; query: { season?: string; ladder?: RankedLadderId }; cookie: string | null }) => {
  const result = await getPlayerStatistics(playerId, query, cookie)
  if (!result.ok) {
    if (result.status === 403) return <PrivateNotice />
    return (
      <div className="pt-section">
        <EmptyBox title={result.status === 404 ? 'No statistics here' : "Couldn't read the statistics"}>
          {result.status === 404 ? "That season doesn't exist." : "The game server didn't answer. Try again in a moment."}
        </EmptyBox>
      </div>
    )
  }
  const { matches } = result.data
  return (
    <>
      {matches.analyzed < matches.total ? (
        <p className="mt-6 border border-gold bg-ground-gold px-4 py-3 text-gold body-sm">
          {matches.total.toLocaleString('en-US')} matches here: only the newest {matches.analyzed.toLocaleString('en-US')} were analyzed.
        </p>
      ) : null}
      {/* No record: an API older than the field (the API ships first). */}
      {result.data.record ? (
        <RankedReport data={result.data} />
      ) : (
        <div className="pt-section">
          <EmptyBox title="Couldn't read the statistics">The game server didn&apos;t answer. Try again in a moment.</EmptyBox>
        </div>
      )}
    </>
  )
}

/** `picker`: the format chips; Global shows every format without them. */
const TournamentBody = async ({ playerId, format, picker = true }: { playerId: string; format?: string; picker?: boolean }) => {
  const data = await getPlayerTournamentStats(playerId, format).catch(() => null)
  if (!data)
    return (
      <div className="pt-section">
        <EmptyBox title="Couldn't read the tournaments">The game server didn&apos;t answer. Try again in a moment.</EmptyBox>
      </div>
    )
  return (
    <>
      {picker && data.formats.length ? (
        <nav aria-label="Format" className="mt-6 flex flex-wrap items-center gap-2">
          <span className="w-18 shrink-0 text-ink-muted signal-sm">Format</span>
          <Chip href={`/profile/${playerId}/statistics?view=tournaments`} on={!format}>All formats</Chip>
          {data.formats.map((f) => (
            <Chip key={f.format} href={`/profile/${playerId}/statistics?view=tournaments&format=${encodeURIComponent(f.format)}`} on={f.format === format}>
              {f.format} · {f.tournaments}
            </Chip>
          ))}
        </nav>
      ) : null}
      <TournamentReport data={data} />
    </>
  )
}

const SeasonPicker = ({ profileId, choices, selection }: { profileId: string; choices: SeasonChoice[]; selection: { season?: string; ladder?: RankedLadderId } }) => (
  <nav aria-label="Season" className="mt-6 grid gap-3">
    {(['tcg', 'genesys'] as const).map((ladder) => {
      const format = LADDER[ladder]
      const seasons = choices.filter((choice) => choice.format === format)
      if (!seasons.length) return null
      return (
        <div key={format} className="flex flex-wrap items-center gap-2">
          <span className="w-18 shrink-0 text-ink-muted signal-sm">{format}</span>
          {seasons.map((choice) => (
            <Chip key={choice.code} href={`/profile/${profileId}/statistics?season=${encodeURIComponent(choice.code)}`} on={choice.code === selection.season}>
              {choice.label}
              {choice.open ? <span className="size-1.5 bg-win" aria-label="open season" /> : null}
            </Chip>
          ))}
          <Chip href={`/profile/${profileId}/statistics?ladder=${ladder}`} on={!selection.season && selection.ladder === ladder}>
            All seasons
          </Chip>
        </div>
      )
    })}
  </nav>
)

const TABS = [
  { view: 'ranked', label: 'Ranked' },
  { view: 'tournaments', label: 'Tournaments' },
  { view: 'global', label: 'Global' },
] as const

type PlayerStatisticsProps = {
  profile: Profile
  choices: SeasonChoice[]
  selection: StatisticsView
  cookie: string | null
}

export const PlayerStatistics = ({ profile, choices, selection, cookie }: PlayerStatisticsProps) => {
  const name = profile.displayName ?? profile.handle ?? 'Unknown duelist'
  const base = `/profile/${profile.id}/statistics`
  const ranked = selection.view === 'ranked' ? selection : null
  const current = choices.find((choice) => choice.code === ranked?.season)
  const meta =
    selection.view === 'global' ? 'Every season · every tournament'
    : selection.view === 'tournaments' ? selection.format ?? 'Every format'
    : current ? `${current.format} · ${current.label}`
    : ranked?.ladder ? `${LADDER[ranked.ladder]} · every season` : undefined

  return (
    <>
      <Header />
      <main className="flex min-h-dvh flex-col overflow-x-hidden pt-16 pb-[clamp(56px,7vw,96px)]">
        <div className="mx-auto w-full max-w-page px-gutter">
          <section className="pt-section">
            <Link href={`/profile/${profile.id}`} className="inline-flex min-h-11 items-center text-ink-muted signal hover:text-cyan">
              ← Back to profile
            </Link>
            <Eyebrow tone="cyan" meta={meta} className="mt-3">
              Duelist statistics
            </Eyebrow>
            <div className="mt-5 flex items-center gap-[clamp(14px,2vw,22px)]">
              {profile.avatar ? (
                <div className="relative size-[clamp(56px,7vw,80px)] shrink-0 border-3 border-space-000 bg-surface-100 shadow-lift">
                  <Image src={profile.avatar} alt="" fill sizes="80px" className="object-cover" />
                  <AvatarFrame cosmetics={profile.cosmetics} />
                </div>
              ) : null}
              <h1 className="min-w-0 text-ink display-1">{name}</h1>
            </div>
            {profile.isPrivate ? null : (
              <nav aria-label="Statistics" className="mt-6 flex flex-wrap gap-2">
                {TABS.map((tab) => (
                  <Chip key={tab.view} href={tab.view === 'ranked' ? base : `${base}?view=${tab.view}`} on={selection.view === tab.view}>
                    {tab.label}
                  </Chip>
                ))}
              </nav>
            )}
            {ranked && choices.length && !profile.isPrivate ? <SeasonPicker profileId={profile.id} choices={choices} selection={ranked} /> : null}
          </section>

          {profile.isPrivate ? (
            <PrivateNotice />
          ) : selection.view === 'tournaments' ? (
            <Suspense key={selection.format ?? ''} fallback={<Loading label="Reading every tournament…" />}>
              <TournamentBody playerId={profile.id} format={selection.format} />
            </Suspense>
          ) : selection.view === 'global' ? (
            <>
              <h2 className="mt-12 text-ink display-4 min-[720px]:mt-16">Ranked · every season</h2>
              <Suspense fallback={<Loading label="Reading every ranked game…" />}>
                <RankedBody playerId={profile.id} query={{}} cookie={cookie} />
              </Suspense>
              <h2 className="mt-12 text-ink display-4 min-[720px]:mt-16">Tournaments · every format</h2>
              <Suspense fallback={<Loading label="Reading every tournament…" />}>
                <TournamentBody playerId={profile.id} picker={false} />
              </Suspense>
            </>
          ) : !ranked?.season && !ranked?.ladder ? (
            <div className="pt-section">
              <EmptyBox title="No season to show">This duelist has no ranked season on record yet.</EmptyBox>
            </div>
          ) : (
            // Keyed by the pick so switching streams a fresh skeleton instead of holding the old numbers.
            <Suspense key={ranked.season ?? ranked.ladder} fallback={<Loading label="Reading every ranked game…" />}>
              <RankedBody
                playerId={profile.id}
                query={ranked.season ? { season: ranked.season } : { ladder: ranked.ladder }}
                cookie={cookie}
              />
            </Suspense>
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}
