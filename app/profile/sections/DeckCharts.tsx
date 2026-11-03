'use client'

import { useEffect, useState } from "react";
import { BarList } from "@ui/chart";
import { Chip } from "@ui/chip";
import { Panel } from "@ui/panel";
import { getDeckStats } from "@utils/profile";
import type { DeckStats } from "@utils/types";
import { Rail } from "./rail";

/** Win rate only means something from here on. */
const MIN_MATCHES = 10

const COLOR = { TCG: 'ladder-tcg', Genesys: 'ladder-genesys' } as const

/**
 * "Decks this season": the duelist's most played decks per ladder and their win rate, from
 * `GET /profiles/{id}/decks`. Loaded after the page (it is the slow analytics read) and gone if
 * there is nothing to draw.
 */
export const DeckCharts = ({ profileId, num, asVisitor }: { profileId: string; num: string; asVisitor?: boolean }) => {
  const [stats, setStats] = useState<DeckStats | null>(null)

  useEffect(() => {
    let live = true
    getDeckStats(profileId, asVisitor)
      .then((got) => live && setStats(got))
      .catch((error) => console.error(error))
    return () => {
      live = false
    }
  }, [profileId, asVisitor])

  const ladders = stats?.ladders.filter((ladder) => ladder.decks.length) ?? []
  if (!ladders.length) return null

  return (
    <>
      <Rail num={num} label="Decks this season" stamp="TCG + Genesys" />
      <Panel label="Deck charts" className="flex flex-col gap-6">
        {ladders.map((ladder) => {
          const rated = ladder.decks.filter((deck) => deck.matches >= MIN_MATCHES)
          return (
            <section key={ladder.format} aria-label={`${ladder.format} decks`} className="flex flex-col gap-5 not-first:border-t not-first:border-line not-first:pt-6">
              <Chip tone={ladder.format === 'TCG' ? 'tcg' : 'genesys'} className="self-start">{ladder.format}</Chip>
              <BarList
                title="Most played"
                subtitle={`Matches, ${ladder.season?.label ?? 'this season'}`}
                items={ladder.decks.map((deck) => ({ label: deck.name ?? 'Unknown deck', value: deck.matches }))}
                color={COLOR[ladder.format]}
              />
              {rated.length ? (
                <BarList
                  title="Win rate by deck"
                  subtitle={`Decks with ${MIN_MATCHES}+ matches`}
                  items={rated.map((deck) => ({ label: deck.name ?? 'Unknown deck', value: Math.round((deck.wins / deck.matches) * 1000) / 10 }))}
                  max={100}
                  color={COLOR[ladder.format]}
                  format={(v) => `${v.toFixed(1)}%`}
                />
              ) : null}
            </section>
          )
        })}
      </Panel>
    </>
  )
}
