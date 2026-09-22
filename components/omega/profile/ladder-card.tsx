import Image from "next/image";
import { twMerge } from "tailwind-merge";
import { CardArt } from "@omega/card-art";
import { TIER_FLOORS } from "@utils/ranked";
import type { Ladder, LadderRecord, LadderSeason, LadderStats, Tier } from "@utils/types";
import { badgeSrc } from "@omega/ranked/tier-badge";
import { MICRO_LABEL, RESULT } from "./accent";
import { formatNumber } from "./labels";
import { EmptyBox } from "./empty-box";

/** How many of the latest duels the form streak shows. */
const FORM_LENGTH = 5

const tierNote = (floor: number | null, elo?: number) => {
  if (floor === null) return 'Under 50 Elo'
  const need = elo === undefined ? 0 : floor - elo
  return need > 0 ? `${formatNumber(floor)} Elo · ${formatNumber(need)} to go` : `${formatNumber(floor)} Elo`
}

/** Every tier across the full width, the reached one ringed in gold. Hover or focus shows the Elo it takes. */
const TierLadder = ({ current, elo }: { current?: Tier; elo?: number }) => (
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
            isCurrent && "border-2 border-gold",
          )}
        >
          <Image src={badgeSrc(tier)} alt={tier} fill sizes="(min-width: 1120px) 130px, 12vw" className="object-contain p-[8%]" />
          <span
            className={twMerge(
              "pointer-events-none invisible absolute bottom-[calc(100%+8px)] z-(--z-dropdown) border border-line-strong bg-surface-100 px-2.5 py-1.5 whitespace-nowrap text-ink signal-sm group-hover:visible group-focus-visible:visible",
              i === 0 ? "left-0" : i === TIER_FLOORS.length - 1 ? "right-0" : "left-1/2 -translate-x-1/2",
            )}
          >
            <span className="text-gold">{tier}</span> · {tierNote(floor, elo)}
          </span>
        </li>
      )
    })}
  </ul>
)

const StatGrid = ({ stats }: { stats: LadderRecord & { elo: number } }) => {
  const played = stats.wins + stats.loses + stats.draws
  const items = [
    { label: 'Elo', value: formatNumber(stats.elo), tone: 'text-gold' },
    { label: 'Win rate', value: played ? `${Math.round((stats.wins / played) * 100)}%` : '—', tone: 'text-cyan' },
    { label: 'Matches', value: formatNumber(played) },
    { label: 'Wins', value: formatNumber(stats.wins) },
    { label: 'Losses', value: formatNumber(stats.loses) },
    { label: 'Draws', value: formatNumber(stats.draws) },
  ]

  return (
    <dl className="grid grid-cols-3 gap-px bg-line">
      {items.map(({ label, value, tone }) => (
        <div key={label} className="min-w-0 bg-surface-000 px-4 py-3.5">
          <dt className="text-ink-muted signal-sm">{label}</dt>
          <dd className={twMerge("mt-1.75 text-ink display-5", tone)}>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** One square per recent duel, oldest first. */
const FormStreak = ({ recent }: { recent: string }) => {
  const results = [...recent.slice(-FORM_LENGTH)]
  const count = (r: string) => results.filter((x) => x === r).length

  return (
    <div className="mt-5">
      <div className="flex items-baseline gap-3">
        <p className={MICRO_LABEL}>Last {results.length} duels</p>
        <p className="text-ink-dim mono-data">{count('W')}W · {count('L')}L · {count('D')}D</p>
      </div>
      <ul className="mt-2 flex gap-[clamp(6px,1vw,10px)]">
        {results.map((r, i) => {
          const result = RESULT[r === 'W' ? 'win' : r === 'L' ? 'loss' : 'draw']
          return (
            <li
              key={i}
              title={result.label}
              className={twMerge("inline-flex size-[clamp(32px,3.6vw,44px)] items-center justify-center text-surface-000 signal-count", result.fill)}
            >
              {r}
            </li>
          )
        })}
      </ul>
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
  /** `W`/`L`/`D` per duel, oldest first. Falls back to the ladder's own `recent`. */
  recent?: string
}

/** One format's standing: the tier ladder, then tier, stats and recent form; or an empty state if never played. */
export const LadderCard = ({ ladder, recent }: LadderCardProps) => {
  if (!ladder.played) {
    return (
      <div className="mt-4.5">
        <TierLadder />
        <EmptyBox title="No ranked duels yet" note="Unranked · 0 matches" className="mt-3.5">
          Play one ranked {ladder.format} match to earn a tier, an Elo and a record. Nothing is placed until the first duel is finished.
        </EmptyBox>
      </div>
    )
  }

  const form = ladder.recent || recent

  return (
    <div className="mt-4.5">
      <TierLadder current={ladder.tier} elo={ladder.elo} />

      <div className="mt-6 flex flex-wrap items-start gap-[clamp(16px,3vw,36px)]">
        <div className="min-w-0 flex-[1_1_260px]">
          <div className="flex items-center gap-3.5">
            <div className="relative size-[clamp(76px,9vw,104px)] shrink-0 border border-line-strong bg-surface-100">
              <Image src={badgeSrc(ladder.tier)} alt="" fill sizes="104px" className="object-contain p-1.5" />
            </div>
            <div className="min-w-0">
              <p className={MICRO_LABEL}>Tier</p>
              <p className="mt-0.5 text-ink display-5">{ladder.tier}</p>
              <p className="mt-0.5 text-gold mono-data">{formatNumber(ladder.elo)} Elo</p>
            </div>
          </div>
          {form ? <FormStreak recent={form} /> : null}
        </div>

        <div className="min-w-0 flex-[1_1_300px]">
          <StatGrid stats={openSeason(ladder) ?? { elo: ladder.elo, ...ladder.allTime }} />
          <TopDeck stats={ladder} />
        </div>
      </div>
    </div>
  )
}
