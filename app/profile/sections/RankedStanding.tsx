'use client'

import { useId, useState } from "react";
import Link from "next/link";
import { LadderCard, openSeason } from "@omega/profile/ladder-card";
import { SectionHead } from "@ui/section-head";
import { TabBar, tabPanelProps } from "@ui/tab-bar";
import type { CurrentSeason, Ladder, Match } from "@utils/types";

type RankedStandingProps = {
  num: string
  profileId: string
  /** Always `TCG` then `Genesys`. */
  ladders: Ladder[]
  /** Names the open season for a ladder the duelist never played (it has no `seasons`). */
  currentSeasons: CurrentSeason[]
  /** Newest first. Stands in for `ladder.recent` while the API still sends it as `null`. */
  matches: Match[]
}

// ponytail: only sees the first page of matches (both ladders mixed), so the streak can run short of 5; drop once the API fills `recent`.
const recentFrom = (matches: Match[], format: Ladder['format']) =>
  matches
    .filter((match) => match.format === `${format} ranked`)
    .slice(0, 5)
    .reverse()
    .map((match) => (match.win === null ? 'D' : match.win ? 'W' : 'L'))
    .join('')

/** Tabbed per-format standing. Opens on the first ladder the duelist actually played. */
export const RankedStanding = ({ num, profileId, ladders, currentSeasons, matches }: RankedStandingProps) => {
  const [active, setActive] = useState(() => (ladders.find((ladder) => ladder.played) ?? ladders[0])?.format)
  const idPrefix = useId()
  const ladder = ladders.find(({ format }) => format === active)
  if (!ladder) return null
  const season = ladder.played ? openSeason(ladder) : currentSeasons.find(({ format }) => format === ladder.format)

  return (
    <section id="ranked" className="pt-section">
      <SectionHead num={num}>Ranked standing</SectionHead>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="text-ink-muted signal-sm">
          {season?.label ?? 'Lifetime'} · {ladder.format}
        </p>
        {ladder.played && season ? (
          <Link
            href={`/profile/${profileId}/statistics?season=${encodeURIComponent(season.code)}`}
            className="inline-flex min-h-11 items-center gap-2 text-gold signal hover:text-cyan"
          >
            Season statistics →
          </Link>
        ) : null}
      </div>

      <TabBar
        label="Format"
        idPrefix={idPrefix}
        tabs={ladders.map(({ format }) => ({ id: format, label: format }))}
        active={ladder.format}
        onSelect={setActive}
        className="mt-4 max-w-130"
      />

      <div {...tabPanelProps(idPrefix, ladder.format)}>
        <LadderCard ladder={ladder} season={season?.code} recent={recentFrom(matches, ladder.format)} />
      </div>
    </section>
  )
}
