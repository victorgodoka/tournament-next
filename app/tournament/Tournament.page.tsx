import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { LocalTime } from '@omega/profile/local-time'
import { CopyDeckButton } from '@omega/tournament/copy-deck'
import { DATE_ONLY, TIME_ONLY, cardPoolYear, formatDuration, formatRecord } from '@omega/tournament/labels'
import { PlayerAvatar, playerName } from '@omega/tournament/player'
import { Chip } from '@ui/chip/chip.component'
import { Footer } from '@ui/footer'
import { Header } from '@ui/header'
import type { Standing, TournamentDetail } from '@utils/types'
import { Rounds } from './sections/Rounds'
import { Standings } from './sections/Standings'
import { Stats } from './sections/Stats'
import { TournamentTabs } from './TournamentTabs'

const Fact = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <dt className="text-ink-muted signal">{label}</dt>
    <dd className="mt-0.5 text-ink display-5">{children}</dd>
  </div>
)

/** Rank 1, with the record and deck the standings computed for them. */
const Winner = ({ champion }: { champion: Standing }) => {
  const t = useTranslations('Tournaments')

  return (
    <div className="flex flex-wrap items-center gap-x-[clamp(20px,4vw,56px)] gap-y-4 border border-line-strong bg-surface-100 px-[clamp(16px,2vw,22px)] py-[clamp(16px,2vw,22px)]">
      <PlayerAvatar player={champion.player} size={54} />

      <div className="min-w-0">
        <p className="text-gold signal">{t('detail.winnerLabel')}</p>
        <Link href={`/profile/${champion.player.id}`} className="mt-1 block truncate text-ink display-5 hover:text-gold">
          {playerName(champion.player, t('player.unknown'))}
        </Link>
        {champion.player.handle ? <p className="text-ink-muted mono-data">{champion.player.handle}</p> : null}
      </div>

      <dl className="flex flex-wrap gap-x-[clamp(20px,3vw,40px)] gap-y-3">
        <Fact label={t('detail.record')}>{formatRecord(champion)}</Fact>
        <Fact label={t('detail.pointsLabel')}>
          <span className="text-gold">{champion.points}</span>
        </Fact>
        <Fact label={t('detail.deck')}>{champion.deck?.archetype ?? t('detail.unclassified')}</Fact>
      </dl>
    </div>
  )
}

const TournamentPage = ({ detail }: { detail: TournamentDetail }) => {
  const t = useTranslations('Tournaments')
  const { tournament, standings, rounds, stats } = detail
  const live = tournament.status === 'live'
  const champion = standings.find((standing) => standing.rank === 1)
  const year = cardPoolYear(tournament.cardPool)

  return (
    <>
      <Header />
      <main className="flex min-h-dvh flex-col overflow-x-hidden pt-16 pb-[clamp(56px,7vw,96px)]">
        <div className="mx-auto w-full max-w-page px-gutter">
          <nav aria-label={t('detail.breadcrumb')} className="text-ink-muted signal">
            <Link href="/tournaments" className="text-ink-muted hover:text-gold">
              {t('detail.breadcrumbRoot')}
            </Link>{' '}
            / #{tournament.id}
          </nav>

          <div className="mt-3 flex flex-wrap items-end justify-between gap-4.5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <Chip tone={live ? 'negative' : 'neutral'} dot={live}>
                  {t(live ? 'status.live' : 'status.finished')}
                </Chip>
              </div>
              {/* Format and the day it was played. The banlist carries its own date and belongs in a labelled field. */}
              <h1 className="mt-3 text-ink display-2">
                {t('detail.heading', { format: tournament.format })} ·{' '}
                <LocalTime iso={tournament.startedAt} options={DATE_ONLY} />
              </h1>
            </div>

            {champion?.deck ? <CopyDeckButton code={champion.deck.code} label={t('detail.copyWinningDeck')} /> : null}
          </div>

          <p className="mt-3.5 text-ink-dim mono-data">
            <span className="text-ink-muted">{t('detail.banlist')}</span> {tournament.banlist} ·{' '}
            {t('detail.players', { count: tournament.players })} ·{' '}
            {t('detail.swissRounds', { count: tournament.rounds })} · {t('detail.noTopCut')} ·{' '}
            <LocalTime iso={tournament.startedAt} options={TIME_ONLY} />
            {tournament.endedAt ? (
              <>
                {' → '}
                <LocalTime iso={tournament.endedAt} options={TIME_ONLY} /> (
                {formatDuration(tournament.startedAt, tournament.endedAt)})
              </>
            ) : (
              ` · ${t('detail.stillRunning')}`
            )}
            {year ? ` · ${t('cardPool', { year })}` : ''}
          </p>

          {/* One plain sentence with the answer a searcher came for: who won, with what. */}
          {champion && !live ? (
            <p className="mt-3.5 max-w-[62ch] text-ink-dim lead">
              {t('detail.summary', {
                winner: playerName(champion.player, t('player.unknown')),
                deck: champion.deck?.archetype ?? t('detail.unclassified'),
                record: formatRecord(champion),
                points: champion.points,
              })}
            </p>
          ) : null}

          {champion && !live ? (
            <section className="pt-section">
              <Winner champion={champion} />
            </section>
          ) : null}

          <section className="pt-section">
            <TournamentTabs
              live={live}
              standings={<Standings standings={standings} />}
              rounds={<Rounds rounds={rounds} standings={standings} />}
              stats={<Stats stats={stats} players={tournament.players} />}
            />
          </section>
        </div>
      </main>
      <Footer />
    </>
  )
}

export default TournamentPage
