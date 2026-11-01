import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { AdBanner } from '@omega/ads/ad-banner'
import { LocalTime } from '@omega/profile/local-time'
import { TIME_ONLY, banlistLabel, cardPoolYear, formatRate, formatRecord, minutesBetween } from '@omega/tournament/labels'
import { playerName } from '@omega/tournament/player'
import { Avatar } from '@ui/avatar'
import { Chip } from '@ui/chip/chip.component'
import { Icon } from '@ui/icon'
import { Panel } from '@ui/panel'
import { RailHead } from '@ui/rail-head/rail-head.component'
import type { Standing, TournamentDetail, TournamentMatch, TournamentPlayer, TournamentRound } from '@utils/types'
import { META, Pill, type Roster, resultIn, rosterOf } from '../helpers'

type T = ReturnType<typeof useTranslations<'Tournaments'>>
type Side = 'player1' | 'player2'

const TH = 'px-3 py-2.5 text-left font-normal whitespace-nowrap bg-surface-200 border-b border-line text-ink-muted signal'
const TD = 'px-3 py-3 border-b border-line align-middle'

const Name = ({ player, className, t }: { player: TournamentPlayer | undefined; className?: string; t: T }) => {
  const name = playerName(player, t('player.unknown'))
  return player ? (
    <Link href={`/profile/${player.id}`} className={twMerge('truncate text-ink hover:text-cyan', className)}>
      {name}
    </Link>
  ) : (
    <span className={twMerge('truncate text-ink-muted', className)}>{name}</span>
  )
}

/** One duelist of the match on the table: portrait, name, handle, their place and points right now. */
const Duelist = ({ player, standing, reverse, t }: { player: TournamentPlayer | undefined; standing: Standing | undefined; reverse?: boolean; t: T }) => (
  <div className={twMerge('flex min-w-0 items-center gap-4 max-[720px]:flex-col max-[720px]:text-center', reverse && 'flex-row-reverse text-right')}>
    <Avatar name={playerName(player, t('player.unknown'))} src={player?.avatar} cosmetics={player?.cosmetics} size="lg" />
    <span className={twMerge('flex min-w-0 flex-col gap-1', reverse && 'items-end max-[720px]:items-center')}>
      <Name player={player} className="display-2" t={t} />
      <span className={META}>
        {[player?.handle, standing ? t('record.rank', { rank: standing.rank }) : null, standing ? t('detail.points', { points: standing.points }) : null]
          .filter(Boolean)
          .join(' · ')}
      </span>
    </span>
  </div>
)

/** A match being played: the two duelists, no score yet, three empty game boxes. */
const OnTable = ({ match, round, standings, roster, now, mode }: { match: TournamentMatch; round: TournamentRound; standings: Standing[]; roster: Roster; now: string; mode: string }) => {
  const t = useTranslations('Tournaments')
  const standingOf = (id: string) => standings.find((standing) => standing.player.id === id)
  return (
    <Panel
      label={t('live.onTable')}
      className="flex flex-col gap-5.5 drop-shadow-[0_0_10px_rgba(0,253,255,0.35)] [--edge:var(--color-cyan)] [--sw:var(--stroke)] min-[720px]:px-8 min-[720px]:py-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2.5 text-cyan signal-strong">
          <span aria-hidden className="size-2 rounded-round bg-cyan shadow-glow-live" />
          {t('live.inProgressFor', { minutes: minutesBetween(round.startedAt, now) })}
        </span>
        <span className={META}>
          {t('rounds.room', { room: match.room })} · {mode}
        </span>
      </div>
      <div className="grid items-center gap-6 min-[720px]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <Duelist player={roster.get(match.player1)} standing={standingOf(match.player1)} t={t} />
        <div className="flex flex-col items-center gap-2.5">
          <span className="font-display text-[56px] leading-none text-ink-muted">– : –</span>
          <span aria-label={t('live.noGames')} className="flex gap-1.5">
            <span className="size-3.5 border border-line-mid" />
            <span className="size-3.5 border border-line-mid" />
            <span className="size-3.5 border border-dashed border-line-mid" />
          </span>
        </div>
        <Duelist player={roster.get(match.player2)} standing={standingOf(match.player2)} reverse t={t} />
      </div>
      <p className="m-0 border-t border-line pt-4 text-ink-dim body-sm">{t('live.scoreNote')}</p>
    </Panel>
  )
}

