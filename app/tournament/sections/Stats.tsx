import { CardArt } from '@omega/card-art'
import { formatNumber, formatRate, formatRecord } from '@omega/tournament/labels'
import { StatGrid } from '@omega/tournament/stat-grid'
import { Eyebrow } from '@ui/eyebrow/eyebrow'
import type { ArchetypeStat, TournamentStats } from '@utils/types'
import { CardBoard } from './CardBoard'

/** Data table with a mono head. Scrolls sideways on a phone rather than squeezing the columns. */
const Table = ({ head, children }: { head: string[]; children: React.ReactNode }) => (
  <div className="mt-3 overflow-x-auto border border-line">
    <table className="w-full min-w-135 border-collapse">
      <thead>
        <tr className="border-b border-line bg-ground-soft">
          {head.map((label, index) => (
            <th
              key={label}
              scope="col"
              className={`px-3.5 py-2.5 text-ink-muted signal ${index ? 'text-right' : 'text-left'}`}
            >
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  </div>
)

const CELL = 'px-3.5 py-2.5 text-right text-ink-dim mono-data tabular-nums'

/** Archetype with the card the API picked as its face. */
const ArchetypeName = ({ row }: { row: ArchetypeStat }) => (
  <th scope="row" className="px-3.5 py-2.5 text-left">
    <span className="flex min-w-0 items-center gap-2.5">
      {row.artCardId ? (
        <CardArt
          art={{ id: row.artCardId, name: row.archetype }}
          alt=""
          sizes="28px"
          className="size-7 shrink-0 border border-line"
        />
      ) : null}
      <span className="truncate text-ink body-strong">{row.archetype}</span>
    </span>
  </th>
)

/** Share as a bar plus the number, so the field reads at a glance without a chart library. */
const Share = ({ share }: { share: number }) => (
  <td className={CELL}>
    <span className="flex items-center justify-end gap-2">
      <span aria-hidden className="hidden h-1.5 w-12 bg-surface-300 lg:block">
        <span className="block h-full bg-gold" style={{ width: `${Math.min(100, Math.round(share * 100))}%` }} />
      </span>
      {formatRate(share)}
    </span>
  </td>
)

/** One match between two archetypes says nothing. Two is still thin, but it is a pattern. */
const MIN_MATCHES = 2

export const Stats = ({ stats, players }: { stats: TournamentStats; players: number }) => {
  const { matches, archetypes, matchups } = stats
  // The API splits by card type so extra-deck staples keep their own top list; the board filters by zone instead.
  const cards = [...stats.cards.main, ...stats.cards.extra].sort((a, b) => b.decks - a.decks)
  const play = matches.onThePlay
  const played = matchups.filter((row) => row.wins + row.loses + row.draws >= MIN_MATCHES)
  const hidden = matchups.length - played.length

  return (
    <>
      <StatGrid
        items={[
          { label: 'Matches', value: formatNumber(matches.total) },
          { label: 'Played', value: formatNumber(matches.played) },
          { label: 'Unplayed', value: formatNumber(matches.unplayed), tone: matches.unplayed ? 'gold' : undefined },
          { label: 'Draws', value: formatNumber(matches.draws) },
          { label: 'Games', value: formatNumber(matches.games) },
          { label: 'Went to game 3', value: formatNumber(matches.threeGameMatches), tone: 'cyan' },
          {
            label: 'Going first won',
            value: play?.games ? formatRate(play.wins / play.games) : '—',
            tone: 'gold',
          },
          { label: 'Game 1s counted', value: play?.games ? formatNumber(play.games) : '—' },
        ]}
      />

      <p className="mt-2.5 text-ink-muted signal">
        &ldquo;Going first&rdquo; covers game 1 only: the stored field carries a bit per game, but the later ones
        don&apos;t reproduce.
      </p>

      <section className="pt-section">
        <Eyebrow meta={`${formatNumber(players)} entrants`}>Archetypes</Eyebrow>
        {archetypes.length ? (
          <Table head={['Archetype', 'Players', 'Share', 'W–L–D', 'Win rate']}>
            {archetypes.map((row) => (
              <tr key={row.archetype} className="border-b border-line last:border-b-0">
                <ArchetypeName row={row} />
                <td className={CELL}>{row.players}</td>
                <Share share={row.share} />
                <td className={CELL}>{formatRecord(row)}</td>
                <td className={`${CELL} text-gold`}>{formatRate(row.winRate)}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <p className="mt-3 text-ink-muted body-sm">No entrant&apos;s deck matched a known archetype.</p>
        )}
        <p className="mt-2.5 text-ink-muted signal">
          Every deck in the tournament is counted, not a top cut. Archetype is a heuristic — a hybrid deck is named
          after its bigger half. Byes are not counted as match wins here.
        </p>
      </section>

      {played.length ? (
        <section className="pt-section">
          <Eyebrow tone="neutral" meta={`Mirrors left out · ${formatNumber(hidden)} single-match pairs hidden`}>
            Matchups
          </Eyebrow>
          <Table head={['Archetype', 'Against', 'W–L–D']}>
            {played.map((row) => (
              <tr key={`${row.archetype}-${row.opponent}`} className="border-b border-line last:border-b-0">
                <th scope="row" className="px-3.5 py-2.5 text-left text-ink body-strong">
                  {row.archetype}
                </th>
                <td className="px-3.5 py-2.5 text-right text-ink-dim body-sm">{row.opponent}</td>
                <td className={CELL}>{formatRecord(row)}</td>
              </tr>
            ))}
          </Table>
        </section>
      ) : null}

      {cards.length ? (
        <section className="pt-section">
          <Eyebrow tone="neutral" meta={`Top ${formatNumber(cards.length)} by decks`}>
            Most played cards
          </Eyebrow>
          <CardBoard cards={cards} />
          <p className="mt-2.5 text-ink-muted signal">
            The record is of every deck carrying the card, in games, whether or not it was ever drawn — tournament
            duels have no play log.
          </p>
        </section>
      ) : null}
    </>
  )
}
