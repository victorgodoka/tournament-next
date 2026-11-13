import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Footer } from "@ui/footer";
import { Header } from "@ui/header";
import { AvatarFrame } from "@ui/avatar";
import { EmptyBox } from "@omega/profile/empty-box";
import { PrivateNotice } from "@omega/profile/private-notice";
import { AdBanner } from "@omega/ads/ad-banner";
import { getMeta, getPlayerStatistics, type PlayerPeriod } from "@utils/statistics";
import { facesOf } from "@app/statistics/format";
import type { Profile, RankedLadderId, Tier } from "@utils/types";
import { MySections } from "./MySections";
import { PlayerFilters } from "./PlayerFilters";
import { standingOf } from "./insights";

export type SeasonChoice = { code: string; label: string; format: 'TCG' | 'Genesys'; open: boolean; startsAt?: string }

/** Every season the duelist has a record in, played ladders first; an unplayed ladder offers its open season. */
export const seasonChoices = (profile: Extract<Profile, { isPrivate: false }>): SeasonChoice[] => {
  const played = profile.ladders.flatMap((ladder) =>
    ladder.played ? ladder.seasons.map(({ code, label, open, startsAt }) => ({ code, label, open, startsAt, format: ladder.format })) : [],
  )
  const unplayed = profile.currentSeasons
    .filter(({ format }) => !played.some((choice) => choice.format === format))
    .map(({ code, label, format, startsAt }) => ({ code, label, format, open: true, startsAt }))
  return [...played, ...unplayed]
}

/** One season (or a ladder's newest) and a period, all in the URL. */
export type StatisticsSelection = { season?: string; ladder: RankedLadderId; period: PlayerPeriod }

const LADDER: Record<RankedLadderId, 'TCG' | 'Genesys'> = { tcg: 'TCG', genesys: 'Genesys' }
const TIER_COLOR: Record<Tier, string> = {
  Iron: 'var(--color-tier-iron)', Bronze: 'var(--color-tier-bronze)', Silver: 'var(--color-tier-silver)', Gold: 'var(--color-tier-gold)',
  Platinum: 'var(--color-tier-platinum)', Diamond: 'var(--color-tier-diamond)', Master: 'var(--color-tier-master)', Omega: 'var(--color-tier-omega)',
}
/** The rating with a space for thousands: 1 842. */
const elo = (v: number) => String(v).replace(/(\d)(\d{3})$/, '$1 $2')
const WIDE = 'max-[719px]:hidden'
const NARROW = 'min-[720px]:hidden'

const Lock = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="var(--color-ink-muted)" aria-hidden><path d="M12 2a5 5 0 0 0-5 5v3H5v12h14V10h-2V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 0 1 6 0v3z" /></svg>
)

const TierChip = ({ tier, small }: { tier: Tier; small?: boolean }) => (
  <span
    style={{ '--edge': TIER_COLOR[tier], color: TIER_COLOR[tier] } as React.CSSProperties}
    className="cut inline-flex h-7 items-center gap-2 px-3 font-mono text-[11px] font-bold tracking-[0.14em] uppercase [--cut:var(--cut-xs)] [--fill:var(--color-surface-100)]"
  >
    <span aria-hidden className={small ? 'size-1.75 rotate-45' : 'size-2 rotate-45'} style={{ background: TIER_COLOR[tier] }} />
    {tier}
  </span>
)

const Avatar = ({ profile, size, name }: { profile: Profile; size: 96 | 64; name: string }) =>
  profile.avatar ? (
    <span className="relative flex-none border-3 border-space-000 bg-surface-100" style={{ width: size, height: size }}>
      <Image src={profile.avatar} alt="" fill sizes={`${size}px`} className="object-cover" />
      <AvatarFrame cosmetics={profile.cosmetics} />
    </span>
  ) : (
    <span aria-hidden style={{ width: size, height: size }} className={`inline-flex flex-none items-center justify-center bg-azure font-display text-ink ${size === 96 ? 'text-5xl' : 'text-[32px]'}`}>
      {name.charAt(0).toUpperCase()}
    </span>
  )

type PlayerStatisticsProps = {
  profile: Profile
  choices: SeasonChoice[]
  selection: StatisticsSelection
  cookie: string | null
}

