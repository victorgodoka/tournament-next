import Link from "next/link";
import { twMerge } from "tailwind-merge";
import { Chip } from "@ui/chip";
import { CardArt } from "@omega/card-art";
import { buttonClasses } from "@ui/button";
import type { Ladder, LadderStats } from "@utils/types";
import { ACCENT_CLASSES, MICRO_LABEL, MICRO_TAG, MUTED_TAG } from "./accent";
import { formatNumber } from "./labels";

const Stat = ({ label, value, className }: { label: string; value: string; className?: string }) => (
  <div>
    <p className={MICRO_LABEL}>{label}</p>
    <p className={twMerge("mt-1.5 font-display text-[56px] leading-[.85] text-ink", className)}>{value}</p>
  </div>
)

const STREAK = {
  W: { title: 'Win', className: "bg-cyan text-cyan-on" },
  L: { title: 'Loss', className: "bg-gold text-gold-on" },
  D: { title: 'Draw', className: "bg-surface-400 text-ink-dim" },
}

/** One square per recent duel, newest last. */
const FormStreak = ({ recent }: { recent: string }) => (
  <ul className="mt-2.5 flex flex-wrap gap-1">
    {[...recent].map((result, i) => {
      const { title, className } = STREAK[result as keyof typeof STREAK] ?? STREAK.D
      return (
        <li key={`${i}_${result}`} title={title} className={twMerge("inline-flex size-7 items-center justify-center signal-count", className)}>
          {result}
        </li>
      )
    })}
  </ul>
)

/** Deck usage and form. Both depend on data jobs that may not be live yet, so each part is optional. */
const LadderDetail = ({ stats }: { stats: LadderStats }) => {
  const record = `${formatNumber(stats.wins)}W / ${formatNumber(stats.loses)}L / ${formatNumber(stats.draws)}D`

  return (
    <>
      {stats.topDeck ? (
        <div className="mt-7 flex items-center gap-3.5 border-t border-line pt-5">
          <CardArt art={stats.topDeck.art} sizes="64px" className="size-16 shrink-0" />
          <div>
            <p className={MICRO_LABEL}>Most used deck</p>
            <p className="mt-1.5 text-ink display-5">{stats.topDeck.name}</p>
            {stats.topDeckMeta?.duels ? (
              <p className="mt-1 text-ink-dim mono-data">
                {formatNumber(stats.topDeckMeta.duels)} duels · {Math.round((stats.topDeckMeta.wins / stats.topDeckMeta.duels) * 100)}% win rate
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mt-6 border-t border-line pt-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className={MICRO_LABEL}>{stats.recent ? `Last ${stats.recent.length} duels` : 'Record'}</p>
          <p className="text-ink-dim mono-data">{record}</p>
        </div>
        {stats.recent ? <FormStreak recent={stats.recent} /> : null}
      </div>
    </>
  )
}

/** Shown when the duelist never entered this ladder. */
const LadderUnplayed = ({ format }: { format: string }) => (
  <div className="mt-6 border-t border-line pt-8.5 pb-1.5">
    <p className="text-ink-dim display-6">No {format} duels yet</p>
    <p className="mt-3.5 max-w-[40ch] text-ink-dim body">
      This duelist has not entered the {format} ladder. Elo is assigned after the first ranked duel in the format.
    </p>
    <Link
      href="https://tournament.duelistsunite.org/"
      className={twMerge(buttonClasses({ variant: 'secondary', size: 'sm' }), "mt-6")}
    >
      About {format}
    </Link>
  </div>
)

export const LadderCard = ({ ladder }: { ladder: Ladder }) => {
  const accent = ACCENT_CLASSES[ladder.accent]

  return (
    <article className="bg-surface-000 px-5.5 py-8 lg:px-11 lg:py-10">
      <header className="flex items-center gap-3">
        <Chip className={twMerge(MICRO_TAG, ladder.played ? twMerge(accent.bg, accent.onBg, "border-transparent") : MUTED_TAG)}>
          {ladder.format}
        </Chip>
        <span className={MICRO_LABEL}>{ladder.played ? ladder.season ?? 'Lifetime' : 'No season played'}</span>
      </header>

      {ladder.played ? (
        <>
          <div className="mt-6 flex flex-wrap items-end gap-x-10 gap-y-6">
            <Stat label="Elo" value={formatNumber(ladder.elo)} className={accent.text} />
            <Stat label="Tier" value={ladder.tier} />
          </div>
          <LadderDetail stats={ladder} />
        </>
      ) : (
        <LadderUnplayed format={ladder.format} />
      )}
    </article>
  )
}
