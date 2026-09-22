'use client'

import { useId, useState } from "react";
import { LadderCard, openSeason } from "@omega/profile/ladder-card";
import { SectionHead } from "@ui/section-head";
import { TabBar, tabPanelProps } from "@ui/tab-bar";
import type { Ladder, Match } from "@utils/types";

type RankedStandingProps = {
  num: string
  /** Always `TCG` then `Genesys`. */
  ladders: Ladder[]
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
export const RankedStanding = ({ num, ladders, matches }: RankedStandingProps) => {
  const [active, setActive] = useState(() => (ladders.find((ladder) => ladder.played) ?? ladders[0])?.format)
  const idPrefix = useId()
  const ladder = ladders.find(({ format }) => format === active)
  if (!ladder) return null

  return (
    <section id="ranked" className="pt-section">
      <SectionHead num={num}>Ranked standing</SectionHead>
      <p className="mt-2 text-ink-muted signal-sm">
        {ladder.played ? openSeason(ladder)?.label ?? 'Lifetime' : 'No season played'} · {ladder.format}
      </p>

      <TabBar
        label="Format"
        idPrefix={idPrefix}
        tabs={ladders.map(({ format }) => ({ id: format, label: format }))}
        active={ladder.format}
        onSelect={setActive}
        className="mt-4 max-w-130"
      />

      <div {...tabPanelProps(idPrefix, ladder.format)}>
        <LadderCard ladder={ladder} recent={recentFrom(matches, ladder.format)} />
      </div>
    </section>
  )
}
