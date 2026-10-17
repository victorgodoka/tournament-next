import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { LocalTime } from '@omega/profile/local-time'
import { CopyButton } from '@omega/tournament/copy-deck'
import { DAY_YEAR, TIME_ONLY, banlistLabel, cardPoolYear, formatDuration, formatNumber, formatTone } from '@omega/tournament/labels'
import { Chip } from '@ui/chip/chip.component'
import { Eyebrow } from '@ui/eyebrow/eyebrow'
import { Footer } from '@ui/footer'
import { Header } from '@ui/header'
import { StatGrid } from '@ui/stat-grid'
import type { TournamentDetail } from '@utils/types'
import { Rounds } from './sections/Rounds'
import { Standings } from './sections/Standings'
import { Stats } from './sections/Stats'
import { TournamentTabs } from './TournamentTabs'

const TournamentPage = ({ detail }: { detail: TournamentDetail }) => {
  const t = useTranslations('Tournaments')
  const locale = useLocale()
  const { tournament, standings, rounds, stats } = detail
  const { id, status, format, settings, startedAt, endedAt, players } = tournament
  const { matches } = stats
  const live = status === 'live'
  const year = cardPoolYear(tournament.cardPool)
  const dropped = standings.filter((standing) => standing.dropped).length

  return (
    <>
      <Header />
      <main className="flex min-h-dvh flex-col overflow-x-hidden pt-16 pb-16">
        <div className="mx-auto flex w-full max-w-page flex-col gap-8 px-gutter pt-8">
          <nav aria-label={t('detail.breadcrumb')} className="flex items-center gap-2.5 text-ink-muted signal-sm">
            <Link href="/tournaments" className="underline decoration-1 underline-offset-3 hover:decoration-2">
              {t('detail.breadcrumbRoot')}
            </Link>
            <span aria-hidden>/</span>
            <span aria-current="page">#{id}</span>
          </nav>

          <header className="flex flex-wrap items-end gap-6">
            <div className="flex min-w-0 grow flex-col gap-3.5">
              <Eyebrow
                tone={live ? 'negative' : 'gold'}
                live={live}
                meta={
                  <>
                    <LocalTime iso={startedAt} options={DAY_YEAR} /> · <LocalTime iso={startedAt} options={TIME_ONLY} />
                  </>
                }
              >
                {t(`status.${status}`)}
              </Eyebrow>
              <h1 className="text-[clamp(36px,5vw,56px)] leading-none text-ink uppercase">
                {banlistLabel(tournament)} <span className="text-ink-muted">#{id}</span>
              </h1>
              <div className="flex flex-wrap gap-2">
                <Chip tone={formatTone(format)}>{format}</Chip>
                <Chip>{t(`mode.long.${settings.mode}`)}</Chip>
                <Chip>{t('detail.chips.masterRule', { rule: settings.masterRule })}</Chip>
                <Chip>{t('detail.chips.lp', { lp: formatNumber(settings.startingLp, locale) })}</Chip>
                <Chip>{t('detail.chips.timer', { seconds: settings.timer })}</Chip>
                <Chip>{t('detail.chips.hand', { cards: settings.startingHand })}</Chip>
                {year ? <Chip>{t('cardPool', { year })}</Chip> : null}
              </div>
            </div>
            <CopyButton label={t('detail.copyLink')} icon="deck" />
          </header>

          <TournamentTabs
            live={live}
            summary={
              <StatGrid
                items={[
                  {
                    label: t('detail.facts.players'),
                    value: players,
                    hint: dropped ? t('detail.facts.dropped', { count: dropped }) : t('detail.facts.noDrops'),
                  },
                  { label: t('detail.facts.rounds'), value: tournament.rounds, hint: t('detail.facts.noTopCut') },
                  {
                    label: t('detail.facts.matches'),
                    value: `${matches.played} / ${matches.total}`,
                    hint: matches.unplayed ? t('detail.facts.unplayed', { count: matches.unplayed }) : t('detail.facts.allPlayed'),
                  },
                  {
                    label: t('detail.facts.duration'),
                    value: endedAt ? formatDuration(startedAt, endedAt) : t('detail.facts.running'),
                    hint: (
                      <>
                        <LocalTime iso={startedAt} options={TIME_ONLY} /> –{' '}
                        {endedAt ? <LocalTime iso={endedAt} options={TIME_ONLY} /> : '…'}
                      </>
                    ),
                  },
                ]}
              />
            }
            standings={<Standings tournament={tournament} standings={standings} rounds={rounds} />}
            rounds={<Rounds rounds={rounds} standings={standings} live={live} />}
            stats={<Stats stats={stats} players={players} live={live} standings={standings} />}
          />
        </div>
      </main>
      <Footer />
    </>
  )
}

export default TournamentPage
