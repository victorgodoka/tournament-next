'use client'

import { useId, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Icon } from "@iconify/react";
import { twMerge } from "tailwind-merge";
import { CardArt } from "@omega/card-art";
import type { Match, MatchSide } from "@utils/types";
import { ANALYTICS_ENABLED } from "@utils/const";
import { ResultPill } from "@ui/result";
import { LocalTime } from "./local-time";

/** Own chunk, fetched on the first open: never downloaded while analytics is off. */
const MatchAnalytics = dynamic(() => import("@omega/analytics/match-analytics").then((m) => m.MatchAnalytics));

/** Desktop column tracks, shared by the head and every row so they line up. The last one is the toggle. */
const COLS =
  "lg:grid-cols-[40px_minmax(0,1.1fr)_minmax(0,1fr)_76px_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.9fr)_32px] lg:gap-x-5"

/** Every cell sits in column two on a phone and takes its own track from `lg` up. */
const CELL = "col-start-2 lg:col-auto lg:row-auto"

/** Column labels over the ledger. Hidden on phones, where each row stacks. */
export const MatchLedgerHead = () => (
  <div aria-hidden className={twMerge("hidden border-b border-line-mid bg-surface-200 px-4 py-2.5 text-ink-muted signal-sm lg:grid", COLS)}>
    <span>Res</span>
    <span>Duelist</span>
    <span>Deck</span>
    <span>Score</span>
    <span>Opponent</span>
    <span>Their deck</span>
    <span className="text-right">When</span>
    <span />
  </div>
)

/** A deck as a fan of up to three overlapping art chips plus its name. */
const DeckCell = ({ side, muted, className }: { side: MatchSide; muted?: boolean; className?: string }) => (
  <div className={twMerge("flex min-w-0 items-center gap-2.5", className)}>
    {side.cards.length ? (
      <ul aria-hidden className="flex shrink-0">
        {side.cards.map((art) => (
          <li key={art.id} className="-ml-2.5 first:ml-0">
            <CardArt art={art} alt="" sizes="36px" className="size-9 border border-line-mid" />
          </li>
        ))}
      </ul>
    ) : null}
    {side.deck ? <span className={twMerge("truncate signal", muted ? "text-ink-muted" : "text-ink-dim")}>{side.deck}</span> : null}
  </div>
)

/** Games won each side, in Anton with a spaced en dash: "2 – 1". */
const ScoreCell = ({ score }: { score: Match['score'] }) =>
  !score.self && !score.opponent ? (
    <span className="text-ink-muted mono-data">—</span>
  ) : (
    <span className="whitespace-nowrap text-ink stat">
      {score.self} – {score.opponent}
    </span>
  )

/** "TCG ranked · Ranked ladder" says ranked twice: keep the event only when it adds something. */
const queueLabel = ({ format, event }: Match) => {
  const kind = format.split(' ').pop()?.toLowerCase()
  return !event || (kind && event.toLowerCase().includes(kind)) ? format : `${format} · ${event}`
}

/**
 * One ledger line. `win: null` is a draw or an unfinished duel, never a loss.
 * Clicking the line (anywhere but a link) opens the duel's timeline and statistics below it; the
 * panel mounts on first open and stays mounted, so closing and reopening doesn't refetch.
 */
export const MatchRow = ({ match }: { match: Match }) => {
  const result = match.win === null ? 'D' : match.win ? 'W' : 'L'
  const panelId = useId()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  const toggle = () => {
    if (!ANALYTICS_ENABLED) return
    setMounted(true)
    setOpen((current) => !current)
  }

  return (
    <li className="border-b border-line last:border-b-0">
      <div
        onClick={(event) => {
          // Links and the button handle themselves; the rest of the line is one big target.
          if (!(event.target as HTMLElement).closest('a, button')) toggle()
        }}
        className={twMerge(
          "grid grid-cols-[40px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-4 py-3.5 transition-colors hover:bg-surface-300",
          ANALYTICS_ENABLED && "cursor-pointer",
          open && "bg-surface-200 hover:bg-surface-200",
          COLS,
        )}
      >
        <span className="row-span-7 self-start lg:row-span-1 lg:self-center">
          <ResultPill result={result} />
        </span>
  
        <div className={twMerge("min-w-0", CELL)}>
          <p className="truncate text-ink body-strong">{match.self.name || 'Unknown duelist'}</p>
          <p className="mt-0.5 truncate text-ink-muted signal-sm">{queueLabel(match)}</p>
        </div>
  
        <DeckCell side={match.self} className={CELL} />
  
        <span className={CELL}>
          <ScoreCell score={match.score} />
        </span>
  
        <div className={twMerge("min-w-0", CELL)}>
          <span className="sr-only">versus </span>
          <Link href={`/profile/${match.opponent.id}`} className="block truncate text-ink body-strong hover:text-cyan">
            {match.opponent.name || 'Unknown duelist'}
          </Link>
        </div>
  
        <DeckCell side={match.opponent} muted className={CELL} />
  
        <p className={twMerge("text-ink-muted mono-data lg:text-right", CELL)}>
          {match.when ? <LocalTime iso={match.when} options={{ dateStyle: 'medium', timeStyle: 'short' }} /> : '—'}
        </p>
  
        {ANALYTICS_ENABLED ? <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={toggle}
          className={twMerge(
            "inline-flex min-h-11 cursor-pointer items-center gap-2 justify-self-start text-ink-dim signal-sm hover:text-cyan lg:size-8 lg:min-h-0 lg:justify-center lg:justify-self-end lg:border lg:border-line lg:hover:border-cyan",
            CELL,
            open && "text-cyan lg:border-cyan",
          )}
        >
          <span className="lg:sr-only">{open ? 'Hide' : 'Timeline & stats'}</span>
          <span className="sr-only max-lg:hidden"> for the duel against {match.opponent.name || 'Unknown duelist'}</span>
          <Icon icon="mdi:chevron-down" aria-hidden className={twMerge("size-5 motion-safe:transition-transform", open && "rotate-180")} />
        </button> : null}
      </div>
  
      {mounted ? (
        <div
          id={panelId}
          role="region"
          aria-label={`Duel against ${match.opponent.name || 'Unknown duelist'}`}
          hidden={!open}
          className="border-t border-line bg-surface-100/40 px-4 py-5 motion-safe:transition-[opacity,translate] motion-safe:duration-200 motion-safe:ease-out lg:px-[clamp(16px,4vw,60px)] lg:py-7 motion-safe:starting:-translate-y-1 motion-safe:starting:opacity-0"
        >
          <MatchAnalytics matchId={match.id} />
        </div>
      ) : null}
    </li>
  )
}
