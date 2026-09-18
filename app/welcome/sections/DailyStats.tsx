import { twMerge } from "tailwind-merge";
import { CardArt } from "@omega/card-art";
import { formatNumber } from "@omega/profile/labels";
import { RailHead } from "@ui/rail-head";
import type { TopDeck } from "@utils/welcome";
import { ArrowLink, RailFooter } from "./rails";

type DailyStatsProps = {
  decks: TopDeck[]
  stamp: string
  sampleNote?: string
}

export const DailyStats = ({ decks, stamp, sampleNote }: DailyStatsProps) => {
  const topShare = decks[0]?.share ?? 1

  return (
    <section id="stats" className="border-b border-line-strong">
      <RailHead num="01" label="Last 24 hours" stamp={stamp} />
      <RailHead emphasis label="Most used decks" stamp={sampleNote} className="py-3.5 signal" />

      <div className="grid grid-cols-1 gap-px bg-line lg:grid-cols-3">
        {decks.map((deck, i) => (
          <CardArt
            key={deck.name}
            art={deck.art}
            alt=""
            sizes="(min-width: 1024px) 33vw, 100vw"
            className="flex min-h-47.5 flex-col"
            imageClassName="object-[center_30%] duotone"
          >
            <div aria-hidden className="absolute inset-0 bg-linear-to-b from-veil-top to-veil-base" />
            <div className="relative flex flex-1 flex-col p-6">
              <div className="flex items-center gap-3">
                <span className={twMerge("inline-flex min-w-7.5 items-center justify-center px-2 py-1.25 signal-chip", i ? "bg-ink text-ink-on" : "bg-gold text-gold-on")}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="text-ink-muted signal">{deck.format}</span>
              </div>
              <h3 className="mt-auto pt-5.5 text-ink display-4">{deck.name}</h3>
              <div className="mt-3 flex items-center gap-3 mono-data">
                <span className="font-bold text-gold">{deck.share.toFixed(1)}%</span>
                <span aria-hidden className="h-3 w-px bg-line" />
                <span className="text-ink-dim">{formatNumber(deck.duels)} duels</span>
              </div>
              <div aria-hidden className="mt-3.5 h-1 bg-surface-400">
                <span className={twMerge("block h-full", i ? "bg-ink-dim" : "bg-gold")} style={{ width: `${(deck.share / topShare) * 100}%` }} />
              </div>
            </div>
          </CardArt>
        ))}
      </div>

      <RailFooter>
        <ArrowLink href="/statistics">See all statistics</ArrowLink>
      </RailFooter>
    </section>
  )
}
