'use client'

/**
 * One duelist's ranked record (GET /statistics/players/:id `record`): match and game win rate overall,
 * per deck and per matchup, mirrors in. Drawn with the Tournaments tab's pieces; the meta report's
 * share, mirrors, deep dive and card sections don't mean anything for one player.
 */

import { formatRate, formatRecord, recordRate } from '@omega/tournament/labels'
import { RecordBar, ShareStack, WinRateBars } from '@omega/tournament/stats-charts'
import { DataTable } from '@ui/data-table'
import { Notice } from '@ui/notice'
import { Panel } from '@ui/panel'
import { StatGrid } from '@ui/stat-grid'
import { Section, TurnBlock } from '@app/statistics/MetaStatistics'
import { Art, faceOf, nameOf, num, pct, THIRDS } from '@app/statistics/DeepDive'
import { archKey, type PersonalRecord, type PlayerStatisticsData, type Tally3 } from '@utils/statistics'

type DeckRow = PersonalRecord['decks'][number]
type MatchupRow = PersonalRecord['matchups'][number]

/** The tournament helpers spell it `loses`. */
const tour = ({ wins, losses, draws }: Tally3) => ({ wins, loses: losses, draws })
const played = ({ wins, losses, draws }: Tally3) => wins + losses + draws
const rate = (t: Tally3) => formatRate(recordRate(tour(t)), 'en')
const MATCHUPS = 20
const Scroll = ({ children }: { children: React.ReactNode }) => <div className="min-w-0 overflow-x-auto">{children}</div>

export const RankedReport = ({ data }: { data: PlayerStatisticsData }) => {
  const { record, turnOrder, season } = data
  const byKey = new Map(data.archetypes.map((a) => [archKey(a.archetype), a]))
  const deckMatches = record.decks.reduce((n, row) => n + played(row.matches), 0)

  const closed = season?.endsAt ? (
    <div className="cut notch mt-6 flex items-center gap-3 px-5 py-4 [--cut:var(--cut-md)] [--edge:var(--color-line-mid)] [--fill:var(--color-surface-100)]">
      <span className="size-2 flex-none bg-gold" />
      <span className="text-ink-dim body">{season.label} is closed. These are its final numbers.</span>
    </div>
  ) : null

  const glance = (
    <Section num="01" label="At a glance" stamp="Ranked · mirrors in">
      <StatGrid
        columns={5}
        items={[
          { label: 'Match record', value: formatRecord(tour(record.matches)), hint: `${num(played(record.games))} games` },
          { label: 'Match win rate', value: rate(record.matches), hint: 'Mirrors in' },
          { label: 'Game win rate', value: rate(record.games), hint: 'Every game, mirrors in' },
          { label: 'Going first', value: pct(turnOrder.all.first.winRate), hint: `${num(turnOrder.all.first.games)} games` },
          { label: 'Going second', value: pct(turnOrder.all.second.winRate), hint: `${num(turnOrder.all.second.games)} games` },
        ]}
      />
    </Section>
  )

  if (!data.matches.analyzed)
    return (
      <>
        {closed}
        {glance}
        <Panel title="No ranked games yet" meta="Nothing played" className="mt-6">
          <p className="text-ink-dim body">Statistics appear once this duelist finishes a ranked match here.</p>
        </Panel>
      </>
    )

  return (
    <>
      {closed}
      {glance}

      {record.decks.length ? (
        <Section num="02" label="Decks" stamp="By matches · mirrors in">
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <ShareStack
              title="Deck share"
              meta="Of their matches"
              items={record.decks.map((row) => ({ label: nameOf(row), share: deckMatches ? played(row.matches) / deckMatches : 0 }))}
              othersLabel="Others"
              format={(share) => formatRate(share, 'en')}
            />
            <WinRateBars
              title="Match win rate"
              meta="Matches"
              rows={record.decks.map((row) => ({ label: nameOf(row), winRate: recordRate(tour(row.matches)), note: formatRecord(tour(row.matches)) }))}
              format={(value) => formatRate(value, 'en')}
            />
          </div>
          <Scroll>
            <DataTable<DeckRow>
              caption="Record by deck"
              rowKey={(row) => archKey(row.archetype)}
              columns={[
                {
                  key: 'deck',
                  label: 'Deck',
                  strong: true,
                  render: (row) => (
                    <span className="flex items-center gap-2.5">
                      <Art card={faceOf(byKey.get(archKey(row.archetype)) ?? { cards: [] })} size={32} className="size-8" />
                      {nameOf(row)}
                    </span>
                  ),
                },
                { key: 'matches', label: 'Matches', numeric: true, render: (row) => num(played(row.matches)) },
                { key: 'record', label: 'Record', numeric: true, render: (row) => <RecordBar {...tour(row.matches)} /> },
                { key: 'matchRate', label: 'Match WR', numeric: true, strong: true, render: (row) => rate(row.matches) },
                { key: 'games', label: 'Games', numeric: true, render: (row) => num(played(row.games)) },
                { key: 'gameRate', label: 'Game WR', numeric: true, strong: true, render: (row) => rate(row.games) },
              ]}
              rows={record.decks}
            />
          </Scroll>
        </Section>
      ) : null}

      {record.matchups.length ? (
        <Section num="03" label="Matchups" stamp="Their deck first · mirrors in">
          <Scroll>
            <DataTable<MatchupRow>
              caption={record.matchups.length > MATCHUPS ? `Their deck against the opponent's · top ${MATCHUPS} of ${record.matchups.length}` : "Their deck against the opponent's"}
              rowKey={(row) => `${archKey(row.archetype)}:${archKey(row.opponent)}`}
              columns={[
                { key: 'deck', label: 'Deck', strong: true, render: (row) => nameOf(row) },
                { key: 'opponent', label: 'Opponent', render: (row) => nameOf({ name: row.opponentName, archetype: row.opponent }) },
                { key: 'record', label: 'Record', numeric: true, render: (row) => <RecordBar {...tour(row.matches)} /> },
                { key: 'matchRate', label: 'Match WR', numeric: true, strong: true, render: (row) => rate(row.matches) },
                { key: 'gameRate', label: 'Game WR', numeric: true, strong: true, render: (row) => rate(row.games) },
                { key: 'matches', label: 'Matches', numeric: true, render: (row) => num(played(row.matches)) },
              ]}
              rows={record.matchups.slice(0, MATCHUPS)}
            />
          </Scroll>
        </Section>
      ) : null}

      <Section num="04" label="Turn order" stamp="Every game · mirrors and unknown decks in">
        <div className={THIRDS}>
          <TurnBlock title="All games" meta="Mirrors in" split={turnOrder.all} player />
          <TurnBlock title="Game 1" meta="Before siding" split={turnOrder.game1} player />
          <TurnBlock title="Games 2–3" meta="After siding" split={turnOrder.postSide} player />
        </div>
      </Section>

      <section aria-label="Method" className="mt-12 min-[720px]:mt-16">
        <Notice title="How it's counted" mark>
          Only this duelist&apos;s side. A match counts once, a game once per game played; mirrors count, a draw is not a win.
          Decks nobody could name count in the totals only. Read live from the duels, the newest 1000 matches at most.
        </Notice>
      </section>
    </>
  )
}
