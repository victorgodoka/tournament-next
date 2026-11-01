import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { AdBanner } from '@omega/ads/ad-banner'
import { CardArt } from '@omega/card-art'
import { LocalTime } from '@omega/profile/local-time'
import { CopyButton } from '@omega/tournament/copy-deck'
import { DAY, TIME_ONLY, banlistLabel, cardPoolYear, formatDuration, formatNumber, formatRecord, formatTone } from '@omega/tournament/labels'
import { playerName } from '@omega/tournament/player'
import { Avatar } from '@ui/avatar'
import { Chip } from '@ui/chip'
import { Footer } from '@ui/footer'
import { Header } from '@ui/header'
import { Icon } from '@ui/icon'
import { Panel } from '@ui/panel'
import { StatGrid } from '@ui/stat-grid'
import type { Standing, TournamentDetail, TournamentSummary } from '@utils/types'
import { META, SERIES, deckName, type Frames } from './helpers'
import { LiveStrip } from './live-strip'
import { Live } from './sections/Live'
import { Rounds } from './sections/Rounds'
import { Standings } from './sections/Standings'
import { Stats } from './sections/Stats'
import { TournamentTabs, type Tab } from './TournamentTabs'

type TournamentPageProps = {
  detail: TournamentDetail
  frames: Frames
  tab: Tab
  /** When the API was read, ISO: the live page's clock. */
  now: string
}

const Crumbs = ({ id }: { id: number }) => {
  const t = useTranslations('Tournaments.detail')
  return (
    <nav aria-label={t('breadcrumb')} className="flex items-center gap-1.5 text-ink-muted signal-sm">
      <Link href="/tournaments" className="text-cyan hover:text-ink">
        {t('breadcrumbRoot')}
      </Link>
      <span aria-hidden className="px-1">/</span>
      <span aria-current="page">#{id}</span>
    </nav>
  )
}

/** The settings as chips: format, then the rules the game ran with. */
const Settings = ({ tournament }: { tournament: TournamentSummary }) => {
  const t = useTranslations('Tournaments')
  const locale = useLocale()
  const { format, settings } = tournament
  const year = cardPoolYear(tournament.cardPool)
  const ghost = '[--fill:transparent]'
  return (
    <div className="flex flex-wrap gap-1.5">
      <Chip tone={formatTone(format)}>{format}</Chip>
      <Chip className={ghost}>{t(`mode.long.${settings.mode}`)}</Chip>
      <Chip className={ghost}>{t('detail.chips.masterRule', { rule: settings.masterRule })}</Chip>
      <Chip className={ghost}>{t('detail.chips.lp', { lp: formatNumber(settings.startingLp, locale) })}</Chip>
      <Chip className={ghost}>{t('detail.chips.timer', { seconds: settings.timer })}</Chip>
      <Chip className={ghost}>{t('detail.chips.hand', { cards: settings.startingHand })}</Chip>
      {year ? <Chip className={ghost}>{t('cardPool', { year })}</Chip> : null}
    </div>
  )
}

/** Breadcrumb, status line, the hero title and the settings. The standings and live tabs open with it. */
const FullHeader = ({ tournament }: { tournament: TournamentSummary }) => {
  const t = useTranslations('Tournaments')
  const { id, status, startedAt, endedAt } = tournament
  const live = status === 'live'
  return (
    <header className="flex flex-col gap-4 border-b border-line pb-6">
      <Crumbs id={id} />
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-3.5">
          <div className="flex items-center gap-2.5 text-ink-dim signal">
            {live ? <Chip tone="live">{t('status.live')}</Chip> : <span aria-hidden className="size-2 shrink-0 bg-gold" />}
            <span>
              {t(live ? 'page.started' : 'status.finished')}
              {live ? ' ' : ' · '}
              <LocalTime iso={startedAt} options={DAY} /> · <LocalTime iso={startedAt} options={TIME_ONLY} />
              {endedAt ? (
                <>
                  {' – '}
                  <LocalTime iso={endedAt} options={TIME_ONLY} />
                </>
              ) : null}
            </span>
          </div>
          <h1 className="text-ink display-hero max-[720px]:text-5xl">
            {banlistLabel(tournament)} <span className="text-ink-muted">#{id}</span>
          </h1>
          <Settings tournament={tournament} />
        </div>
        <CopyButton label={t('detail.copyLink')} />
      </div>
    </header>
  )
}

