// A server component, like the other tabs. TopCutCard is the one client leaf.
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { CardArt } from '@omega/card-art'
import { formatRate, formatRecord } from '@omega/tournament/labels'
import { TopCutCard } from '@omega/tournament/top-cut-card'
import { Panel } from '@ui/panel'
import { RailHead } from '@ui/rail-head/rail-head.component'
import { StatGrid } from '@ui/stat-grid'
import type { ArchetypeStat, CardStat, MatchupStat, Standing, TournamentStats, TournamentSummary } from '@utils/types'
import { FRAME_BG, META, SERIES, type Frames } from '../helpers'

/** Top 8 by final rank; Top 4 under 16 entrants, where a Top 8 is half the field. */
const topCutOf = (players: number) => (players < 16 ? 4 : 8)

const TH = 'px-3 py-2.5 text-left font-normal whitespace-nowrap bg-surface-200 border-b border-line text-ink-muted signal'
const TD = 'px-3 py-3 border-b border-line align-middle'
const NUM = 'text-right tabular-nums'
const MX = 'h-13 w-21 border border-line text-center'

/** Games won and lost by the decks running a card; draws only when there are any. */
const gamesRecord = ({ wins, loses, draws }: CardStat) => `${wins}–${loses}${draws ? `–${draws}` : ''}`

/** `rec[a|b]` from `a`'s side, filled both ways so the matrix reads from either row. */
const recordsOf = (matchups: MatchupStat[]) => {
  const rec = new Map<string, { wins: number; loses: number; draws: number }>()
  for (const m of matchups) {
    rec.set(`${m.archetype}|${m.opponent}`, m)
    if (!rec.has(`${m.opponent}|${m.archetype}`)) rec.set(`${m.opponent}|${m.archetype}`, { wins: m.loses, loses: m.wins, draws: m.draws })
  }
  return rec
}

const Head = ({ title, meta }: { title: string; meta?: React.ReactNode }) => (
  <div className="flex flex-wrap items-baseline justify-between gap-3 pb-2">
    <span className="text-ink-muted signal">{title}</span>
    {meta ? <span className={META}>{meta}</span> : null}
  </div>
)

/** A card name with its frame color bar, for the card tables. */
const CardName = ({ card, frames, fallback }: { card: CardStat; frames: Frames; fallback: string }) => {
  const frame = frames[card.id]
  return (
    <span className="flex items-center gap-2.5">
      <span aria-hidden className={twMerge('h-4 w-0.75 shrink-0', frame ? FRAME_BG[frame] : 'bg-line-mid')} />
      <Link href={`/wiki/card/${card.id}`} className="text-ink body-sm hover:text-cyan">
        {card.name ?? fallback}
      </Link>
    </span>
  )
}

const Decks = ({ decks, players }: { decks: number; players: number }) => (
  <span className="flex items-center gap-2">
    <span aria-hidden className="block h-1.25 w-16 bg-surface-300">
      <span className="block h-full bg-cyan" style={{ width: `${(decks / players) * 100}%` }} />
    </span>
    <span className="text-ink-dim data">
      {decks} / {players}
    </span>
  </span>
)

type StatsProps = { tournament: TournamentSummary; stats: TournamentStats; standings: Standing[]; frames: Frames; live: boolean }

