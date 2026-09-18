import Image from "next/image";
import { twMerge } from "tailwind-merge";
import { MICRO_LABEL } from "@omega/profile/accent";
import { formatNumber } from "@omega/profile/labels";
import { LocalTime } from "@omega/profile/local-time";
import { change } from "@utils/welcome";
import type { WelcomeData } from "@utils/types";

type KpiProps = {
  label: string
  value: number
  previous: number
  note: string
  big?: boolean
  valueClassName?: string
}

const Kpi = ({ label, value, previous, note, big, valueClassName }: KpiProps) => {
  const delta = change(value, previous)

  return (
    <div className={twMerge("bg-surface-000", big ? "px-6.5 py-5 md:col-span-3" : "px-5 py-4.5")}>
      <p className={MICRO_LABEL}>{label}</p>
      <p className={twMerge("text-ink", big ? "mt-2.5 display-1" : "mt-2 display-3", valueClassName)}>
        {formatNumber(value)}
      </p>
      {delta ? (
        <div className="mt-2 flex items-center gap-2 font-mono text-[10px] tracking-[.1em] uppercase">
          <span className={twMerge("font-bold", delta.up ? "text-cyan" : "text-gold")}>
            {delta.label}
          </span>
          <span className="text-ink-muted">{note}</span>
        </div>
      ) : null}
    </div>
  )
}

const Kpis = ({ welcome }: { welcome: WelcomeData | null }) => {
  if (!welcome) {
    return (
      <div className="bg-surface-000 px-6.5 py-5 md:col-span-3">
        <p className={MICRO_LABEL}>Last 24 hours</p>
        <p className="mt-2 text-ink-dim display-6">Stats unavailable</p>
        <p className="mt-2 text-ink-dim body-sm">The stats service did not answer. Refresh in a minute.</p>
      </div>
    )
  }

  const { players, games: { last24h: now, previous24h: before } } = welcome
  const total = now.tcg + now.genesys + now.casual
  const totalBefore = before.tcg + before.genesys + before.casual

  return (
    <>
      <Kpi big label="Duelists active" value={players.last24h} previous={players.previous24h} note="vs previous 24 h" valueClassName="text-gold" />
      <Kpi label="TCG duels" value={now.tcg} previous={before.tcg} note="24 h" />
      <Kpi label="Genesys duels" value={now.genesys} previous={before.genesys} note="24 h" />
      <Kpi label="Casual duels" value={now.casual} previous={before.casual} note="24 h" />
      <Kpi big label="Total duels" value={total} previous={totalBefore} note="vs previous 24 h" valueClassName="text-cyan" />
    </>
  )
}

type WelcomeHeroProps = {
  name: string
  line: string
  nowIso: string
  welcome: WelcomeData | null
  cover: string
}

/** Duotone cover behind the greeting and the stats. */
export const WelcomeHero = ({ name, line, nowIso, welcome, cover }: WelcomeHeroProps) => (
  <section className="relative isolate flex flex-wrap items-end justify-between gap-7 overflow-hidden border-b border-line-strong px-5.5 py-9 lg:px-11 lg:py-11">
    <Image src={cover} alt="" fill priority sizes="100vw" className="-z-10 object-cover object-[center_40%] duotone" />
    <span aria-hidden className="-z-10 duotone-wash bg-indigo" />
    <span aria-hidden className="absolute inset-0 -z-10 bg-linear-to-t from-surface-000 via-veil-base to-veil-top md:bg-linear-to-r" />

    <div className="min-w-0">
      <p className="text-ink-muted signal-lg">
        <LocalTime iso={nowIso} options={{ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }} />
      </p>
      <h1 className="mt-3.5 break-words text-ink display-1">
        Welcome back,<br />
        <span className="text-gold">{name}</span>
      </h1>
      <p className="mt-4 max-w-[46ch] text-ink-dim lead">{line}</p>
    </div>

    <div className="grid w-full min-w-0 grid-cols-1 gap-px border border-line bg-line md:grid-cols-3 xl:w-auto xl:flex-[0_1_580px]">
      <Kpis welcome={welcome} />
    </div>
  </section>
)