/** The rounds and stats tabs of a finished tournament: one line, since the winner and figures live on the standings. */
const CompactHeader = ({ tournament, champion }: { tournament: TournamentSummary; champion: Standing | undefined }) => {
  const t = useTranslations('Tournaments')
  return (
    <header className="flex flex-col gap-3.5">
      <Crumbs id={tournament.id} />
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-ink display-1 text-[48px]">
          {banlistLabel(tournament)} <span className="text-ink-muted">#{tournament.id}</span>
        </h1>
        <Chip tone={formatTone(tournament.format)}>{tournament.format}</Chip>
        <span className="text-ink-dim signal">
          {t('status.finished')} · <LocalTime iso={tournament.startedAt} options={DAY} />
          {champion ? (
            <>
              {' · '}
              {t('page.wonBy')} <span className="text-gold">{playerName(champion.player, t('player.unknown'))}</span>
            </>
          ) : null}
        </span>
      </div>
    </header>
  )
}

/** The champion on the steel panel: portrait with the trophy, name and record, their deck with a link to its list. */
const Winner = ({ champion }: { champion: Standing }) => {
  const t = useTranslations('Tournaments')
  const { player, deck, points, tiebreakers } = champion
  const name = playerName(player, t('player.unknown'))
  const archetypes = deck?.archetypes ?? []
  const lead = archetypes[0]
  const total = archetypes.reduce((sum, a) => sum + a.cards, 0)

  return (
    <Panel
      tone="steel"
      label={t('detail.winner')}
      className="grid items-center gap-7 min-[720px]:px-8 min-[720px]:py-7 min-[980px]:grid-cols-[auto_minmax(0,1fr)_minmax(260px,340px)]"
    >
      <div className="relative w-fit">
        <Avatar name={name} src={player.avatar} cosmetics={player.cosmetics} size="xl" className="size-22 text-[32px] shadow-[0_0_0_2px_var(--color-gold)]" />
        <span
          aria-hidden
          className="absolute -right-2.5 -bottom-2.5 grid size-8.5 place-items-center bg-gold text-gold-on [clip-path:polygon(6px_0,100%_0,100%_calc(100%-6px),calc(100%-6px)_100%,0_100%,0_6px)]"
        >
          <Icon name="trophy" size={18} />
        </span>
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <span className="text-gold signal">{t(champion.loses || champion.draws ? 'detail.winner' : 'page.undefeated')}</span>
        <h2 className="truncate text-[clamp(36px,5vw,52px)] leading-none text-ink uppercase">
          <Link href={`/profile/${player.id}`} className="text-ink hover:text-cyan">
            {name}
          </Link>
        </h2>
        <div className="flex flex-wrap items-center gap-x-4.5 gap-y-1.5">
          {player.handle ? <span className="text-ink-dim signal-sm">{player.handle}</span> : null}
          <span className="text-ink data">
            {formatRecord(champion)} · {t('detail.points', { points })}
          </span>
          <span className={META}>KTS {tiebreakers.kts}</span>
        </div>
      </div>
      <div className="cut flex items-center gap-3.5 p-4 [--cut:var(--cut-md)] [--edge:var(--color-steel-edge)] [--fill:rgba(8,10,20,0.4)] max-[979px]:col-span-full">
        {lead ? (
          <CardArt art={{ id: lead.art, name: lead.name }} alt="" sizes="64px" className="size-16 shrink-0" />
        ) : (
          <span aria-hidden className="dots size-16 shrink-0 bg-surface-200" />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="truncate text-ink display-3">{deckName(deck) ?? t('standings.noArchetype')}</span>
          {total ? (
            <span aria-hidden className="flex h-1.5 gap-0.5">
              {archetypes.map((a, i) => (
                <span key={a.name} className="block h-full" style={{ width: `${(a.cards / total) * 100}%`, background: SERIES[i] }} />
              ))}
            </span>
          ) : null}
          {deck ? (
            <a href="#deck" className="text-cyan signal-strong hover:text-ink">
              {t('page.viewDeck')} ↓
            </a>
          ) : null}
        </div>
      </div>
    </Panel>
  )
}

const TournamentPage = ({ detail, frames, tab, now }: TournamentPageProps) => {
  const t = useTranslations('Tournaments')
  const { tournament, standings, rounds, stats } = detail
  const { players, startedAt, endedAt } = tournament
  const { matches } = stats
  const live = tournament.status === 'live'
  const champion = standings[0]
  const current = rounds.at(-1)
  const pending = current?.matches.filter((match) => match.outcome === 'unplayed').length ?? 0
  const dropped = standings.filter((standing) => standing.dropped).length
  // A finished tournament's rounds and stats tabs carry a one-line header: the winner and figures are on the standings.
  const compact = !live && tab !== 'standings'

  const facts = [
    { label: t('detail.facts.players'), value: players, hint: dropped ? t('detail.facts.dropped', { count: dropped }) : t('detail.facts.noDrops') },
    { label: t('detail.facts.rounds'), value: tournament.rounds, hint: t('detail.facts.noTopCut') },
    {
      label: t('detail.facts.matches'),
      value: `${matches.played} / ${matches.total}`,
      hint: live
        ? pending
          ? t('page.onTable', { count: pending })
          : t('detail.facts.allPlayed')
        : matches.unplayed
          ? t('detail.facts.unplayed', { count: matches.unplayed })
          : t('detail.facts.allPlayed'),
      tone: live && pending ? ('cyan' as const) : undefined,
    },
    ...(live
      ? [
          {
            label: t('page.running'),
            value: formatDuration(startedAt, now),
            hint: (
              <>
                {t('page.since')} <LocalTime iso={startedAt} options={TIME_ONLY} />
              </>
            ),
          },
        ]
      : [
          { label: t('stats.games'), value: matches.games, hint: t('page.gameThree', { count: matches.threeGameMatches }) },
          {
            label: t('page.length'),
            value: endedAt ? formatDuration(startedAt, endedAt) : '—',
            hint: (
              <>
                <LocalTime iso={startedAt} options={TIME_ONLY} /> – {endedAt ? <LocalTime iso={endedAt} options={TIME_ONLY} /> : '…'}
              </>
            ),
          },
        ]),
  ]

  return (
    <>
      <Header />
      <main data-clear-gutters className="flex min-h-dvh flex-col overflow-x-hidden pt-16 pb-16">
        {live && current ? (
          <LiveStrip round={current.number} rounds={tournament.rounds} done={current.matches.length - pending} total={current.matches.length} updatedAt={now} />
        ) : null}
        <div className="mx-auto flex w-full max-w-page flex-col gap-7 px-gutter pt-7">
          {compact ? <CompactHeader tournament={tournament} champion={champion} /> : <FullHeader tournament={tournament} />}
          {!compact && !live && champion ? <Winner champion={champion} /> : null}
          {compact ? null : <StatGrid items={facts} columns={facts.length} />}

          <TournamentTabs
            id={tournament.id}
            tab={tab}
            live={live}
            counts={{ standings: standings.length, rounds: rounds.length }}
            panels={{
              live: <Live detail={detail} now={now} />,
              standings: <Standings tournament={tournament} standings={standings} rounds={rounds} frames={frames} />,
              rounds: <Rounds tournament={tournament} rounds={rounds} standings={standings} />,
              stats: <Stats tournament={tournament} stats={stats} standings={standings} frames={frames} live={live} />,
            }}
          />

          {live ? null : <AdBanner id="ad-bottom" placement="content" />}
        </div>
      </main>
      <Footer />
    </>
  )
}

export default TournamentPage