/** A decided match of an earlier round, read from the winner's side. */
const Result = ({ match, roster, t }: { match: TournamentMatch; roster: Roster; t: T }) => {
  const draw = match.outcome === 'draw'
  const lead: Side = match.outcome === 'player2' ? 'player2' : 'player1'
  const trail: Side = lead === 'player1' ? 'player2' : 'player1'
  const first = (side: Side) =>
    match.first === side ? (
      <span title={t('rounds.firstTitle')} className="shrink-0 text-azure-lift signal-sm">
        {t('rounds.first')}
      </span>
    ) : null
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_72px_minmax(0,1fr)] items-center gap-3 bg-surface-100 px-4 py-3">
      <span className="flex min-w-0 items-center gap-2.5">
        <Pill result={draw ? 'D' : 'W'} />
        <Name player={roster.get(match[lead])} className="body-strong" t={t} />
        {first(lead)}
      </span>
      <span className="text-center text-ink stat">
        <span className={draw ? undefined : 'text-win'}>{match.score[lead]}</span> – {match.score[trail]}
      </span>
      <span className="flex min-w-0 items-center justify-end gap-2.5">
        {first(trail)}
        <Name player={roster.get(match[trail])} className="text-ink-dim body" t={t} />
        <Pill result={draw ? 'D' : 'L'} />
      </span>
    </li>
  )
}

type Scenario = { winner: string; rank: number; points: number; tie: { names: string[]; points: number; rank: number } | null }

/**
 * What each pending match of the last round does to the top of the table, on points alone: the winner's new
 * place, and the biggest tie it leaves for the tiebreakers to settle. A draw isn't projected.
 */
const scenariosOf = (pending: TournamentMatch[], standings: Standing[], roster: Roster, fallback: string): Scenario[] =>
  pending.flatMap((match) =>
    (['player1', 'player2'] as const).map((side) => {
      const winner = match[side]
      const points = new Map(standings.map((standing) => [standing.player.id, standing.points]))
      points.set(winner, (points.get(winner) ?? 0) + 3)
      const sorted = [...points.entries()].sort((a, b) => b[1] - a[1])
      const own = points.get(winner) ?? 0
      const groups = new Map<number, string[]>()
      for (const [id, pts] of sorted) if (id !== winner) groups.set(pts, [...(groups.get(pts) ?? []), id])
      const tie = [...groups.entries()].filter(([, ids]) => ids.length >= 2).sort((a, b) => b[1].length - a[1].length || b[0] - a[0])[0]
      return {
        winner,
        rank: sorted.filter(([, pts]) => pts > own).length + 1,
        points: own,
        tie: tie ? { names: tie[1].map((id) => playerName(roster.get(id), fallback)), points: tie[0], rank: sorted.filter(([, pts]) => pts > tie[0]).length + 1 } : null,
      }
    }),
  )

const Decides = ({ scenarios, roster }: { scenarios: Scenario[]; roster: Roster }) => {
  const t = useTranslations('Tournaments')
  const locale = useLocale()
  const list = new Intl.ListFormat(locale, { type: 'conjunction' })
  return (
    <Panel tone="steel" label={t('live.decides')} className="flex flex-col gap-4 p-5.5">
      <span className="text-gold signal">{t('live.decides')}</span>
      <div className="flex flex-col gap-2.5">
        {scenarios.map((scenario) => {
          const name = playerName(roster.get(scenario.winner), t('player.unknown'))
          return (
            <div key={scenario.winner} className="cut flex flex-col gap-1 p-3.5 [--edge:var(--color-steel-edge)] [--fill:rgba(8,10,20,0.35)]">
              <span className="text-ink-dim signal-sm">{t('live.ifWins', { name })}</span>
              <span className="text-ink body-strong">{t('live.takes', { name, rank: t('record.rank', { rank: scenario.rank }), points: scenario.points })}</span>
              {scenario.tie ? (
                <span className="text-ink-dim body-sm">
                  {t('live.tie', { names: list.format(scenario.tie.names), points: scenario.tie.points, rank: t('record.rank', { rank: scenario.tie.rank }) })}
                </span>
              ) : null}
            </div>
          )
        })}
      </div>
      <span className="text-ink-dim caption">{t('live.projected')}</span>
    </Panel>
  )
}

