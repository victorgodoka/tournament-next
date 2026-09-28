import { twMerge } from "tailwind-merge";
import { CardArt } from "@omega/card-art";
import { TIER_FLOORS } from "@utils/ranked";
import type { Ladder, LadderRecord, LadderSeason, LadderStats, Tier } from "@utils/types";
import { MICRO_LABEL } from "./accent";
import { FormGuide, type Result } from "@ui/result";
import { StatGrid } from "@ui/stat-grid";
import { formatNumber } from "./labels";
import { EmptyBox } from "./empty-box";
import { TierBadge } from "@omega/ranked";
import { EloChart } from "./elo-chart";

/** How many of the latest duels the form streak shows. */
const FORM_LENGTH = 5

const tierNote = (floor: number | null, elo?: number) => {
  if (floor === null) return 'Under 50 Elo'
  const need = elo === undefined ? 0 : floor - elo
  return need > 0 ? `${formatNumber(floor)} Elo · ${formatNumber(need)} to go` : `${formatNumber(floor)} Elo`
}

/** Every tier across the full width, the reached one ringed in gold. Hover or focus shows the Elo it takes. */
const TierLadder = ({ current, elo, season }: { current?: Tier; elo?: number; season?: string }) => (
  <ul className="grid grid-cols-8 gap-[clamp(4px,1vw,10px)]">
    {TIER_FLOORS.map(([tier, floor], i) => {
      const isCurrent = tier === current
      return (
        <li
          key={tier}
          tabIndex={0}
          aria-current={isCurrent || undefined}
          className={twMerge(
            "group relative aspect-square border border-line bg-surface-100 outline-offset-2 hover:opacity-100 focus-visible:opacity-100",
            !isCurrent && "opacity-35",
            isCurrent && "border-2 border-cyan",
          )}
        >
          <TierBadge tier={tier} season={season} alt={tier} sizes="(min-width: 1120px) 130px, 12vw" className="size-full border-0 bg-transparent" />
          <span
            className={twMerge(
              "pointer-events-none invisible absolute bottom-[calc(100%+8px)] z-(--z-dropdown) border border-line-strong bg-surface-100 px-2.5 py-1.5 whitespace-nowrap text-ink signal-sm group-hover:visible group-focus-visible:visible",
              i === 0 ? "left-0" : i === TIER_FLOORS.length - 1 ? "right-0" : "left-1/2 -translate-x-1/2",
            )}
          >
            <span className="text-cyan">{tier}</span> · {tierNote(floor, elo)}
          </span>
        </li>
      )
    })}
  </ul>
)

const LadderStatGrid = ({ stats }: { stats: LadderRecord & { elo: number } }) => {
  const played = stats.wins + stats.loses + stats.draws
  return (
    <StatGrid
      columns={3}
      items={[
        { label: 'Elo', value: formatNumber(stats.elo), tone: 'cyan' },
        { label: 'Win rate', value: played ? `${Math.round((stats.wins / played) * 100)}%` : '—' },
        { label: 'Matches', value: formatNumber(played) },
        { label: 'Wins', value: formatNumber(stats.wins) },
        { label: 'Losses', value: formatNumber(stats.loses) },
        { label: 'Draws', value: formatNumber(stats.draws) },
      ]}
    />
  )
}

/** The latest duels as a FormGuide, oldest first. */
const FormStreak = ({ recent }: { recent: string }) => {
  const results = [...recent.slice(-FORM_LENGTH)].filter((r): r is Result => r === 'W' || r === 'L' || r === 'D')
  const count = (r: Result) => results.filter((x) => x === r).length

  return (
    <div className="mt-5">
      <div className="flex items-baseline gap-3">
        <p className={MICRO_LABEL}>Last {results.length} duels</p>
        <p className="text-ink-dim mono-data">{count('W')}W · {count('L')}L · {count('D')}D</p>
      </div>
      <div className="mt-2">
        <FormGuide results={results} />
      </div>
    </div>
  )
}

const TopDeck = ({ stats }: { stats: LadderStats }) => {
  if (!stats.topDeck) return null
  const played = stats.allTime.wins + stats.allTime.loses + stats.allTime.draws

  return (
    <div className="mt-4 flex items-center gap-3 border border-line p-2.5">
      <CardArt art={stats.topDeck.art} sizes="48px" className="size-12 shrink-0" alt="" />
      <div className="min-w-0">
        <p className={MICRO_LABEL}>Most used deck</p>
        <p className="mt-0.5 truncate text-ink body-strong">{stats.topDeck.name}</p>
        {stats.topDeckMeta?.duels ? (
          <p className="text-ink-muted mono-data">
            {formatNumber(stats.topDeckMeta.duels)} of {formatNumber(played)} matches
          </p>
        ) : null}
      </div>
    </div>
  )
}

/** The season the card opens on. The API always sends one, but a missing one reads as lifetime. */
export const openSeason = (ladder: LadderStats): LadderSeason | undefined => ladder.seasons.find((season) => season.open)

type LadderCardProps = {
  ladder: Ladder
  /** Season code for the badge art. */
  season?: string
  /** `W`/`L`/`D` per duel, oldest first. Falls back to the ladder's own `recent`. */
  recent?: string
}

/** One format's standing: the tier ladder, then tier, stats and recent form; or an empty state if never played. */
export const LadderCard = ({ ladder, season, recent }: LadderCardProps) => {
  if (!ladder.played) {
    return (
      <div className="mt-4.5">
        <TierLadder season={season} />
        <EmptyBox title="No ranked duels yet" note="Unranked · 0 matches" className="mt-3.5">
          Play one ranked {ladder.format} match to earn a tier, an Elo and a record. Nothing is placed until the first duel is finished.
        </EmptyBox>
      </div>
    )
  }

  const form = ladder.recent || recent
  const open = openSeason(ladder)

  return (
    <div className="mt-4.5">
      <TierLadder season={season} current={ladder.tier} elo={ladder.elo} />
      {open?.eloHistory ? <EloChart history={open.eloHistory} live={open.elo} season={open.label} /> : null}

      <div className="mt-6 flex flex-wrap items-start gap-[clamp(16px,3vw,36px)]">
        <div className="min-w-0 flex-[1_1_260px]">
          <div className="flex items-center gap-3.5">
            <TierBadge tier={ladder.tier} season={season} sizes="104px" className="size-[clamp(76px,9vw,104px)] border-line-strong" />
            <div className="min-w-0">
              <p className={MICRO_LABEL}>Tier</p>
              <p className="mt-0.5 text-ink display-5">{ladder.tier}</p>
              <p className="mt-0.5 text-cyan mono-data">{formatNumber(ladder.elo)} Elo</p>
            </div>
          </div>
          {form ? <FormStreak recent={form} /> : null}
        </div>

        <div className="min-w-0 flex-[1_1_300px]">
          <LadderStatGrid stats={openSeason(ladder) ?? { elo: ladder.elo, ...ladder.allTime }} />
          <TopDeck stats={ladder} />
        </div>
      </div>
    </div>
  )
}
