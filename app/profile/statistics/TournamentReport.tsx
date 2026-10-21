'use client'

/**
 * One duelist's tournaments (GET /tournaments/players/:id/stats), drawn with the tournament page's
 * charts and tables. Client for the same reason as that tab: the tables take formatter functions.
 * Decklists only: tournament duels have no play log, so a card's record is "games with it in the list".
 */

import { formatRate, formatRecord, recordRate } from '@omega/tournament/labels'
import { RecordBar, ShareCell, ShareStack, WinRateBars } from '@omega/tournament/stats-charts'
import { DataTable } from '@ui/data-table'
import { Panel } from '@ui/panel'
import { StatGrid } from '@ui/stat-grid'
import { Section } from '@app/statistics/MetaStatistics'
import type { ArchetypeStat, CardStat, GameRecord, MatchupStat, PlayerTournamentStats } from '@utils/types'

const rate = (value: number | null) => formatRate(value, 'en')
const ratio = (wins: number, games: number) => (games ? wins / games : null)
const gamesRecord = ({ wins, loses, draws }: CardStat) => `${wins}–${loses}${draws ? `–${draws}` : ''}`
const gameCount = ({ wins, loses, draws }: GameRecord) => wins + loses + draws
const cardLabel = (row: CardStat) => row.name ?? `Card #${row.id}`
const Scroll = ({ children }: { children: React.ReactNode }) => <div className="min-w-0 overflow-x-auto">{children}</div>

export const TournamentReport = ({ data, first = 1 }: { data: PlayerTournamentStats; first?: number }) => {
  const { tournaments, titles, record, turnOrder, matches, archetypes, matchups, cards } = data
  const n = (k: number) => String(first + k).padStart(2, '0')

  if (!tournaments)
    return (
      <Section num={n(0)} label="Tournaments">
        <Panel title="No tournaments yet" meta="Finished only">
          <p className="text-ink-dim body">Statistics appear once a tournament this duelist entered is over.</p>
        </Panel>
      </Section>
    )

  const decks = (row: { players: number }) => <ShareCell value={row.players} max={tournaments}>{row.players}</ShareCell>

  return (
    <>
      <Section num={n(0)} label="Tournaments" stamp="Finished tournaments · their matches only">
        <StatGrid
          columns={6}
          items={[
            { label: 'Tournaments', value: tournaments, hint: `${titles} ${titles === 1 ? 'title' : 'titles'}` },
            { label: 'Match record', value: formatRecord(record), hint: `${matches.games} games` },
            { label: 'Match win rate', value: rate(recordRate(record)), hint: 'Matches, byes out' },
            { label: 'Game win rate', value: rate(recordRate(record.games)), hint: `${gameCount(record.games)} games` },
            { label: 'Going first', value: rate(ratio(turnOrder.first.wins, turnOrder.first.games)), hint: `Game 1 · ${turnOrder.first.games} games` },
            { label: 'Going second', value: rate(ratio(turnOrder.second.wins, turnOrder.second.games)), hint: `Game 1 · ${turnOrder.second.games} games` },
          ]}
        />
      </Section>

      {archetypes.length ? (
        <Section num={n(1)} label="Decks" stamp="By tournaments entered">
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <ShareStack title="Deck share" meta="Of their tournaments" items={archetypes.map((row) => ({ label: row.archetype, share: row.share }))} othersLabel="Others" format={rate} />
            <WinRateBars title="Win rate" meta="Matches" rows={archetypes.map((row) => ({ label: row.archetype, winRate: row.winRate, note: formatRecord(row) }))} format={rate} />
          </div>
          <Scroll>
            <DataTable<ArchetypeStat>
              caption="Record by deck"
              rowKey={(row) => row.archetype}
              columns={[
                { key: 'archetype', label: 'Deck', strong: true },
                { key: 'players', label: 'Tournaments', numeric: true, render: decks },
                { key: 'tournamentWins', label: 'Titles', numeric: true, render: (row) => row.tournamentWins ?? 0 },
                { key: 'record', label: 'Record', numeric: true, render: (row) => <RecordBar {...row} /> },
                { key: 'winRate', label: 'Match WR', numeric: true, strong: true, render: (row) => rate(row.winRate) },
                { key: 'games', label: 'Games', numeric: true, render: (row) => gameCount(row.games) },
                { key: 'gameRate', label: 'Game WR', numeric: true, strong: true, render: (row) => rate(recordRate(row.games)) },
              ]}
              rows={archetypes}
            />
          </Scroll>
        </Section>
      ) : null}

      {matchups.length ? (
        <Section num={n(2)} label="Matchups" stamp="Their deck first · mirrors in">
          <Scroll>
            <DataTable<MatchupStat>
              caption="Their deck against the opponent's"
              rowKey={(row) => `${row.archetype}-${row.opponent}`}
              columns={[
                { key: 'archetype', label: 'Deck', strong: true },
                { key: 'opponent', label: 'Opponent' },
                { key: 'record', label: 'Record', numeric: true, render: (row) => <RecordBar {...row} /> },
                { key: 'winRate', label: 'Match WR', numeric: true, strong: true, render: (row) => rate(recordRate(row)) },
                { key: 'gameRate', label: 'Game WR', numeric: true, strong: true, render: (row) => rate(recordRate(row.games)) },
                { key: 'matches', label: 'Matches', numeric: true, render: (row) => row.wins + row.loses + row.draws },
              ]}
              rows={matchups}
            />
          </Scroll>
        </Section>
      ) : null}

      {cards.main.length || cards.extra.length ? (
        <Section num={n(3)} label="Cards" stamp="Decklists · record of games with the card in the list">
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <Scroll>
              <DataTable<CardStat>
                caption="Main deck"
                rowKey={(row) => row.id}
                columns={[
                  { key: 'name', label: 'Card', strong: true, render: cardLabel },
                  { key: 'decks', label: 'Tournaments', numeric: true, render: (row) => <ShareCell value={row.decks} max={tournaments}>{`${row.decks} / ${tournaments}`}</ShareCell> },
                  { key: 'copies', label: 'Copies', numeric: true },
                  { key: 'side', label: 'In side', numeric: true, render: (row) => row.side.decks },
                  { key: 'record', label: 'Games', numeric: true, render: gamesRecord },
                ]}
                rows={cards.main.slice(0, 20)}
              />
            </Scroll>
            <Scroll>
              <DataTable<CardStat>
                caption="Extra deck"
                rowKey={(row) => row.id}
                columns={[
                  { key: 'name', label: 'Card', strong: true, render: cardLabel },
                  { key: 'decks', label: 'Tournaments', numeric: true, render: (row) => <ShareCell value={row.decks} max={tournaments}>{`${row.decks} / ${tournaments}`}</ShareCell> },
                  { key: 'record', label: 'Games', numeric: true, render: gamesRecord },
                ]}
                rows={cards.extra.slice(0, 10)}
              />
            </Scroll>
          </div>
        </Section>
      ) : null}
    </>
  )
}