/** `live`: the API holds back decklists until the end, so archetypes, matchups and cards are empty. */
export const Stats = ({ tournament, stats, standings, frames, live }: StatsProps) => {
  const t = useTranslations('Tournaments')
  const locale = useLocale()
  const { players } = tournament
  const { matches, archetypes, matchups, cards } = stats
  const play = matches.onThePlay
  const rate = (value: number | null) => formatRate(value, locale)
  const fallback = (card: CardStat) => t('stats.fallbackName', { id: card.id })
  const unclassified = players - archetypes.reduce((sum, row) => sum + row.players, 0)
  const top = topCutOf(players)
  const cut = standings.filter((standing) => standing.rank <= top)
  const topShare = (row: ArchetypeStat) => (cut.length ? cut.filter((standing) => standing.deck?.archetype === row.archetype).length / cut.length : 0)
  const showConversion = !live && archetypes.some((row) => topShare(row) > 0)
  const color = (i: number) => SERIES[i % SERIES.length]
  const rec = recordsOf(matchups)

  // Sections are numbered in the order they appear; an empty one is left out.
  const sections = [archetypes.length && 'meta', play.games && 'first', matchups.length && 'matchups', (cards.main.length || cards.extra.length) && 'cards'].filter(Boolean)
  const num = (key: string) => String(sections.indexOf(key) + 1).padStart(2, '0')

  return (
    <>
      {!live && standings.some((standing) => standing.rank <= top && standing.deck) ? (
        <TopCutCard tournament={tournament} standings={standings} archetypes={archetypes} top={top} />
      ) : null}

      <StatGrid
        items={[
          { label: t('stats.played'), value: `${matches.played} / ${matches.total}`, hint: t('stats.playedHint', { unplayed: matches.unplayed, draws: matches.draws }) },
          { label: t('stats.games'), value: matches.games, hint: t('stats.gamesHint', { count: matches.threeGameMatches }) },
          {
            label: t('stats.onThePlay'),
            value: play.games ? rate(play.wins / play.games) : '—',
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

      {archetypes.length ? (
        <section aria-label={t('stats.metagame')} className="flex flex-col gap-4">
          <RailHead num={num('meta')} label={t('stats.metagame')} stamp={t('stats.metagameStamp', { count: players })} className="px-0" />
          <Panel label={t('stats.share')} className="flex flex-col gap-4">
            <Head title={t('stats.share')} meta={t('stats.shareSub')} />
            <div role="img" aria-label={archetypes.map((row) => `${row.archetype} ${rate(row.share)}`).join(', ')} className="flex h-18 gap-0.75">
              {archetypes.map((row, i) => (
                <div
                  key={row.archetype}
                  style={{ flex: `${row.players} 1 0`, boxShadow: `inset 0 -4px 0 ${color(i)}` }}
                  className="relative flex min-w-0 flex-col items-start justify-end gap-1 overflow-hidden bg-surface-200 px-2.5 py-2"
                >
                  {row.artCardId ? (
                    <CardArt art={{ id: row.artCardId, name: row.archetype }} alt="" sizes="240px" className="absolute inset-0 opacity-35" />
                  ) : (
                    <span aria-hidden className="dots absolute inset-0" />
                  )}
                  <span className="relative text-ink stat text-xl">{rate(row.share)}</span>
                  <span className="relative max-w-full truncate text-ink-dim signal-sm">{row.archetype}</span>
                </div>
              ))}
            </div>
            <span className="text-ink-muted caption">{t('charts.shareNote')}</span>
          </Panel>

          <div className={twMerge('grid gap-6', showConversion && 'min-[980px]:grid-cols-2')}>
            <Panel label={t('charts.winRate')} className="flex flex-col gap-1.5">
              <Head title={t('charts.winRate')} meta={t('charts.winRateSub')} />
              {archetypes.map((row, i) => {
                const wr = row.winRate
                return (
                  <div key={row.archetype} className="grid grid-cols-[minmax(0,150px)_minmax(0,1fr)_64px_64px] items-center gap-3 border-b border-line py-2.5">
                    <span className="flex min-w-0 items-center gap-2">
                      <span aria-hidden className="size-2 shrink-0" style={{ background: color(i) }} />
                      <span className="truncate text-ink body-sm">{row.archetype}</span>
                    </span>
                    <span aria-hidden className="relative h-2.5 bg-surface-300">
                      {wr !== null ? (
                        <span className={twMerge('absolute inset-y-0 left-0', wr >= 0.5 ? 'bg-win' : 'bg-loss')} style={{ width: `${Math.max(wr * 100, 1)}%` }} />
                      ) : null}
                      <span className="absolute -inset-y-1 left-1/2 w-px bg-line-strong" />
                    </span>
                    <span className={twMerge(NUM, 'text-ink data')}>{rate(wr)}</span>
                    <span className={twMerge(NUM, 'text-ink-muted data')}>{formatRecord(row)}</span>
                  </div>
                )
              })}
            </Panel>

            {showConversion ? (
              <Panel label={t('charts.fieldVsTop', { top })} className="flex flex-col gap-1.5">
                <Head
                  title={t('charts.fieldVsTop', { top })}
                  meta={
                    <>
                      <span className="text-line-strong">■</span> {t('stats.field')} <span className="pl-2 text-gold">■</span> {t('stats.topCut', { top })}
                    </>
                  }
                />
                {archetypes.map((row) => {
                  const share = topShare(row)
                  const over = share > row.share
                  return (
                    <div key={row.archetype} className="grid grid-cols-[minmax(0,150px)_minmax(0,1fr)] items-center gap-3 border-b border-line py-2.5">
                      <span className="truncate text-ink body-sm">{row.archetype}</span>
                      <span className="flex flex-col gap-1">
                        <span className="flex items-center gap-2">
                          <span aria-hidden className="h-2 bg-line-strong" style={{ width: `${Math.min(100, row.share * 160)}%` }} />
                          <span className={META}>{rate(row.share)}</span>
                        </span>
                        <span className="flex items-center gap-2">
                          <span aria-hidden className={twMerge('h-2 min-w-0.5', over ? 'bg-gold' : 'bg-surface-400')} style={{ width: `${Math.min(100, share * 160)}%` }} />
                          <span className={twMerge(META, over && 'text-gold')}>{rate(share)}</span>
                        </span>
                      </span>
                    </div>
                  )
                })}
                <span className="pt-2.5 text-ink-muted caption">{t('stats.conversionNote', { top })}</span>
              </Panel>
            ) : null}
          </div>
        </section>
      ) : (
        <p className="text-ink-muted body-sm">{t(live ? 'stats.liveHidden' : 'stats.noArchetypes')}</p>
      )}

      {play.games ? (
        <section aria-label={t('stats.goingFirst')} className="flex flex-col gap-4">
          <RailHead num={num('first')} label={t('stats.goingFirst')} stamp={t('charts.firstStamp', { games: play.games })} className="px-0" />
          <Panel label={t('stats.goingFirst')} className="flex flex-col gap-3">
            <div className="flex justify-between gap-3 text-ink signal">
              <span>
                {t('stats.goingFirst')} · {rate(play.wins / play.games)}
              </span>
              <span>
                {rate(1 - play.wins / play.games)} · {t('stats.goingSecond')}
              </span>
            </div>
            <div aria-hidden className="flex h-3.5 gap-0.75">
              <span className="bg-series-1" style={{ flex: play.wins }} />
              <span className="bg-series-3" style={{ flex: play.games - play.wins }} />
            </div>
            <span className="text-ink-muted caption">{t('charts.firstNote', { wins: play.wins, games: play.games })}</span>
          </Panel>
        </section>
      ) : null}

      {matchups.length ? (
        <section aria-label={t('stats.matchups')} className="flex flex-col gap-4">
          <RailHead num={num('matchups')} label={t('stats.matchups')} stamp={t('charts.matchupsStamp')} className="px-0" />
          <div className="overflow-x-auto">
            <table className="border-collapse bg-surface-100">
              <thead>
                <tr>
                  <th className={twMerge(MX, 'w-37.5 px-3 text-left font-normal text-ink-muted signal-sm')}>{t('charts.vs')}</th>
                  {archetypes.map((col) => (
                    <th key={col.archetype} title={col.archetype} className={twMerge(MX, 'bg-surface-200 px-1.5 font-normal text-ink-muted signal-sm')}>
                      <span className="block truncate">{col.archetype}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {archetypes.map((row) => (
                  <tr key={row.archetype}>
                    <th className={twMerge(MX, 'w-37.5 bg-surface-200 px-3 text-left font-normal')}>
                      <span className="block truncate text-ink body-sm">{row.archetype}</span>
                    </th>
                    {archetypes.map((col) => {
                      if (col.archetype === row.archetype) {
                        return <td key={col.archetype} className={twMerge(MX, 'bg-[repeating-linear-gradient(45deg,var(--color-surface-200)_0_4px,var(--color-surface-100)_4px_8px)]')} />
                      }
                      const cell = rec.get(`${row.archetype}|${col.archetype}`)
                      if (!cell) return <td key={col.archetype} className={MX} />
                      const won = cell.wins > cell.loses
                      const lost = cell.wins < cell.loses
                      return (
                        <td key={col.archetype} className={twMerge(MX, won ? 'bg-win/15 text-win' : lost ? 'bg-loss/15 text-loss' : 'bg-draw/15 text-draw')}>
                          <span className="data">
                            {cell.wins}–{cell.loses}
                            {cell.draws ? `–${cell.draws}` : ''}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-4">
            <span className={META}>
              <span className="text-win">■</span> {t('charts.rowWon')}
            </span>
            <span className={META}>
              <span className="text-loss">■</span> {t('charts.rowLost')}
            </span>
            <span className={META}>
              <span className="text-draw">■</span> {t('charts.split')}
            </span>
            <span className={META}>{t('charts.neverMet')}</span>
          </div>
        </section>
      ) : null}

      {cards.main.length || cards.extra.length ? (
        <section aria-label={t('stats.cards')} className="flex flex-col gap-4">
          <RailHead num={num('cards')} label={t('stats.cards')} stamp={t('stats.cardsStamp')} className="px-0" />
          <div className="grid items-start gap-6 min-[980px]:grid-cols-2">
            <Panel label={t('charts.mainTitle')} className="overflow-hidden p-0 min-[720px]:p-0">
              <div className="flex justify-between gap-3 px-5 py-4.5">
                <span className="text-ink signal">{t('charts.mainTitle')}</span>
                <span className={META}>{t('charts.byDecks')}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className={TH}>{t('stats.card')}</th>
                      <th className={TH}>{t('charts.inDecks')}</th>
                      <th className={twMerge(TH, NUM)}>{t('stats.copies')}</th>
                      <th className={twMerge(TH, NUM)}>{t('standings.side')}</th>
                      <th className={twMerge(TH, NUM)}>{t('stats.gamesRecord')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cards.main.slice(0, 10).map((card) => (
                      <tr key={card.id}>
                        <td className={TD}>
                          <CardName card={card} frames={frames} fallback={fallback(card)} />
                        </td>
                        <td className={TD}>
                          <Decks decks={card.decks} players={players} />
                        </td>
                        <td className={twMerge(TD, NUM, 'text-ink-dim data')}>{card.copies}</td>
                        <td className={twMerge(TD, NUM, 'text-ink-muted data')}>{card.side.decks}</td>
                        <td className={twMerge(TD, NUM, 'data', card.wins >= card.loses ? 'text-ink' : 'text-ink-muted')}>{gamesRecord(card)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
            <div className="flex flex-col gap-6">
              <Panel label={t('charts.extraTitle')} className="overflow-hidden p-0 min-[720px]:p-0">
                <div className="flex justify-between gap-3 px-5 py-4.5">
                  <span className="text-ink signal">{t('charts.extraTitle')}</span>
                  <span className={META}>{t('charts.byDecks')}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className={TH}>{t('stats.card')}</th>
                        <th className={TH}>{t('charts.inDecks')}</th>
                        <th className={twMerge(TH, NUM)}>{t('stats.gamesRecord')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cards.extra.slice(0, 5).map((card) => (
                        <tr key={card.id}>
                          <td className={TD}>
                            <CardName card={card} frames={frames} fallback={fallback(card)} />
                          </td>
                          <td className={TD}>
                            <Decks decks={card.decks} players={players} />
                          </td>
                          <td className={twMerge(TD, NUM, 'data', card.wins >= card.loses ? 'text-ink' : 'text-ink-muted')}>{gamesRecord(card)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
              <Panel label={t('charts.reading')} className="flex flex-col gap-2 p-5 [--fill:var(--color-surface-200)]">
                <span className="text-ink-muted signal">{t('charts.reading')}</span>
                <p className="m-0 text-ink-dim body-sm">{t('charts.readingBody')}</p>
              </Panel>
            </div>
          </div>
        </section>
      ) : null}
    </>
  )
}
