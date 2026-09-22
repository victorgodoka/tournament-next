import Image from "next/image";
import { twMerge } from "tailwind-merge";
import { useTranslations } from "next-intl";
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
  // const t = useTranslations('Welcome.welcomeHero');
  const delta = change(value, previous)

  return (
    <div className={twMerge("bg-surface-000", big ? "px-6.5 py-5 md:col-span-3" : "px-5 py-4.5")}>
      <p className={MICRO_LABEL}>{label}</p>
      <p className={twMerge("text-ink", big ? "mt-2.5 display-1" : "mt-2 display-3", valueClassName)}>
        {formatNumber(value)}
      </p>
      {delta ? (
        <div className="mt-2 flex items-center gap-2 signal">
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
  const t = useTranslations('Welcome.welcomeHero');

  if (!welcome) {
    return (
      <div className="bg-surface-000 px-6.5 py-5 md:col-span-3">
        <p className={MICRO_LABEL}>{t('last24hours')}</p>
        <p className="mt-2 text-ink-dim display-6">{t('statsUnavailable')}</p>
        <p className="mt-2 text-ink-dim body-sm">{t('statsServiceDown')}</p>
      </div>
    )
  }

  const { players, games: { last24h: now, previous24h: before } } = welcome
  // const total = now.tcg + now.genesys + now.casual
  // const totalBefore = before.tcg + before.genesys + before.casual

  return (
    <>
      <Kpi big label={t('duelistsActive')} value={players.last24h} previous={players.previous24h} note={t('vsPrevious24h')} valueClassName="text-gold" />
      <Kpi label={t('tcgDuels')} value={now.tcg} previous={before.tcg} note={t('h24')} />
      <Kpi label={t('genesysDuels')} value={now.genesys} previous={before.genesys} note={t('h24')} />
      {/* <Kpi label={t('casualDuels')} value={now.casual} previous={before.casual} note={t('h24')} /> */}
      {/* <Kpi big label={t('totalDuels')} value={total} previous={totalBefore} note={t('vsPrevious24h')} valueClassName="text-cyan" /> */}
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
export const WelcomeHero = ({ name, line, nowIso, welcome, cover }: WelcomeHeroProps) => {
  const t = useTranslations('Welcome.welcomeHero');

  return (
    <section className="relative isolate flex flex-wrap items-end justify-between gap-7 overflow-hidden border-b border-line-strong px-5.5 py-9 lg:px-11 lg:py-11">
      {/* `unoptimized`: Cloudinary sizes the cover itself, and the local fallback is one hot static file. */}
      <Image src={cover} alt="" fill priority unoptimized sizes="100vw" className="-z-10 object-cover object-[center_40%] duotone" />
      <span aria-hidden className="-z-10 duotone-wash bg-indigo" />
      <span aria-hidden className="absolute inset-0 -z-10 bg-linear-to-t from-surface-000 via-veil-base to-veil-top md:bg-linear-to-r" />

      <div className="min-w-0">
        <p className="text-ink-muted signal-lg">
          <LocalTime iso={nowIso} options={{ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }} />
        </p>
        <h1 className="mt-3.5 break-words text-ink display-1">
          {t('welcomeBack')}<br />
          <span className="text-gold">{name}</span>
        </h1>
        <p className="mt-4 max-w-[46ch] text-ink-dim lead">{line}</p>
      </div>

      <div className="grid w-full min-w-0 grid-cols-1 gap-px border border-line bg-line md:grid-cols-2 xl:w-auto">
        <Kpis welcome={welcome} />
      </div>
    </section>
  )
}
