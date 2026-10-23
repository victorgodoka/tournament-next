'use client'

/**
 * One duelist's tournaments (GET /tournaments/players/:id/stats), drawn with the tournament page's
 * charts and tables. Client for the same reason as that tab: the tables take formatter functions.
 * Decklists only: tournament duels have no play log, so a card's record is "games with it in the list".
 */

import { useLocale, useTranslations } from 'next-intl'
import { formatRate, formatRecord, recordRate } from '@omega/tournament/labels'
import { RecordBar, ShareCell, ShareStack, WinRateBars } from '@omega/tournament/stats-charts'
import { DataTable } from '@ui/data-table'
import { Panel } from '@ui/panel'
import { StatGrid } from '@ui/stat-grid'
import type { ArchetypeStat, CardStat, GameRecord, MatchupStat, PlayerTournamentStats } from '@utils/types'

const ratio = (wins: number, games: number) => (games ? wins / games : null)
const gamesRecord = ({ wins, loses, draws }: CardStat) => `${wins}–${loses}${draws ? `–${draws}` : ''}`
/** `games` is absent from an API older than the field: no count, not a crash. */
const gameCount = (games?: GameRecord) => (games ? games.wins + games.loses + games.draws : '—')
const Scroll = ({ children }: { children: React.ReactNode }) => <div className="min-w-0 overflow-x-auto">{children}</div>
const Block = ({ title, stamp, children }: { title: string; stamp?: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-4">
    <div className="flex items-baseline gap-3 border-b border-line pb-2">
      <h3 className="uppercase text-ink">{title}</h3>
      {stamp ? <span className="ml-auto text-ink-muted signal-sm max-[720px]:hidden">{stamp}</span> : null}
    </div>
    {children}
  </div>
)

export const TournamentReport = ({ data }: { data: PlayerTournamentStats }) => {
  const t = useTranslations('PlayerStatistics.report')
  const locale = useLocale() === 'pt' ? 'pt' : 'en'
  const rate = (value: number | null) => formatRate(value, locale)
  const gameRate = (games?: GameRecord) => rate(games ? recordRate(games) : null)
  const cardLabel = (row: CardStat) => row.name ?? t('card', { id: row.id })
  const { tournaments, titles, record, turnOrder, matches, archetypes, matchups, cards } = data

  if (!tournaments)
    return (
      <Panel title={t('none')}>
        <p className="text-ink-dim body">{t('noneBody')}</p>
      </Panel>
    )

  const decks = (row: { players: number }) => <ShareCell value={row.players} max={tournaments}>{row.players}</ShareCell>

  return (
    <div className="flex flex-col gap-8">
      <StatGrid
        columns={3}
        items={[
          { label: t('tournaments'), value: tournaments, hint: t('titles', { count: titles }) },
          { label: t('matchRecord'), value: formatRecord(record), hint: t('games', { count: matches.games }) },
          { label: t('matchRate'), value: rate(recordRate(record)), hint: t('byesOut') },
          { label: t('gameRate'), value: gameRate(record.games), hint: record.games && t('games', { count: gameCount(record.games) }) },
          { label: t('first'), value: rate(ratio(turnOrder.first.wins, turnOrder.first.games)), hint: t('game1', { count: turnOrder.first.games }) },
          { label: t('second'), value: rate(ratio(turnOrder.second.wins, turnOrder.second.games)), hint: t('game1', { count: turnOrder.second.games }) },
        ]}
      />

      {archetypes.length ? (
        <Block title={t('decks')} stamp={t('decksStamp')}>
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <ShareStack title={t('deckShare')} meta={t('ofTournaments')} items={archetypes.map((row) => ({ label: row.archetype, share: row.share }))} othersLabel={t('others')} format={rate} />
            <WinRateBars title={t('winRate')} meta={t('matches')} rows={archetypes.map((row) => ({ label: row.archetype, winRate: row.winRate, note: formatRecord(row) }))} format={rate} />
          </div>
          <Scroll>
            <DataTable<ArchetypeStat>
              caption={t('byDeck')}
              rowKey={(row) => row.archetype}
              columns={[
                { key: 'archetype', label: t('cols.deck'), strong: true },
                { key: 'players', label: t('cols.tournaments'), numeric: true, render: decks },
                { key: 'tournamentWins', label: t('cols.titles'), numeric: true, render: (row) => row.tournamentWins ?? 0 },
                { key: 'record', label: t('cols.record'), numeric: true, render: (row) => <RecordBar {...row} /> },
                { key: 'winRate', label: t('cols.matchRate'), numeric: true, strong: true, render: (row) => rate(row.winRate) },
                { key: 'games', label: t('cols.games'), numeric: true, render: (row) => gameCount(row.games) },
                { key: 'gameRate', label: t('cols.gameRate'), numeric: true, strong: true, render: (row) => gameRate(row.games) },
              ]}
              rows={archetypes}
            />
          </Scroll>
        </Block>
      ) : null}

      {matchups.length ? (
        <Block title={t('matchups')} stamp={t('matchupsStamp')}>
          <Scroll>
            <DataTable<MatchupStat>
              caption={t('matchupsCaption')}
              rowKey={(row) => `${row.archetype}-${row.opponent}`}
              columns={[
                { key: 'archetype', label: t('cols.deck'), strong: true },
                { key: 'opponent', label: t('cols.opponent') },
                { key: 'record', label: t('cols.record'), numeric: true, render: (row) => <RecordBar {...row} /> },
                { key: 'winRate', label: t('cols.matchRate'), numeric: true, strong: true, render: (row) => rate(recordRate(row)) },
                { key: 'gameRate', label: t('cols.gameRate'), numeric: true, strong: true, render: (row) => gameRate(row.games) },
                { key: 'matches', label: t('cols.matches'), numeric: true, render: (row) => row.wins + row.loses + row.draws },
              ]}
              rows={matchups}
            />
          </Scroll>
        </Block>
      ) : null}

      {cards.main.length || cards.extra.length ? (
        <Block title={t('cards')} stamp={t('cardsStamp')}>
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <Scroll>
              <DataTable<CardStat>
                caption={t('main')}
                rowKey={(row) => row.id}
                columns={[
                  { key: 'name', label: t('cols.card'), strong: true, render: cardLabel },
                  { key: 'decks', label: t('cols.tournaments'), numeric: true, render: (row) => <ShareCell value={row.decks} max={tournaments}>{`${row.decks} / ${tournaments}`}</ShareCell> },
                  { key: 'copies', label: t('cols.copies'), numeric: true },
                  { key: 'side', label: t('cols.side'), numeric: true, render: (row) => row.side.decks },
                  { key: 'record', label: t('cols.games'), numeric: true, render: gamesRecord },
                ]}
                rows={cards.main.slice(0, 20)}
              />
            </Scroll>
            <Scroll>
              <DataTable<CardStat>
                caption={t('extra')}
                rowKey={(row) => row.id}
                columns={[
                  { key: 'name', label: t('cols.card'), strong: true, render: cardLabel },
                  { key: 'decks', label: t('cols.tournaments'), numeric: true, render: (row) => <ShareCell value={row.decks} max={tournaments}>{`${row.decks} / ${tournaments}`}</ShareCell> },
                  { key: 'record', label: t('cols.games'), numeric: true, render: gamesRecord },
                ]}
                rows={cards.extra.slice(0, 10)}
              />
            </Scroll>
          </div>
        </Block>
      ) : null}
    </div>
  )
}
