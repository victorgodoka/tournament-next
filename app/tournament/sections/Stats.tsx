import { useTranslations } from 'next-intl'
import { formatRate, formatRecord } from '@omega/tournament/labels'
import { BarList } from '@ui/chart'
import { DataTable } from '@ui/data-table'
import { RailHead } from '@ui/rail-head/rail-head.component'
import { StatGrid } from '@ui/stat-grid'
import type { ArchetypeStat, CardStat, MatchupStat, TournamentStats } from '@utils/types'

const pct = (v: number) => `${v.toFixed(1)}%`

/** Games won and lost by the decks running a card; draws only when there are any. */
const gamesRecord = ({ wins, loses, draws }: CardStat) => `${wins}–${loses}${draws ? `–${draws}` : ''}`

/** Tables scroll sideways on a phone rather than squeezing the columns. */
const Scroll = ({ children }: { children: React.ReactNode }) => <div className="min-w-0 overflow-x-auto">{children}</div>

export const Stats = ({ stats, players }: { stats: TournamentStats; players: number }) => {
  const t = useTranslations('Tournaments')
  const { matches, archetypes, matchups, cards } = stats
  const play = matches.onThePlay
  const unclassified = players - archetypes.reduce((sum, row) => sum + row.players, 0)
  const decks = (card: CardStat) => `${card.decks} / ${players}`

  return (
    <>
      <StatGrid
        items={[
          {
            label: t('stats.played'),
            value: `${matches.played} / ${matches.total}`,
            hint: t('stats.playedHint', { unplayed: matches.unplayed, draws: matches.draws }),
          },
          { label: t('stats.games'), value: matches.games, hint: t('stats.gamesHint', { count: matches.threeGameMatches }) },
          {
            label: t('stats.onThePlay'),
            value: play.games ? formatRate(play.wins / play.games) : '—',
            tone: 'cyan',
            hint: t('stats.onThePlayHint', { wins: play.wins, games: play.games }),
          },
          {
            label: t('stats.archetypes'),
            value: archetypes.length,
            hint: unclassified ? t('stats.archetypesHint', { count: unclassified }) : t('stats.allClassified'),
          },
        ]}
      />

      <RailHead num="01" label={t('stats.metagame')} stamp={t('stats.metagameStamp', { count: players })} className="px-0" />
      {archetypes.length ? (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <BarList
            title={t('stats.share')}
            subtitle={t('stats.shareSub')}
            items={archetypes.map((row) => ({ label: row.archetype, value: row.share * 100 }))}
            format={pct}
          />
          <Scroll>
            <DataTable<ArchetypeStat>
              caption={t('stats.recordCaption')}
              rowKey={(row) => row.archetype}
              columns={[
                { key: 'archetype', label: t('stats.archetype'), strong: true },
                { key: 'players', label: t('stats.players'), numeric: true },
                { key: 'record', label: t('stats.record'), numeric: true, render: formatRecord },
                { key: 'winRate', label: t('stats.winRate'), numeric: true, strong: true, render: (row) => formatRate(row.winRate) },
              ]}
              rows={archetypes}
            />
          </Scroll>
        </div>
      ) : (
        <p className="text-sm text-ink-muted">{t('stats.noArchetypes')}</p>
      )}

      {matchups.length ? (
        <>
          <RailHead num="02" label={t('stats.matchups')} stamp={t('stats.mirrors')} className="px-0" />
          <Scroll>
            <DataTable<MatchupStat>
              caption={t('stats.matchupsCaption')}
              rowKey={(row) => `${row.archetype}-${row.opponent}`}
              columns={[
                { key: 'archetype', label: t('stats.archetype'), strong: true },
                { key: 'opponent', label: t('stats.opponent') },
                { key: 'record', label: t('stats.record'), numeric: true, render: formatRecord },
                { key: 'matches', label: t('stats.matches'), numeric: true, render: (row) => row.wins + row.loses + row.draws },
              ]}
              rows={matchups}
            />
          </Scroll>
        </>
      ) : null}

      {cards.main.length || cards.extra.length ? (
        <>
          <RailHead num="03" label={t('stats.cards')} stamp={t('stats.cardsStamp')} className="px-0" />
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <Scroll>
              <DataTable<CardStat>
                caption={t('stats.mainCaption')}
                rowKey={(row) => row.id}
                columns={[
                  { key: 'name', label: t('stats.card'), strong: true, render: (row) => row.name ?? t('stats.fallbackName', { id: row.id }) },
                  { key: 'decks', label: t('stats.decks'), numeric: true, render: decks },
                  { key: 'copies', label: t('stats.copies'), numeric: true },
                  { key: 'side', label: t('stats.inSide'), numeric: true, render: (row) => row.side.decks },
                  { key: 'record', label: t('stats.gamesRecord'), numeric: true, render: gamesRecord },
                ]}
                rows={cards.main.slice(0, 10)}
              />
            </Scroll>
            <Scroll>
              <DataTable<CardStat>
                caption={t('stats.extraCaption')}
                rowKey={(row) => row.id}
                columns={[
                  { key: 'name', label: t('stats.card'), strong: true, render: (row) => row.name ?? t('stats.fallbackName', { id: row.id }) },
                  { key: 'decks', label: t('stats.decks'), numeric: true, render: decks },
                  { key: 'record', label: t('stats.gamesRecord'), numeric: true, render: gamesRecord },
                ]}
                rows={cards.extra.slice(0, 5)}
              />
            </Scroll>
          </div>
        </>
      ) : null}
    </>
  )
}
