import { headers } from 'next/headers'
import Link from 'next/link'
import { useFormatter, useTranslations } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { twMerge } from 'tailwind-merge'
import { CardArt } from '@omega/card-art'
import { ARTICLE_LIST, ArticleCard } from '@omega/wiki/article'
import { EmptyBox } from '@omega/profile/empty-box'
import { LocalTime } from '@omega/profile/local-time'
import { calendarKey } from '@omega/tournament/calendar-row'
import { playerName } from '@omega/tournament/player'
import { DAY, TIME_ONLY, banlistLabel, formatNumber, formatRate, formatTone } from '@omega/tournament/labels'
import { Avatar } from '@ui/avatar'
import { Button } from '@ui/button'
import { Chip } from '@ui/chip'
import { AdBanner } from '@omega/ads/ad-banner'
import { Footer } from '@ui/footer'
import { Header } from '@ui/header'
import { Icon } from '@ui/icon'
import { PageHeader } from '@ui/page-header'
import { Panel } from '@ui/panel'
import { SectionHead } from '@ui/section-head'
import { getLatestArticles } from '@utils/articles'
import { getMeServer } from '@utils/auth'
import { pageMetadata } from '@utils/metadata'
import type { ArticleSummary, WelcomeData, WelcomeLadder, WelcomeMeta, WelcomeTournament, WelcomeUpcoming } from '@utils/types'
import { change, getWelcomeData } from '@utils/welcome'
import { ReturnAfterSignIn } from './return-to'

export async function generateMetadata() {
  const t = await getTranslations('Welcome.meta')
  return pageMetadata({ title: t('title'), path: '/welcome', description: t('description'), noIndex: true })
}

const LADDERS: { id: WelcomeLadder; label: string; color: string }[] = [
  { id: 'tcg', label: 'TCG', color: '[--ladder:var(--color-ladder-tcg)]' },
  { id: 'genesys', label: 'Genesys', color: '[--ladder:var(--color-ladder-genesys)]' },
]

const META = 'signal-sm text-ink-muted'
/** Rows split by hairline gaps over `line`, never bordered boxes. */
const LIST = 'flex flex-col gap-px border border-line bg-line'

/** `▲ +4.6%` against the previous 24 h; nothing when there's no previous window. */
const Delta = ({ now, before, note }: { now: number; before: number; note?: string }) => {
  const delta = change(now, before)
  if (!delta) return null
  return (
    <span className="flex flex-wrap items-baseline gap-x-2 text-[13px] leading-4.5">
      <b className={delta.up ? 'text-win' : 'text-loss'}>
        {delta.up ? '▲' : '▼'} {delta.label}
      </b>
      {note ? <span className="text-ink-muted">{note}</span> : null}
    </span>
  )
}

/* ------------------------------------------------------------------ live */

const LiveBanner = ({ tournament, featured }: { tournament: WelcomeTournament; featured: boolean }) => {
  const t = useTranslations('Welcome.live')
  const tt = useTranslations('Tournaments')

  return (
    <Panel
      tone={featured ? 'steel' : 'raised'}
      label={t('label')}
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:px-8 lg:py-7"
    >
      <div className="flex min-w-0 flex-col gap-3.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <Chip tone="live">{tt('status.live')}</Chip>
          <Chip tone={formatTone(tournament.format)}>{tournament.format}</Chip>
          <span className="text-ink-dim signal-sm">{banlistLabel(tournament)}</span>
        </div>
        <h2 className="text-[clamp(32px,4vw,40px)] leading-none text-ink uppercase">{tournament.name}</h2>
        <p className="text-sm text-ink-dim">
          {t('summary', { players: tournament.players, rounds: tournament.rounds })}{' '}
          <LocalTime iso={tournament.startedAt} options={TIME_ONLY} />
        </p>
      </div>
      <Button href={`/tournament/${tournament.id}`} variant="primary" className="min-h-12 justify-self-start px-7">
        {t('follow')} <Icon name="right" />
      </Button>
    </Panel>
  )
}

/* ------------------------------------------------------------------ 01 activity */