/**
 * The live tab: the match on the table and the bye, the standings as they are, the last round's results; beside
 * them what the final match decides, what opens when it ends, how it runs, and an ad.
 */
export const Live = ({ detail, now }: { detail: TournamentDetail; now: string }) => {
  const t = useTranslations('Tournaments')
  const locale = useLocale()
  const { tournament, standings, rounds } = detail
  const roster = rosterOf(standings)
  const current = rounds.at(-1)
  const previous = rounds.at(-2)
  const pending = current?.matches.filter((match) => match.outcome === 'unplayed') ?? []
  const bye = current?.bye ? roster.get(current.bye) : undefined
  const final = current?.number === tournament.rounds
  const scenarios = current && final && pending.length ? scenariosOf(pending, standings, roster, t('player.unknown')) : []
  const year = cardPoolYear(tournament.cardPool)
  const mode = t(`mode.long.${tournament.settings.mode}`)

  return (
    <div className="flex flex-wrap items-start gap-6">
      <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-6">
        <section aria-label={t('live.onTable')} className="flex flex-col gap-3.5">
          <RailHead
            num="01"
            label={t('live.onTable')}
            stamp={
              current ? (
                <>
                  {t('live.pairedStamp', { round: current.number })} <LocalTime iso={current.startedAt} options={TIME_ONLY} />
                </>
              ) : undefined
            }
            className="px-0"
          />
          {!current ? (
            <Panel tone="sunken" label={t('live.waitingFirst')} className="text-ink-dim body-sm">
              {t('live.waitingFirst')}
            </Panel>
          ) : pending.length ? (
            pending.map((match) => <OnTable key={match.room} match={match} round={current} standings={standings} roster={roster} now={now} mode={mode} />)
          ) : (
            <Panel tone="sunken" label={t('live.waitingNext', { round: current.number })} className="text-ink-dim body-sm">
              {t('live.waitingNext', { round: current.number })}
            </Panel>
          )}
          {current && bye ? (
            <div className="cut notch flex flex-wrap items-center gap-3.5 px-5 py-4 [--cut:var(--cut-md)] [--edge:var(--color-line)] [--fill:var(--color-surface-200)]">
              <Pill result="BYE" />
              <Avatar name={playerName(bye, t('player.unknown'))} src={bye.avatar} cosmetics={bye.cosmetics} size="sm" />
              <Name player={bye} className="body-strong" t={t} />
              <span className="flex-1 text-ink-dim body-sm">{t('live.byeText', { round: current.number })}</span>
              <span className={META}>{t('live.byePoints')}</span>
            </div>
          ) : null}
        </section>

        <section aria-label={t('live.standingsNow')} className="flex flex-col gap-3.5">
          <RailHead num="02" label={t('live.standingsNow')} stamp={t('live.standingsStamp')} className="px-0" />
          <div className="overflow-x-auto border border-line">
            <table className="w-full min-w-180 border-collapse bg-surface-100">
              <thead>
                <tr>
                  <th className={twMerge(TH, 'w-12')}>{t('standings.rank')}</th>
                  <th className={TH}>{t('standings.duelist')}</th>
                  <th className={TH}>{t('live.rounds')}</th>
                  <th className={TH}>{t('standings.deck')}</th>
                  <th className={twMerge(TH, 'text-right')}>{t('stats.record')}</th>
                  <th className={twMerge(TH, 'text-right')}>{t('standings.omw')}</th>
                  <th className={twMerge(TH, 'text-right')}>{t('standings.points')}</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((standing) => {
                  const { rank, player, dropped } = standing
                  return (
                    <tr key={player.id} className={dropped ? 'opacity-60' : undefined}>
                      <td className={TD}>
                        <span className={twMerge('stat', rank === 1 ? 'text-gold' : rank <= 4 ? 'text-ink' : 'text-ink-muted')}>{rank}</span>
                      </td>
                      <td className={TD}>
                        <span className="flex items-center gap-3">
                          <Avatar name={playerName(player, t('player.unknown'))} src={player.avatar} cosmetics={player.cosmetics} size="sm" className="size-8 text-xs" />
                          <span className="flex min-w-0 flex-col">
                            <Name player={player} className="body-strong" t={t} />
                            {player.handle ? <span className={META}>{player.handle}</span> : null}
                          </span>
                          {dropped ? <Chip className="[--fill:transparent]">{t('standings.dropped')}</Chip> : null}
                        </span>
                      </td>
                      <td className={TD}>
                        <span className="flex gap-1">
                          {rounds.map((round) => (
                            <Pill key={round.number} result={resultIn(round, player.id)} label={t('rounds.inProgress')} />
                          ))}
                        </span>
                      </td>
                      <td className={TD}>
                        <span className={twMerge('inline-flex items-center gap-1.5', META)}>
                          <Icon name="lock" size={12} />
                          {t('standings.deckHidden')}
                        </span>
                      </td>
                      <td className={twMerge(TD, 'text-right text-ink-dim data')}>{formatRecord(standing)}</td>
                      <td className={twMerge(TD, 'text-right text-ink-dim data')}>{formatRate(standing.tiebreakers.opponentsMatchWin, locale)}</td>
                      <td className={twMerge(TD, 'text-right')}>
                        <span className="text-ink stat">{standing.points}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <span className={META}>{t('live.standingsNote')}</span>
        </section>

        {previous ? (
          <section aria-label={t('live.results', { round: previous.number })} className="flex flex-col gap-3.5">
            <RailHead
              num="03"
              label={t('live.results', { round: previous.number })}
              stamp={
                <>
                  {t('rounds.paired')} <LocalTime iso={previous.startedAt} options={TIME_ONLY} /> · {t('live.matchCount', { count: previous.matches.length })}
                </>
              }
              className="px-0"
            />
            <ol className="flex flex-col gap-px border border-line bg-line">
              {previous.matches
                .filter((match) => match.outcome !== 'unplayed')
                .map((match) => (
                  <Result key={match.room} match={match} roster={roster} t={t} />
                ))}
            </ol>
          </section>
        ) : null}
      </div>

      <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-6">
        {scenarios.length ? <Decides scenarios={scenarios} roster={roster} /> : null}

        <Panel label={t('live.metaTitle')} className="dots flex flex-col items-start gap-3 p-5.5 [--fill:var(--color-surface-200)]">
          <span className="text-ink-muted signal">{t('stats.metagame')}</span>
          <h3 className="text-ink display-3">{t('live.metaTitle')}</h3>
          <p className="m-0 text-ink-dim body-sm">{t('live.metaBody')}</p>
        </Panel>

        <Panel label={t('detail.ran.title')} className="flex flex-col gap-3 p-5.5">
          <span className="text-ink-muted signal">{t('detail.ran.title')}</span>
          <ul className="m-0 flex flex-col gap-1.5 pl-4.5 text-ink-dim body-sm">
            <li>{t('detail.ran.swiss', { rounds: tournament.rounds })}</li>
            <li>{t('detail.ran.decks', { banlist: banlistLabel(tournament) })}</li>
            {year ? <li>{t('detail.ran.cardPool', { year })}</li> : null}
            <li>{t('detail.ran.engine')}</li>
          </ul>
        </Panel>

        <AdBanner id="ad-rail" placement="aside" />
      </aside>
    </div>
  )
}
