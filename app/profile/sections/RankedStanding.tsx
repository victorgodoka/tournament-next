import { RailHead } from "@ui/rail-head";
import { LadderCard } from "@omega/profile";
import type { Ladder } from "@utils/types";

export const RankedStanding = ({ ladders }: { ladders: Ladder[] }) => {
  const unplayed = ladders.find((ladder) => !ladder.played)

  return (
    <section id="ranked" className="border-b border-line-strong">
      <RailHead num="01" label="Ranked standing" stamp={unplayed ? `${unplayed.format}: unranked` : 'Live elo'} />
      <div className="grid grid-cols-1 gap-px bg-line xl:grid-cols-2">
        {ladders.map((ladder) => (
          <LadderCard key={ladder.format} ladder={ladder} />
        ))}
      </div>
    </section>
  )
}
