// A server component, like the other tabs: DataTable and the charts have no client code, so the
// formatter functions never cross a client boundary. TopCutCard is the one client leaf.
import { useLocale, useTranslations } from 'next-intl'
import { formatRate, formatRecord } from '@omega/tournament/labels'
import { Conversion, RecordBar, ShareCell, ShareStack, TurnSplit, WinRateBars } from '@omega/tournament/stats-charts'
import { TopCutCard } from '@omega/tournament/top-cut-card'
import { DataTable } from '@ui/data-table'
import { RailHead } from '@ui/rail-head/rail-head.component'
import { StatGrid } from '@ui/stat-grid'
import type { ArchetypeStat, CardStat, MatchupStat, Standing, TournamentStats, TournamentSummary } from '@utils/types'

/** Top 8 by final rank; Top 4 under 16 entrants, where a Top 8 is half the field. */
const topCutOf = (players: number) => (players < 16 ? 4 : 8)

/** Each archetype's share of the field and of the top cut, by the decks in the standings. */
const conversionRows = (archetypes: ArchetypeStat[], standings: Standing[], top: number) => {
  const cut = standings.filter((s) => s.rank <= top)
  return archetypes.map((row) => ({
    label: row.archetype,
    field: row.share,
    top: cut.length ? cut.filter((s) => s.deck?.archetype === row.archetype).length / cut.length : 0,
  }))
}

/** Games won and lost by the decks running a card; draws only when there are any. */
const gamesRecord = ({ wins, loses, draws }: CardStat) => `${wins}–${loses}${draws ? `–${draws}` : ''}`

/** Tables scroll sideways on a phone rather than squeezing the columns. */
const Scroll = ({ children }: { children: React.ReactNode }) => <div className="min-w-0 overflow-x-auto">{children}</div>

/** `live`: the API holds back decklists until the end, so archetypes, matchups and cards are empty. */
export const Stats = ({ tournament, stats, live, standings }: { tournament: TournamentSummary; stats: TournamentStats; live: boolean; standings: Standing[] }) => {
  const { players } = tournament
  const t = useTranslations('Tournaments')
  const locale = useLocale()
  const { matches, archetypes, matchups, cards } = stats
  const play = matches.onThePlay
  const unclassified = players - archetypes.reduce((sum, row) => sum + row.players, 0)
  const decks = (card: CardStat) => <ShareCell value={card.decks} max={players}>{`${card.decks} / ${players}`}</ShareCell>
  const rate = (value: number | null) => formatRate(value, locale)
  const top = topCutOf(players)
  // A finished cut needs decks in the standings; with none classified there is nothing to compare.
  const conversion = conversionRows(archetypes, standings, top)
  const showConversion = !live && conversion.some((row) => row.top > 0)

  return (
    <>
      {!live && standings.some((s) => s.rank <= top && s.deck) ? (
        <TopCutCard tournament={tournament} standings={standings} archetypes={archetypes} top={top} />
      ) : null}
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
            value: play.games ? formatRate(play.wins / play.games, locale) : '—',
            tone: 'cyan',
            hint: t('stats.onThePlayHint', { wins: play.wins, games: play.games }),
          },
          {
            label: t('stats.archetypes'),
            value: live ? '—' : archetypes.length,
            hint: live ? t('standings.deckHidden') : unclassified ? t('stats.archetypesHint', { count: unclassified }) : t('stats.allClassified'),
          },
        ]}
      />
      {play.games ? (
        <TurnSplit
          title={t('stats.turnOrder')}
          meta={t('stats.turnOrderMeta', { games: play.games })}
          first={play.wins / play.games}
          firstLabel={t('stats.goingFirst')}
          secondLabel={t('stats.goingSecond')}
          format={rate}
        />
      ) : null}

      <RailHead num="01" label={t('stats.metagame')} stamp={t('stats.metagameStamp', { count: players })} className="px-0" />
      {archetypes.length ? (
        <>
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <ShareStack
              title={t('stats.share')}
              meta={t('stats.shareSub')}
              items={archetypes.map((row) => ({ label: row.archetype, share: row.share }))}
              othersLabel={t('stats.others')}
              format={rate}
            />
            <WinRateBars
              title={t('stats.winRateChart')}
              meta={t('stats.winRateChartSub')}
              rows={archetypes.map((row) => ({ label: row.archetype, winRate: row.winRate, note: formatRecord(row) }))}
              format={rate}
            />
          </div>
          <Scroll>
            <DataTable<ArchetypeStat>
              caption={t('stats.recordCaption')}
              rowKey={(row) => row.archetype}
              columns={[
                { key: 'archetype', label: t('stats.archetype'), strong: true },
                { key: 'players', label: t('stats.players'), numeric: true, render: (row) => <ShareCell value={row.players} max={players}>{row.players}</ShareCell> },
                { key: 'record', label: t('stats.record'), numeric: true, render: (row) => <RecordBar {...row} /> },
                { key: 'winRate', label: t('stats.winRate'), numeric: true, strong: true, render: (row) => formatRate(row.winRate, locale) },
              ]}
              rows={archetypes}
            />
          </Scroll>
        </>
      ) : (
        <p className="text-sm text-ink-muted">{t(live ? 'stats.liveHidden' : 'stats.noArchetypes')}</p>
      )}

      {showConversion ? (
        <>
          <RailHead num="02" label={t('stats.conversion')} stamp={t('stats.conversionStamp', { top })} className="px-0" />
          <Conversion
            title={t('stats.conversionTitle', { top })}
            rows={conversion}
            fieldLabel={t('stats.field')}
            topLabel={t('stats.topCut', { top })}
            note={t('stats.conversionNote', { top })}
            format={rate}
          />
        </>
      ) : null}

      {matchups.length ? (
        <>
          <RailHead num={showConversion ? '03' : '02'} label={t('stats.matchups')} stamp={t('stats.mirrors')} className="px-0" />
          <Scroll>
            <DataTable<MatchupStat>
              caption={t('stats.matchupsCaption')}
              rowKey={(row) => `${row.archetype}-${row.opponent}`}
              columns={[
                { key: 'archetype', label: t('stats.archetype'), strong: true },
                { key: 'opponent', label: t('stats.opponent') },
                { key: 'record', label: t('stats.record'), numeric: true, render: (row) => <RecordBar {...row} /> },
                { key: 'matches', label: t('stats.matches'), numeric: true, render: (row) => row.wins + row.loses + row.draws },
              ]}
              rows={matchups}
            />
          </Scroll>
        </>
      ) : null}

      {cards.main.length || cards.extra.length ? (
        <>
          <RailHead num={`0${2 + Number(showConversion) + Number(matchups.length > 0)}`} label={t('stats.cards')} stamp={t('stats.cardsStamp')} className="px-0" />
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
