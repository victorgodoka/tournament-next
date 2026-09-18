import Link from "next/link";
import { twMerge } from "tailwind-merge";
import { CardArt } from "@omega/card-art";
import { MICRO_LABEL } from "@omega/profile/accent";
import { formatNumber } from "@omega/profile/labels";
import { LocalTime } from "@omega/profile/local-time";
import { buttonClasses } from "@ui/button";
import { RailHead } from "@ui/rail-head";
import { countdown, relative, type LiveTournament, type PastTournament, type UpcomingTournament } from "@utils/welcome";
import { ArrowLink, GHOST_TAG, OUTLINE_BUTTON, RailFooter, ROW_PAD } from "./rails";

const DAY = 86_400_000
const LIVE_TAG = "border border-surface-400 px-2.75 py-1.5 text-ink-dim signal"

const LiveBoard = ({ live }: { live: LiveTournament }) => (
  <div className="grid grid-cols-1 gap-px border-b border-line bg-line lg:grid-cols-[minmax(0,1fr)_340px]">
    <CardArt art={live.art} alt="" sizes="(min-width: 1024px) 70vw, 100vw" imageClassName="object-[center_28%] duotone">
      <div aria-hidden className="absolute inset-0 bg-linear-100 from-veil-base via-veil-base to-veil-top" />
      <div className={twMerge("relative py-7.5 lg:py-9.5", ROW_PAD)}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 bg-cyan px-3 py-1.5 text-cyan-on signal-chip">
            <span aria-hidden className="block size-2 animate-blink bg-current" />
            Live now
          </span>
          <span className={LIVE_TAG}>{live.format}</span>
          <span className={LIVE_TAG}>{live.structure}</span>
        </div>
        <h2 className="mt-5 max-w-[22ch] text-ink display-1">{live.name}</h2>
        <p className="mt-3.5 max-w-[48ch] text-ink-dim body">{live.blurb}</p>
        <div className="mt-6.5 flex flex-wrap gap-3.5">
          <Link href="/tournaments" className={buttonClasses({ size: 'sm' })}>
            Watch bracket
          </Link>
          <Link href="/tournaments" className={OUTLINE_BUTTON}>Standings</Link>
        </div>
      </div>
    </CardArt>

    <dl className="grid grid-cols-1 gap-px bg-line">
      {[
        { label: 'Round', value: `${live.round} of ${live.rounds}` },
        { label: 'Players left', value: formatNumber(live.playersLeft) },
        { label: 'Duels played', value: formatNumber(live.duels) },
        { label: 'Prize pool', value: live.prizePool, accent: true },
      ].map(({ label, value, accent }) => (
        <div key={label} className="flex items-baseline justify-between gap-3.5 bg-surface-000 px-6 py-5">
          <dt className={MICRO_LABEL}>{label}</dt>
          <dd className={twMerge("display-4", accent ? "text-gold" : "text-ink")}>{value}</dd>
        </div>
      ))}
    </dl>
  </div>
)

const IdleBoard = ({ line }: { line: string }) => (
  <div className={twMerge("flex flex-wrap items-center gap-6.5 border-b border-line py-8 lg:py-11", ROW_PAD)}>
    <div aria-hidden className="flex size-17 shrink-0 items-center justify-center border border-line">
      <span className="block size-2.5 bg-surface-400" />
    </div>
    <div className="min-w-0 flex-[1_1_340px]">
      <h2 className="text-ink-dim display-6">No tournament running</h2>
      <p className="mt-3 max-w-[52ch] text-ink-dim body">{line}</p>
    </div>
    <Link href="/tournaments" className={OUTLINE_BUTTON}>Browse schedule</Link>
  </div>
)

const ROW = twMerge("grid grid-cols-1 items-center gap-2 border-b border-line py-5 hover:bg-surface-300 md:grid-cols-[minmax(0,1fr)_auto] md:gap-5", ROW_PAD)
const ROW_META = "flex flex-wrap items-center gap-2.5 text-ink-muted signal"
const ROW_NAME = "mt-2 text-ink display-6"
const ROW_NOTE = "mt-1.5 font-mono text-[11px] text-ink-dim"

const EmptyRow = ({ children }: { children: React.ReactNode }) => (
  <p className={twMerge("border-b border-line py-8 text-ink-dim body-sm", ROW_PAD)}>{children}</p>
)

type TournamentsProps = {
  live: LiveTournament | null
  past: PastTournament[]
  upcoming: UpcomingTournament[]
  idleLine: string
  now: number
}

export const Tournaments = ({ live, past, upcoming, idleLine, now }: TournamentsProps) => (
  <section id="tournaments" className="border-b border-line-strong">
    <RailHead
      num="02"
      label="Tournaments"
      stamp={`${live ? '1 event live' : 'No event live'}, ${upcoming.length} upcoming`}
    />

    {live ? <LiveBoard live={live} /> : <IdleBoard line={idleLine} />}

    <div className="grid grid-cols-1 gap-px bg-line xl:grid-cols-2">
      <div className="bg-surface-000">
        <RailHead label="Last tournaments" className="py-3.5 text-ink signal" />
        {past.length ? past.map((event) => (
          <div key={event.id} className={ROW}>
            <div className="min-w-0">
              <div className={ROW_META}>
                <span className="first-letter:uppercase">{relative(event.endedAt, now)}</span>
                <span>{event.format}</span>
              </div>
              <p className={ROW_NAME}>{event.name}</p>
              <p className={ROW_NOTE}>Won by {event.winner}, {event.deck}</p>
            </div>
            <div className="flex md:justify-end">
              <span className={GHOST_TAG}>{formatNumber(event.players)} players</span>
            </div>
          </div>
        )) : <EmptyRow>No finished tournaments yet. Results land here when a bracket closes.</EmptyRow>}
      </div>

      <div className="bg-surface-000">
        <RailHead emphasis label="Upcoming" className="py-3.5 signal" />
        {upcoming.length ? upcoming.map((event) => {
          const soon = Date.parse(event.startsAt) - now < DAY

          return (
            <div key={event.id} className={ROW}>
              <div className="min-w-0">
                <div className={ROW_META}>
                  <span className={twMerge("font-bold", soon && "text-cyan")}>
                    {soon
                      ? countdown(event.startsAt, now)
                      : <LocalTime iso={event.startsAt} options={{ weekday: 'short', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }} />}
                  </span>
                  <span>{event.format}</span>
                </div>
                <p className={ROW_NAME}>{event.name}</p>
                <p className={ROW_NOTE}>{event.slotsTaken} of {event.slots} slots taken</p>
              </div>
              <div className="flex md:justify-end">
                <Link
                  href="/tournaments"
                  className={twMerge(buttonClasses({ variant: 'ghost', size: 'mono' }), "border-gold text-gold hover:bg-gold hover:text-gold-on")}
                >
                  Register
                </Link>
              </div>
            </div>
          )
        }) : <EmptyRow>Nothing scheduled yet. New events are announced on Discord first.</EmptyRow>}
      </div>
    </div>

    <RailFooter>
      <ArrowLink href="/tournaments">All tournaments</ArrowLink>
    </RailFooter>
  </section>
)
