import Link from "next/link";
import { twMerge } from "tailwind-merge";
import { useTranslations } from "next-intl";
import { MICRO_LABEL } from "@omega/profile/accent";
import { formatNumber } from "@omega/profile/labels";
import { LocalTime } from "@omega/profile/local-time";
import { buttonClasses } from "@ui/button";
import { RailHead } from "@ui/rail-head";
import type { WelcomeTournament } from "@utils/types";
import { relative, type UpcomingTournament } from "@utils/welcome";
import { ArrowLink, GHOST_TAG, OUTLINE_BUTTON, RailFooter, ROW_PAD } from "./rails";
import { TournamentBanner } from "./TournamentBanner";

const LIVE_TAG = "border border-surface-400 px-2.75 py-1.5 text-ink-dim signal"

const LiveBoard = ({ live }: { live: WelcomeTournament }) => {
  const t = useTranslations('Welcome.tournaments');

  return (
    <div className="grid grid-cols-1 gap-px border-b border-line bg-line lg:grid-cols-[minmax(0,1fr)_340px]">
      <TournamentBanner season={live.season} sizes="(min-width: 1024px) 70vw, 100vw" imageClassName="duotone">
        <div aria-hidden className="absolute inset-0 bg-linear-100 from-veil-base via-veil-base to-veil-top" />
        <div className={twMerge("relative py-7.5 lg:py-9.5", ROW_PAD)}>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 bg-negative px-3 py-1.5 text-negative-on signal-chip">
              <span aria-hidden className="block size-2 animate-blink bg-current" />
              {t('liveNow')}
            </span>
            <span className={LIVE_TAG}>{live.format}</span>
            <span className={LIVE_TAG}>{t('swissRounds', { rounds: live.rounds })}</span>
          </div>
          <h2 className="mt-5 max-w-[22ch] text-ink display-1">{live.name}</h2>
          <div className="mt-6.5 flex flex-wrap gap-3.5">
            <Link href={`/tournament/${live.id}`} className={buttonClasses({ size: 'sm' })}>
              {t('watchBracket')}
            </Link>
            <Link href={`/tournament/${live.id}`} className={OUTLINE_BUTTON}>{t('standings')}</Link>
          </div>
        </div>
      </TournamentBanner>

      <dl className="grid grid-cols-1 gap-px bg-line">
        {[
          { label: t('players_label'), value: formatNumber(live.players) },
          { label: t('rounds'), value: live.rounds },
          { label: t('banlist'), value: live.banlist, accent: true },
          { label: t('started'), value: <LocalTime iso={live.startedAt} options={{ hour: '2-digit', minute: '2-digit' }} /> },
        ].map(({ label, value, accent }) => (
          <div key={label} className="flex items-baseline justify-between gap-3.5 bg-surface-000 px-6 py-5">
            <dt className={MICRO_LABEL}>{label}</dt>
            <dd className={twMerge("display-4", accent ? "text-gold" : "text-ink")}>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

const IdleBoard = ({ line }: { line: string }) => {
  const t = useTranslations('Welcome.tournaments');

  return (
    <div className={twMerge("flex flex-wrap items-center gap-6.5 border-b border-line py-8 lg:py-11", ROW_PAD)}>
      <div aria-hidden className="flex size-17 shrink-0 items-center justify-center border border-line">
        <span className="block size-2.5 bg-surface-400" />
      </div>
      <div className="min-w-0 flex-[1_1_340px]">
        <h2 className="text-ink-dim display-6">{t('noTournamentRunning')}</h2>
        <p className="mt-3 max-w-[52ch] text-ink-dim body">{line}</p>
      </div>
      <Link href="/tournaments" className={OUTLINE_BUTTON}>{t('browseSchedule')}</Link>
    </div>
  )
}

const ROW = twMerge("grid grid-cols-1 items-center gap-2 border-b border-line py-5 hover:bg-surface-300 md:grid-cols-[minmax(0,1fr)_auto] md:gap-5", ROW_PAD)
const ROW_META = "flex flex-wrap items-center gap-2.5 text-ink-muted signal"
const ROW_NAME = "mt-2 text-ink display-6"
const ROW_NOTE = "mt-1.5 text-ink-dim mono-note"

const EmptyRow = ({ children }: { children: React.ReactNode }) => (
  <p className={twMerge("border-b border-line py-8 text-ink-dim body-sm", ROW_PAD)}>{children}</p>
)

const ResultRow = ({ event, now }: { event: WelcomeTournament; now: number }) => {
  const t = useTranslations('Welcome.tournaments');
  const winner = event.winner?.name ?? event.winner?.handle ?? t('unknownDuelist')
  const deck = event.winner?.archetype

  return (
    <Link href={`/tournament/${event.id}`} className={twMerge(ROW, "group relative overflow-hidden")}>
      <TournamentBanner
        season={event.season}
        sizes="(min-width: 1280px) 50vw, 100vw"
        className="absolute inset-0"
        imageClassName="duotone opacity-60 transition-opacity group-hover:opacity-90"
      >
        <div aria-hidden className="absolute inset-0 bg-linear-100 from-veil-base via-veil-base to-veil-top" />
      </TournamentBanner>
      <div className="relative min-w-0">
        <div className={ROW_META}>
          <span className="first-letter:uppercase">{relative(event.endedAt ?? event.startedAt, now)}</span>
          <span>{event.format}</span>
        </div>
        <p className={ROW_NAME}>{event.name}</p>
        <p className={ROW_NOTE}>{deck ? t('wonBy', { winner, deck }) : t('wonByNoDeck', { winner })}</p>
      </div>
      <div className="relative flex md:justify-end">
        <span className={GHOST_TAG}>{formatNumber(event.players)} {t('players')}</span>
      </div>
    </Link>
  )
}

type TournamentsProps = {
  live: WelcomeTournament | null
  /** Last finished TCG tournaments. */
  tcg: WelcomeTournament[]
  /** Last finished tournaments of every other format. */
  other: WelcomeTournament[]
  upcoming: UpcomingTournament[]
  idleLine: string
  now: number
}

export const Tournaments = ({ live, tcg, other, upcoming, idleLine, now }: TournamentsProps) => {
  const t = useTranslations('Welcome.tournaments');

  return (
    <section id="tournaments" className="border-b border-line-strong">
      <RailHead
        num="02"
        label={t('lastTournaments')}
        stamp={live ? t('oneEventLive') : t('noEventLive') + t('upcomingCount', { count: upcoming.length })}
      />

      {live ? <LiveBoard live={live} /> : <IdleBoard line={idleLine} />}

      <div className="grid grid-cols-1 gap-px bg-line xl:grid-cols-2">
        <div className="bg-surface-000">
          <RailHead label={t('lastTournaments')} className="py-3.5 text-ink signal" />
          {tcg.length
            ? tcg.map((event) => <ResultRow key={event.id} event={event} now={now} />)
            : <EmptyRow>{t('noFinishedTournaments')}</EmptyRow>}
        </div>

        <div className="bg-surface-000">
          <RailHead emphasis label={t('upcoming')} className="py-3.5 signal" />
          {other.length
            ? other.map((event) => <ResultRow key={event.id} event={event} now={now} />)
            : <EmptyRow>{t('noFinishedTournaments')}</EmptyRow>}
        </div>
      </div>

      <RailFooter>
        <ArrowLink href="/tournaments">{t('allTournaments')}</ArrowLink>
      </RailFooter>
    </section>
  )
}
