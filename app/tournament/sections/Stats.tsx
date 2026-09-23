import { useTranslations } from 'next-intl'
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
  const t = useTranslations('Tournaments.stats')
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
          { label: t('matches'), value: formatNumber(matches.total) },
          { label: t('played'), value: formatNumber(matches.played) },
          { label: t('unplayed'), value: formatNumber(matches.unplayed), tone: matches.unplayed ? 'gold' : undefined },
          { label: t('draws'), value: formatNumber(matches.draws) },
          { label: t('games'), value: formatNumber(matches.games) },
          { label: t('wentToGame3'), value: formatNumber(matches.threeGameMatches), tone: 'cyan' },
          {
            label: t('wonGoingFirst'),
            value: play?.games ? formatRate(play.wins / play.games) : '—',
            tone: 'gold',
          },
          { label: t('game1sCounted'), value: play?.games ? formatNumber(play.games) : '—' },
        ]}
      />

      <p className="mt-2.5 text-ink-muted signal">{t('goingFirstNote')}</p>

      <section className="pt-section">
        <Eyebrow meta={t('entrants', { count: players })}>{t('archetypes')}</Eyebrow>
        {archetypes.length ? (
          <Table head={[t('archetype'), t('players'), t('share'), t('record'), t('winRate')]}>
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
          <p className="mt-3 text-ink-muted body-sm">{t('noArchetypes')}</p>
        )}
        <p className="mt-2.5 text-ink-muted signal">{t('archetypesNote')}</p>
      </section>

      {played.length ? (
        <section className="pt-section">
          <Eyebrow tone="neutral" meta={t('matchupsMeta', { count: hidden })}>
            {t('matchups')}
          </Eyebrow>
          <Table head={[t('archetype'), t('against'), t('record')]}>
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
          <Eyebrow tone="neutral" meta={t('topCardsMeta', { count: cards.length })}>
            {t('topCards')}
          </Eyebrow>
          <CardBoard cards={cards} />
          <p className="mt-2.5 text-ink-muted signal">{t('topCardsNote')}</p>
        </section>
      ) : null}
    </>
  )
}