const Activity = ({ players, games }: Pick<WelcomeData, 'players' | 'games'>) => {
  const t = useTranslations('Welcome.activity')
  const total = games.last24h.tcg + games.last24h.genesys

  return (
    <section aria-labelledby="activity" className="flex flex-col gap-5">
      <SectionHead ruled num="01" id="activity" end={t('stamp')}>{t('heading')}</SectionHead>
      <div className="grid gap-px border border-line bg-line lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="dots flex flex-col gap-3 bg-surface-100 px-5 py-6 min-[720px]:px-8 min-[720px]:py-9">
          <span className="text-ink-muted signal">{t('duelists')}</span>
          <strong className="font-display text-[clamp(72px,12vw,152px)] leading-[0.85] font-normal text-ink tabular-nums">
            {formatNumber(players.last24h)}
          </strong>
          <span className="text-ink-dim body-sm">{t('duelistsNote')}</span>
          <Delta now={players.last24h} before={players.previous24h} note={t('vsPrevious')} />
        </div>

        <div className="flex flex-col bg-surface-100">
          {LADDERS.map(({ id, label, color }) => (
            <div key={id} className={twMerge('flex flex-1 items-end justify-between gap-4 border-b border-line px-5 py-5 min-[720px]:px-8', color)}>
              <div className="flex flex-col gap-2">
                <span className="flex items-center gap-2.5 text-ink-muted signal">
                  <span aria-hidden className="size-2 bg-(--ladder)" />
                  {t('duels', { ladder: label })}
                </span>
                <span className="text-ink stat-lg">{formatNumber(games.last24h[id])}</span>
              </div>
              <Delta now={games.last24h[id]} before={games.previous24h[id]} />
            </div>
          ))}
          <div className="flex flex-col gap-2.5 px-5 py-5 min-[720px]:px-8">
            {/* One bar, one segment per ladder, in ladder order: the numbers above carry the values. */}
            <div aria-hidden className="flex h-2 gap-0.5 bg-surface-300">
              {LADDERS.map(({ id, color }) =>
                games.last24h[id] ? (
                  <span key={id} className={twMerge('h-full bg-(--ladder)', color)} style={{ flexGrow: games.last24h[id] }} />
                ) : null,
              )}
            </div>
            <span className={META}>{t('split', { count: formatNumber(total) })}</span>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ 02 meta */

const LadderMeta = ({ label, color, meta }: { label: string; color: string; meta: WelcomeMeta }) => {
  const t = useTranslations('Welcome.meta')
  const top = meta.decks[0]?.metaShare || 1

  return (
    <div className={twMerge('flex min-w-0 flex-col gap-5', color)}>
      <SectionHead as="h3" compact end={t('duels', { count: meta.duels })}>
        <span className="flex items-center gap-3">
          <span aria-hidden className="size-2.5 bg-(--ladder)" />
          {label}
        </span>
      </SectionHead>

      <div className="flex flex-col gap-2.5">
        <h4 className="font-mono text-ink-muted signal">{t('decks')}</h4>
        <ol className={LIST}>
          {meta.decks.map((deck, i) => (
            <li key={deck.archetype.join('-')} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 bg-surface-100 px-4 py-3.5">
              <span className={twMerge('text-center font-display text-2xl leading-none', i ? 'text-ink-dim' : 'text-gold')}>{i + 1}</span>
              <span className="flex min-w-0 flex-col gap-1">
                <b className="truncate text-[15px]">{deck.name ?? t('unnamed')}</b>
                <span className={META}>
                  {deck.winRate === null ? t('noWinRate') : t('winRate', { rate: formatRate(deck.winRate) })} · {t('duels', { count: deck.duels })}
                </span>
              </span>
              <span className="flex flex-col items-end gap-1">
                <span className="text-ink stat">{formatRate(deck.metaShare)}</span>
                <span className={META}>{t('ofDecks')}</span>
              </span>
              {/* Scaled to the leader, so the three read against each other; the label is the true share. */}
              <span aria-hidden className="col-start-2 col-end-4 h-1 bg-surface-300">
                <i className="block h-full bg-(--ladder)" style={{ width: `${(deck.metaShare / top) * 100}%` }} />
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-col gap-2.5">
        <h4 className="font-mono text-ink-muted signal">{t('cards')}</h4>
        <ol className={LIST}>
          {meta.cards.map((card) => (
            <li key={card.id}>
              <Link
                href={`/wiki/card/${card.id}`}
                className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-4 bg-surface-100 px-4 py-2.5 text-ink hover:bg-surface-300"
              >
                <CardArt art={card} alt="" sizes="36px" className="h-13 w-9 border border-line-strong" />
                <span className="flex min-w-0 flex-col gap-1">
                  <b className="truncate text-sm">{card.name}</b>
                  <span className={twMerge('truncate', META)}>
                    {t('split', { main: formatRate(card.inMain), side: formatRate(card.inSide), used: formatRate(card.used) })}
                  </span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <span className="stat">{formatRate(card.inDecks)}</span>
                  <span className={META}>{t('inDecks')}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

const Meta = ({ meta }: { meta: NonNullable<WelcomeData['meta']> }) => {
  const t = useTranslations('Welcome.meta')

  return (
    <section aria-labelledby="meta" className="flex flex-col gap-6">
      <SectionHead ruled num="02" id="meta" end={<span className={twMerge('ml-auto max-[719px]:hidden', META)}><LocalTime iso={meta.updatedAt} options={TIME_ONLY} /></span>}>
        {t('heading')}
      </SectionHead>
      <div className="grid gap-x-8 gap-y-12 lg:grid-cols-2">
        {LADDERS.map(({ id, label, color }) => (
          <LadderMeta key={id} label={label} color={color} meta={meta[id]} />
        ))}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ 03 tournaments */

const Result = ({ tournament }: { tournament: WelcomeTournament }) => {
  const t = useTranslations('Welcome.tournaments')
  const tt = useTranslations('Tournaments')
  const { id, format, players, rounds, startedAt, winner } = tournament
  const name = playerName(winner ?? undefined, tt('player.unknown'))

  return (
    <li>
      <Link
        href={`/tournament/${id}`}
        className="grid grid-cols-1 gap-3 bg-surface-100 px-4 py-3.5 text-ink hover:bg-surface-300 min-[720px]:grid-cols-[minmax(0,1fr)_minmax(0,220px)] min-[720px]:items-center min-[720px]:gap-5"
      >
        <span className="flex min-w-0 flex-col gap-1.5">
          <span className="flex min-w-0 items-center gap-2.5">
            <Chip tone={formatTone(format)}>{format}</Chip>
            <b className="truncate text-[15px]">{banlistLabel(tournament)}</b>
          </span>
          <span className={META}>
            #{id} · <LocalTime iso={startedAt} options={DAY} /> · {t('summary', { players, rounds })}
          </span>
        </span>
        {winner ? (
          <span className="flex min-w-0 items-center gap-2.5">
            <Avatar name={name} src={winner.avatar} cosmetics={winner.cosmetics} size="sm" />
            <span className="flex min-w-0 flex-col gap-0.5">
              <b className="truncate text-sm">{name}</b>
              <span className="truncate text-gold signal-sm">
                {winner.archetype ? `${winner.archetype} · ` : ''}
                {t('points', { points: winner.points })}
              </span>
            </span>
          </span>
        ) : null}
      </Link>
    </li>
  )
}

const Upcoming = ({ event }: { event: WelcomeUpcoming }) => {
  const t = useTranslations('Welcome.tournaments')
  const tt = useTranslations('Tournaments')
  const format = useFormatter()
  const { format: name, banlist, startsAt } = event

  return (
    <li className="grid grid-cols-[52px_minmax(0,1fr)] gap-4 bg-surface-100 px-4 py-3.5">
      <span className="flex flex-col items-center justify-center gap-1 border-r border-line pr-4">
        <span className="font-display text-[28px] leading-none text-ink">
          <LocalTime iso={startsAt} options={{ day: '2-digit' }} />
        </span>
        <span className={META}>
          <LocalTime iso={startsAt} options={{ month: 'short' }} />
        </span>
      </span>
      <span className="flex min-w-0 flex-col gap-1.5">
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <Chip tone={name ? formatTone(name) : 'neutral'}>{name ?? t('fallbackFormat')}</Chip>
          {banlist && banlist !== name ? <b className="truncate text-sm">{name ? banlistLabel({ banlist, format: name }) : banlist}</b> : null}
        </span>
        <span className={META}>
          <LocalTime iso={startsAt} options={TIME_ONLY} /> · {tt(`mode.short.${event.mode}`)} · {t(`structure.${event.structure}`)}
        </span>
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-gold signal-sm">{format.relativeTime(new Date(startsAt))}</span>
          {event.requiresPass ? <Chip tone="pass">{t('pass')}</Chip> : null}
          {event.rewardTp ? <Chip tone="gold">{t('tp')}</Chip> : null}
        </span>
      </span>
    </li>
  )
}

const Tournaments = ({ num, recent, upcoming }: { num: string; recent: WelcomeTournament[]; upcoming: WelcomeUpcoming[] }) => {
  const t = useTranslations('Welcome.tournaments')

  return (
    <section aria-labelledby="tournaments" className="flex flex-col gap-6">
      <SectionHead
        ruled
        num={num}
        id="tournaments"
        end={
          <Link href="/tournaments" className="ml-auto flex items-center gap-1.5 signal-strong">
            {t('all')} <Icon name="right" />
          </Link>
        }
      >
        {t('heading')}
      </SectionHead>
      <div className="grid gap-x-8 gap-y-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <SectionHead as="h3" compact>{t('recent')}</SectionHead>
          {recent.length ? (
            <ol className={LIST}>
              {recent.map((tournament) => <Result key={tournament.id} tournament={tournament} />)}
            </ol>
          ) : (
            <EmptyBox title={t('recentEmpty')} />
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <SectionHead as="h3" compact>{t('upcoming')}</SectionHead>
          {upcoming.length ? (
            <ol className={LIST}>
              {upcoming.map((event) => <Upcoming key={calendarKey(event)} event={event} />)}
            </ol>
          ) : (
            <EmptyBox title={t('upcomingEmpty')} />
          )}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ wiki */

const Wiki = ({ num, articles }: { num: string; articles: ArticleSummary[] }) => {
  const t = useTranslations('Welcome.wiki')

  return (
    <section aria-labelledby="wiki" className="flex flex-col gap-6">
      <SectionHead
        ruled
        num={num}
        id="wiki"
        end={
          <Link href="/wiki" className="ml-auto flex items-center gap-1.5 signal-strong">
            {t('all')} <Icon name="right" />
          </Link>
        }
      >
        {t('heading')}
      </SectionHead>
      {/* One column: the rails leave no room for the home's three. */}
      <ul className={ARTICLE_LIST}>
        {articles.map((article) => <li key={article.id}><ArticleCard article={article} /></li>)}
      </ul>
    </section>
  )
}

/* ------------------------------------------------------------------ page */

const Welcome = ({ welcome, articles }: { welcome: WelcomeData | null; articles: ArticleSummary[] }) => {
  const t = useTranslations('Welcome.header')
  // The wiki is another API, so it still shows when the game payload is down.
  const before = welcome ? (welcome.meta ? 3 : 2) : 0

  return (
    <div className="mx-auto flex w-full max-w-page flex-col gap-section px-gutter">
      <PageHeader
        eyebrow={t('eyebrow')}
        eyebrowTone={welcome?.tournaments.live.length ? 'negative' : 'cyan'}
        eyebrowMeta={welcome ? <>{t('stamp')} <LocalTime iso={welcome.players.updatedAt} options={TIME_ONLY} /></> : null}
        title={t('title')}
        lead={welcome ? t('lead') : t('down')}
      />
      {/* The whole payload fails together (5xx), so without it only the header shows. */}
      {welcome ? (
        <>
          {welcome.tournaments.live.map((tournament, i) => (
            <LiveBanner key={tournament.id} tournament={tournament} featured={!i} />
          ))}
          <Activity players={welcome.players} games={welcome.games} />
          <AdBanner id="ad-top" placement="content" />
          {welcome.meta ? <Meta meta={welcome.meta} /> : null}
          <Tournaments num={welcome.meta ? '03' : '02'} recent={welcome.tournaments.recent} upcoming={welcome.tournaments.upcoming} />
          <AdBanner id="ad-bottom" placement="content" />
        </>
      ) : null}
      {articles.length ? <Wiki num={String(before + 1).padStart(2, '0')} articles={articles} /> : null}
    </div>
  )
}

const WelcomePage = async () => {
  // `/welcome` is public and cached, so the viewer's equipped background comes from `/auth/me`.
  const [welcome, me, articles] = await Promise.all([
    getWelcomeData(),
    headers().then((h) => getMeServer(h.get('cookie'))).catch(() => null),
    getLatestArticles(),
  ])
  const background = me?.cosmetics?.BACKGROUND?.assetUrl
  return (
    <>
      <ReturnAfterSignIn />
      <Header />
      <main
        data-clear-gutters
        className="flex min-h-dvh flex-col overflow-x-clip pt-16 pb-24"
        style={background ? { background: `linear-gradient(color-mix(in srgb, var(--color-space-000) 85%, transparent), var(--color-space-000)), url(${JSON.stringify(background)}) center / cover fixed` } : undefined}
      >
        <Welcome welcome={welcome} articles={articles} />
      </main>
      <Footer />
    </>
  )
}

export default WelcomePage