/** /profile/[id]/statistics: My statistics, owner only, the duelist against an average pilot in the same games. */
export const PlayerStatistics = async ({ profile, choices, selection, cookie }: PlayerStatisticsProps) => {
  const t = await getTranslations('PlayerStatistics')
  const tm = await getTranslations('PlayerStatistics.my')
  const name = profile.displayName ?? profile.handle ?? t('unknown')
  const base = `/profile/${profile.id}/statistics`
  // Owner-only, even on a public profile: only the self profile carries `visibility`. The API checks too.
  const visible = !profile.isPrivate && profile.visibility !== undefined ? profile : null
  const format = LADDER[selection.ladder]
  // The meta knows every deck's card: a mixed deck's second archetype often never shows up alone in the duelist's games.
  const [result, meta] = visible && choices.length
    ? await Promise.all([getPlayerStatistics(profile.id, selection, cookie), getMeta({ ladder: selection.ladder, season: selection.season, window: 'season', band: 'all' })])
    : [null, null]
  const metaFaces = meta?.ok ? facesOf(meta.data.decks) : {}
  const data = result?.ok ? result.data : null
  const pick = data?.season ? { ladder: data.season.ladder, season: data.season.code } : selection
  const standing = visible ? standingOf(visible, pick) : null
  const opponents = data?.opponentRating ?? null

  return (
    <>
      <Header />
      <main id="top" data-clear-gutters className="flex min-h-dvh flex-col overflow-x-hidden pt-16">
        <div className="mx-auto flex w-full max-w-page flex-col gap-7 px-gutter pt-8 pb-24 max-[719px]:gap-5 max-[719px]:pt-5 max-[719px]:pb-16">
          <nav aria-label={tm('breadcrumb')} className={`flex items-center gap-2.5 ${WIDE}`}>
            <Link href={`/profile/${profile.id}`} className="text-cyan signal-strong hover:text-ink">{name}</Link>
            <span aria-hidden className="text-ink-muted signal">/</span>
            <span aria-current="page" className="text-ink signal-strong">{tm('statistics')}</span>
          </nav>

          {/* Desktop head: avatar, private note, name and tier, lede, rating tiles */}
          <section className={`cut notch flex flex-wrap items-center gap-x-8 gap-y-6 p-7 [--cut:var(--cut-lg)] [--edge:var(--color-line-mid)] [--fill:var(--color-surface-100)] ${WIDE}`}>
            <Avatar profile={profile} size={96} name={name} />
            <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-2.5">
              <div className="flex items-center gap-2"><Lock size={14} /><span className="text-ink-muted signal">{tm('head.private')}</span></div>
              <div className="flex flex-wrap items-center gap-4">
                <h1 className="m-0 title text-[36px] text-ink">{name}</h1>
                {standing ? <TierChip tier={standing.tier} /> : null}
              </div>
              <p className="m-0 max-w-170 text-lg leading-7 text-ink-dim">{tm('head.lede')}</p>
            </div>
            {standing ? (
              <div className="grid grid-cols-[repeat(2,minmax(120px,auto))] gap-px border border-line bg-line">
                <div className="flex flex-col gap-1.5 bg-surface-200 px-4.5 py-3.5">
                  <span className={`signal-sm ${format === 'TCG' ? 'text-ladder-tcg' : 'text-ladder-genesys'}`}>{tm('head.rating', { ladder: format })}</span>
                  <span className="font-display text-[28px] leading-none text-ink">{elo(standing.elo)}</span>
                </div>
                <div className="flex flex-col gap-1.5 bg-surface-200 px-4.5 py-3.5">
                  <span className="text-ink-muted signal-sm">{tm('head.opponents')}</span>
                  <span className="font-display text-[28px] leading-none text-ink">{opponents !== null ? elo(opponents) : '–'}</span>
                </div>
              </div>
            ) : null}
          </section>

          {/* Phone head */}
          <section className={`flex flex-col gap-3 ${NARROW}`}>
            <div className="flex items-center gap-3.5">
              <Avatar profile={profile} size={64} name={name} />
              <div className="flex min-w-0 flex-col gap-1.5">
                <h1 className="m-0 truncate title text-[26px] text-ink">{name}</h1>
                {standing ? (
                  <div className="flex items-center gap-2.5">
                    <TierChip tier={standing.tier} small />
                    <span className="text-xs leading-4 font-medium text-ink-muted"><span className={format === 'TCG' ? 'text-ladder-tcg' : 'text-ladder-genesys'}>{format}</span> {elo(standing.elo)}</span>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-2"><Lock size={12} /><span className="text-ink-muted signal-sm">{tm('head.private')}</span></div>
          </section>

          {profile.isPrivate ? (
            <PrivateNotice />
          ) : !visible ? (
            <EmptyBox title={t('errors.ownerOnly')}>{t('errors.ownerOnlyBody')}</EmptyBox>
          ) : !choices.length ? (
            <EmptyBox title={t('errors.noSeason')}>{t('errors.noRanked')}</EmptyBox>
          ) : (
            <>
              <PlayerFilters
                base={base}
                choices={choices}
                season={pick.season}
                ladder={pick.ladder}
                period={selection.period}
                startsAt={data?.season?.startsAt ?? choices.find((c) => c.code === pick.season)?.startsAt ?? null}
                builtAt={data?.benchmark?.builtAt ?? null}
              />
              {!result?.ok ? (
                result?.status === 403 ? <PrivateNotice /> : (
                  <EmptyBox title={result?.status === 404 ? t('errors.noSeason') : t('errors.title')}>{result?.status === 404 ? t('errors.noSeasonBody') : t('errors.body')}</EmptyBox>
                )
              ) : !data!.record.games ? (
                <EmptyBox title={t('errors.noGames')}>{t('errors.noGamesBody')}</EmptyBox>
              ) : (
                <MySections data={data!} ladder={format} history={standing?.eloHistory ?? []} metaFaces={metaFaces} />
              )}
              <AdBanner id="ad-profile-bottom" placement="content" className={`mx-auto w-full max-w-[728px] pt-2 ${WIDE}`} />
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}
