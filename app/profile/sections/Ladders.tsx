'use client'

import { useId, useState } from "react";
import Link from "next/link";
import { twMerge } from "tailwind-merge";
import { Chip } from "@ui/chip";
import { Icon } from "@ui/icon";
import { LineChart, WinRateRing } from "@ui/chart";
import { Select } from "@ui/field";
import { Panel } from "@ui/panel";
import { StatGrid } from "@ui/stat-grid";
import { TierBadge } from "@ui/tier-badge";
import { LocalTime } from "@omega/profile/local-time";
import { formatNumber } from "@omega/profile/labels";
import type { CurrentSeason, Ladder, LadderSeason, LadderStats } from "@utils/types";

const DAY_MONTH: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
const MONTH: Intl.DateTimeFormatOptions = { month: 'short' }
const CAPTION = "font-mono text-[10px] leading-3 tracking-[0.16em] uppercase text-ink-muted"

/** The season the card opens on: the API always sends the open one first. */
const openSeason = (ladder: LadderStats): LadderSeason | undefined => ladder.seasons.find((season) => season.open)

const record = ({ wins, loses, draws }: { wins: number; loses: number; draws: number }) => `${wins}–${loses}–${draws}`

// ponytail: fixed locale and UTC so server and client agree on chart labels.
const dayLabel = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })

const optionLabel = (season: LadderSeason) =>
  season.open
    ? `${season.label} · open`
    : `${season.label} · ${new Date(season.startsAt).toLocaleDateString('en-GB', { ...MONTH, timeZone: 'UTC' })} – ${new Date(season.endsAt ?? season.startsAt).toLocaleDateString('en-GB', { ...MONTH, timeZone: 'UTC' })}`

const ACCENT = { TCG: { chip: 'tcg', line: 'ladder-tcg' }, Genesys: { chip: 'genesys', line: 'ladder-genesys' } } as const

/** Open by default; the heading is the toggle for the body with `id`. */
const useCollapse = () => {
  const id = useId()
  const [open, setOpen] = useState(true)
  const toggle = (format: string) => (
    <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)} className="inline-flex cursor-pointer items-center gap-2 uppercase hover:text-cyan">
      {format} ladder
      <Icon name="down" className={twMerge("motion-safe:transition-transform", !open && "-rotate-90")} />
    </button>
  )
  return { id, open, toggle }
}

const PlayedLadder = ({ ladder, name }: { ladder: Extract<Ladder, { played: true }>; name: string }) => {
  const open = openSeason(ladder)
  const [code, setCode] = useState(open?.code ?? ladder.seasons[0]?.code)
  const season = ladder.seasons.find((s) => s.code === code) ?? open
  const previous = ladder.seasons.find((s) => !s.open)
  const collapse = useCollapse()
  const duels = season ? season.wins + season.loses + season.draws : 0

  // Today's live value is the season's `elo`, not the last sync point.
  const history = season?.open ? season.eloHistory ?? [] : []
  const points = history.map((p) => ({ label: dayLabel(p.day), elo: p.elo }))
  if (season?.open && points.length && points.at(-1)?.elo !== season.elo) points.push({ label: 'Now', elo: season.elo })

  return (
    <Panel label={`${ladder.format} ladder`} className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Chip tone={ACCENT[ladder.format].chip}>{ladder.format}</Chip>
        <h3 className="font-display text-[22px] leading-[1.1] tracking-[0.01em] uppercase">{collapse.toggle(ladder.format)}</h3>
        <div className="ml-auto">
          <Select
            aria-label="Season"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            options={ladder.seasons.map((s) => ({ value: s.code, label: optionLabel(s) }))}
          />
        </div>
      </div>

      <div id={collapse.id} hidden={!collapse.open} className="flex flex-col gap-6">
      {season ? (
        <div className="grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_200px]">
          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex items-end gap-4">
              <span className="font-display text-[72px] leading-[0.9] text-ink tabular-nums">{formatNumber(season.elo)}</span>
              <div className="flex flex-col gap-2 pb-1">
                <TierBadge tier={season.tier} size="lg" />
                <span className={CAPTION}>{season.open ? 'Elo · live' : 'Final Elo'}</span>
              </div>
            </div>
            <StatGrid
              columns={3}
              items={[
                { label: 'Season rank', value: season.rank != null ? `#${formatNumber(season.rank)}` : '—', hint: season.open ? 'From last sync' : 'Final position' },
                { label: 'Season record', value: record(season), hint: `${formatNumber(duels)} duels` },
                { label: 'All-time', value: record(ladder.allTime), hint: `Lifetime ${ladder.format}` },
              ]}
            />
          </div>
          <div className="flex flex-col items-center gap-2.5">
            <WinRateRing wins={season.wins} losses={season.loses} draws={season.draws} size={132} />
            <span className={CAPTION}>{season.label} win rate</span>
          </div>
        </div>
      ) : null}

      {season?.open && points.length > 1 ? (
        <LineChart
          title="Elo this season"
          subtitle={`Daily sync · ${season.label}, day ${history.at(-1)?.seasonDay ?? 1}`}
          labels={points.map((p) => p.label)}
          series={[{ name, data: points.map((p) => p.elo), color: ACCENT[ladder.format].line }]}
          format={formatNumber}
          height={200}
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 font-mono text-[10px] leading-3 tracking-[0.14em] text-ink-muted uppercase">
        <span>
          {open ? <>{open.label} opened <LocalTime iso={open.startsAt} options={DAY_MONTH} /></> : null}
          {previous?.endsAt ? (
            <> · {previous.label} ended <LocalTime iso={previous.endsAt} options={DAY_MONTH} />{previous.rank != null ? ` at #${formatNumber(previous.rank)}` : ''}, {previous.tier}</>
          ) : null}
        </span>
        <Link href="/leaderboard" className="text-[11px] leading-3.5 font-bold text-cyan underline underline-offset-3 hover:decoration-2">
          See full standings
        </Link>
      </div>
      </div>
    </Panel>
  )
}

const UnplayedLadder = ({ format, season }: { format: Ladder['format']; season?: CurrentSeason }) => {
  const collapse = useCollapse()
  return (
  <Panel tone="sunken" label={`${format} ladder`} className="flex items-center gap-4 px-6 py-5 min-[720px]:px-6 min-[720px]:py-5">
    <Chip tone={ACCENT[format].chip}>{format}</Chip>
    <div className="flex grow flex-col gap-1">
      <h3 className="font-display text-[22px] leading-[1.1] uppercase">{collapse.toggle(format)}</h3>
      <p id={collapse.id} hidden={!collapse.open} className="text-sm leading-5 text-ink-dim">
        No ranked {format} duels yet.
        {season ? <> {season.label} has been open since <LocalTime iso={season.startsAt} options={DAY_MONTH} />.</> : null}
      </p>
    </div>
    <span aria-hidden className="font-display text-[40px] leading-none text-line-mid">—</span>
  </Panel>
  )
}

/** One panel per ranked ladder, TCG then Genesys; an unplayed one collapses to a sunken strip. */
export const Ladders = ({ ladders, currentSeasons, name }: { ladders: Ladder[]; currentSeasons: CurrentSeason[]; name: string }) =>
  ladders.map((ladder) =>
    ladder.played ? (
      <PlayedLadder key={ladder.format} ladder={ladder} name={name} />
    ) : (
      <UnplayedLadder key={ladder.format} format={ladder.format} season={currentSeasons.find((s) => s.format === ladder.format)} />
    ),
  )
