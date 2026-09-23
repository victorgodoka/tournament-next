import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { twMerge } from "tailwind-merge";
import { Footer } from "@ui/footer";
import { Header } from "@ui/header";
import { Eyebrow } from "@ui/eyebrow";
import { SectionHead } from "@ui/section-head";
import { FriendsPanel } from "@omega/friends-panel";
import { CardArt } from "@omega/card-art";
import { EmptyBox } from "@omega/profile/empty-box";
import { PrivateNotice } from "@omega/profile/private-notice";
import { LocalTime } from "@omega/profile/local-time";
import { RESULT } from "@omega/profile/accent";
import { formatNumber } from "@omega/profile/labels";
import { CardLine, Meter, PanelLabel, Skeleton, StatTiles } from "@omega/analytics/primitives";
import { archetypeName, duelistName, getPlayerSeason, pct, type PlayerSeason, type Record3, type ResponseSplit } from "@utils/analytics";
import type { Profile } from "@utils/types";

export type SeasonChoice = { code: string; label: string; format: 'TCG' | 'Genesys'; open: boolean }

/** Every season the duelist has a record in, played ladders first; an unplayed ladder offers its open season. */
export const seasonChoices = (profile: Extract<Profile, { isPrivate: false }>): SeasonChoice[] => {
  const played = profile.ladders.flatMap((ladder) =>
    ladder.played ? ladder.seasons.map(({ code, label, open }) => ({ code, label, open, format: ladder.format })) : [],
  )
  const unplayed = profile.currentSeasons
    .filter(({ format }) => !played.some((choice) => choice.format === format))
    .map(({ code, label, format }) => ({ code, label, format, open: true }))
  return [...played, ...unplayed]
}

/** How many rows a long list shows before folding the rest behind "Show all". */
const FOLD = 12

const record = ({ wins, losses, draws }: Record3) => `${wins}W · ${losses}L${draws ? ` · ${draws}D` : ''}`

/** Native disclosure for the tail of a long list: no state, keyboard and find-in-page for free. */
const Fold = ({ count, noun, children }: { count: number; noun: string; children: React.ReactNode }) =>
  count > 0 ? (
    <details className="group mt-2">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 border border-line px-3.5 text-ink-dim signal hover:border-ink hover:text-ink [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">Show {formatNumber(count)} more {noun}</span>
        <span className="hidden group-open:inline">Show fewer</span>
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  ) : null

/* ---------------------------------------------------------------- *
 * Sections
 * ---------------------------------------------------------------- */

const Overview = ({ num, data }: { num: string; data: PlayerSeason }) => (
  <section className="pt-section">
    <SectionHead num={num}>Overview</SectionHead>
    <p className="mt-2 max-w-[62ch] text-ink-muted body-sm">
      Counted per game, not per match: a 2–1 adds three games. {formatNumber(data.matchCount)} matches, {formatNumber(data.gameCount)} games.
    </p>
    {data.truncated ? (
      <p className="mt-3 border border-amber bg-ground-amber px-4 py-3 text-amber body-sm">
        Over 1000 matches this season: only the newest 1000 were analyzed.
      </p>
    ) : null}

    <StatTiles
      className="mt-4"
      items={[
        { label: 'Games', value: formatNumber(data.record.games) },
        { label: 'Win rate', value: pct(data.record.winRate), tone: 'text-cyan' },
        { label: 'Wins', value: formatNumber(data.record.wins), tone: 'text-win' },
        { label: 'Losses', value: formatNumber(data.record.losses), tone: 'text-loss' },
        { label: 'Draws', value: formatNumber(data.record.draws) },
        { label: 'Matches', value: formatNumber(data.matchCount) },
      ]}
    />

    {data.averageDeckCoverage ? (
      <div className="mt-5 grid max-w-130 gap-3">
        <PanelLabel>Average deck used per game</PanelLabel>
        <Meter label="Main deck" rate={data.averageDeckCoverage.main} />
        <Meter label="Extra deck" rate={data.averageDeckCoverage.extra} tone="bg-cyan" />
      </div>
    ) : null}
  </section>
)

/** Distribution, going first vs second and combo length, merged into one card per archetype. */
const Decks = ({ num, data }: { num: string; data: PlayerSeason }) => (
  <section className="pt-section">
    <SectionHead num={num}>Decks</SectionHead>
    <p className="mt-2 max-w-[62ch] text-ink-muted body-sm">
      The archetype is read from the decklist — the one with the most copies. It is a heuristic, not a deck name.
    </p>
    <ul className="mt-4 grid gap-3.5 md:grid-cols-2">
      {data.archetypeDistribution.map((deck) => {
        const turns = data.firstVsSecond.find((row) => row.archetype === deck.archetype)
        const combo = data.comboLength.find((row) => row.archetype === deck.archetype)
        return (
          <li key={deck.archetype ?? 'unknown'} className="flex flex-col border border-line bg-surface-000 p-[clamp(14px,1.8vw,20px)]">
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 truncate text-ink display-5">{archetypeName(deck.archetype)}</p>
              <p className="shrink-0 text-cyan display-6 tabular-nums">{pct(deck.winRate)}</p>
            </div>
            <p className="mt-1 text-ink-muted mono-data">
              {formatNumber(deck.games)} games · {record(deck)}
            </p>
            <Meter className="mt-3.5" label="Share of your games" rate={deck.share} tone="bg-ink-dim" />
            {turns ? (
              <div className="mt-3.5 grid grid-cols-2 gap-4">
                <Meter label={`Going first · ${turns.first.games}`} rate={turns.first.winRate} />
                <Meter label={`Going second · ${turns.second.games}`} rate={turns.second.winRate} tone="bg-cyan" />
              </div>
            ) : null}
            {combo ? (
              <p className="mt-auto pt-3.5 text-ink-muted signal-sm">
                Avg combo <span className="text-ink mono-data">{combo.average === null ? '—' : combo.average.toFixed(1)}</span> actions over{' '}
                {formatNumber(combo.turns)} own turns
              </p>
            ) : null}
          </li>
        )
      })}
    </ul>
  </section>
)

const CardUsageRow = ({ card }: { card: PlayerSeason['cardUsage'][number] }) => (
  <li className="grid gap-x-6 gap-y-3 bg-surface-000 px-4 py-3.5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)] md:items-center">
    <CardLine id={card.cardId} name={card.name} />
    <Meter label="In deck" rate={card.deckInclusion.rate} tone="bg-ink-dim" value={`${pct(card.deckInclusion.rate)} · ${card.deckInclusion.games}`} />
    <Meter label="Used" rate={card.usage.rate} value={`${pct(card.usage.rate)} · ${card.usage.games}`} />
    <p className="text-ink-muted signal-sm md:text-right">
      Win rate when activated
      <span className="block text-ink mono-data">
        {card.whenActivated.games ? `${pct(card.whenActivated.winRate)} · ${card.whenActivated.games} games` : '—'}
      </span>
    </p>
  </li>
)

const CardUsage = ({ num, data }: { num: string; data: PlayerSeason }) => (
  <section className="pt-section">
    <SectionHead num={num}>Card usage</SectionHead>
    <p className="mt-2 max-w-[62ch] text-ink-muted body-sm">
      How often a card sat in the decklist, next to how often it was actually summoned or activated. The gap is the story.
    </p>
    <ul className="mt-4 grid gap-px border border-line bg-line">
      {data.cardUsage.slice(0, FOLD).map((card) => (
        <CardUsageRow key={card.cardId} card={card} />
      ))}
    </ul>
    <Fold count={data.cardUsage.length - FOLD} noun="cards">
      <ul className="grid gap-px border border-line bg-line">
        {data.cardUsage.slice(FOLD).map((card) => (
          <CardUsageRow key={card.cardId} card={card} />
        ))}
      </ul>
    </Fold>
  </section>
)

const SignatureCards = ({ num, data }: { num: string; data: PlayerSeason }) => (
  <section className="pt-section">
    <SectionHead num={num}>Most used cards</SectionHead>
    <div className="mt-4 grid gap-6">
      {data.mostUsedCardsPerArchetype.map((deck) => (
        <div key={deck.archetype ?? 'unknown'}>
          <PanelLabel>{archetypeName(deck.archetype)}</PanelLabel>
          <ol className="mt-2.5 grid grid-cols-3 gap-2.5 sm:grid-cols-5">
            {deck.cards.map((card, index) => (
              <li key={card.cardId} className="min-w-0">
                <CardArt art={{ id: card.cardId, name: card.name }} sizes="(min-width: 640px) 200px, 30vw" className="aspect-square border border-line">
                  <span className="absolute top-0 left-0 bg-surface-000 px-1.5 py-0.5 text-gold signal-count tabular-nums">{index + 1}</span>
                </CardArt>
                <p className="mt-1.5 truncate text-ink body-sm" title={card.name ?? undefined}>{card.name ?? `#${card.cardId}`}</p>
                <p className="text-ink-muted mono-note">
                  {formatNumber(card.uses)} uses · {formatNumber(card.games)} games
                </p>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  </section>
)

/** Chained-to counts in words. "Responded", never "negated": the log doesn't say what resolved. */
const responseLine = (who: string, split: ResponseSplit) =>
  split.activations
    ? `${who}: ${split.activations} activation${split.activations === 1 ? '' : 's'}, ${split.responded} got a response (${pct(split.respondedRate)})` +
      (split.responded ? ` · Called by the Grave ${split.calledByTheGrave} · Crossout ${split.crossoutDesignator}` : '')
    : `${who}: none`

const HandTraps = ({ num, data }: { num: string; data: PlayerSeason }) => {
  const seen = data.responses.filter((trap) => trap.byPlayer.activations || trap.byOpponent.activations)
  return (
    <section className="pt-section">
      <SectionHead num={num}>Hand traps</SectionHead>
      <p className="mt-2 max-w-[62ch] text-ink-muted body-sm">
        Tracked hand traps and how often the next chain link was added on top of them — by the other duelist or by the same one. A response is
        not proof it was stopped.
      </p>
      {seen.length ? (
        <ul className="mt-4 grid gap-px border border-line bg-line">
          {seen.map((trap) => (
            <li key={trap.cardId} className="grid gap-x-6 gap-y-3 bg-surface-000 px-4 py-3.5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] md:items-center">
              <CardLine id={trap.cardId} name={trap.name} />
              <div className="min-w-0">
                <Meter label="Yours answered" rate={trap.byPlayer.respondedRate} />
                <p className="mt-1 text-ink-muted mono-note">{responseLine('You', trap.byPlayer)}</p>
              </div>
              <div className="min-w-0">
                <Meter label="Opponents' answered" rate={trap.byOpponent.respondedRate} tone="bg-cyan" />
                <p className="mt-1 text-ink-muted mono-note">{responseLine('Opponents', trap.byOpponent)}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyBox title="No hand trap activity" className="mt-4">
          None of the tracked hand traps was activated in this season&apos;s games, by this duelist or against them.
        </EmptyBox>
      )}
    </section>
  )
}

const MatchupBlock = ({ matchup }: { matchup: PlayerSeason['handTrapsPerMatchup'][number] }) => (
  <li className="bg-surface-000 px-4 py-3.5">
    <p className="flex flex-wrap items-baseline gap-x-2 text-ink body-strong">
      {archetypeName(matchup.archetype)} <span className="text-ink-muted signal-sm">vs</span> {archetypeName(matchup.opponentArchetype)}
      <span className="ml-auto text-ink-muted mono-data">{formatNumber(matchup.games)} games</span>
    </p>
    <ul className="mt-2.5 grid gap-2">
      {matchup.handTraps.map((trap) => (
        <li key={trap.cardId} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <CardLine id={trap.cardId} name={trap.name} size="sm" />
          <p className="text-right mono-data tabular-nums">
            <span className="text-gold" title="Your activations per game">{trap.player.perGame === null ? '—' : trap.player.perGame.toFixed(2)}</span>
            <span className="text-ink-muted"> / </span>
            <span className="text-cyan" title="Opponent activations per game">{trap.opponent.perGame === null ? '—' : trap.opponent.perGame.toFixed(2)}</span>
          </p>
        </li>
      ))}
    </ul>
  </li>
)

const Matchups = ({ num, data }: { num: string; data: PlayerSeason }) =>
  data.handTrapsPerMatchup.length ? (
    <section className="pt-section">
      <SectionHead num={num}>Hand traps by matchup</SectionHead>
      <p className="mt-2 text-ink-muted body-sm">
        Activations per game — <span className="text-gold">yours</span> / <span className="text-cyan">your opponent&apos;s</span>. Most played matchup first.
      </p>
      <ul className="mt-4 grid gap-px border border-line bg-line md:grid-cols-2">
        {data.handTrapsPerMatchup.slice(0, 6).map((matchup) => (
          <MatchupBlock key={`${matchup.archetype}:${matchup.opponentArchetype}`} matchup={matchup} />
        ))}
      </ul>
      <Fold count={data.handTrapsPerMatchup.length - 6} noun="matchups">
        <ul className="grid gap-px border border-line bg-line md:grid-cols-2">
          {data.handTrapsPerMatchup.slice(6).map((matchup) => (
            <MatchupBlock key={`${matchup.archetype}:${matchup.opponentArchetype}`} matchup={matchup} />
          ))}
        </ul>
      </Fold>
    </section>
  ) : null

const GameRow = ({ game, data }: { game: PlayerSeason['games'][number]; data: PlayerSeason }) => {
  const result = game.result ? RESULT[game.result] : null
  const opponent = game.opponentId ? data.opponents[game.opponentId] : undefined
  return (
    <li className="grid grid-cols-[36px_minmax(0,1fr)] items-center gap-x-3 gap-y-1 bg-surface-000 px-4 py-3 md:grid-cols-[36px_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)]">
      <span className={twMerge('row-span-4 inline-flex size-9 items-center justify-center self-start text-surface-000 signal-tab md:row-span-1 md:self-center', result?.fill ?? 'bg-surface-400')}>
        <span aria-hidden>{result ? result.label[0] : '–'}</span>
        <span className="sr-only">{result?.label ?? 'Not finished'}</span>
      </span>
      <p className="min-w-0 truncate text-ink body-sm">
        {archetypeName(game.archetype)} <span className="text-ink-muted signal-sm">vs</span> {archetypeName(game.opponentArchetype)}
      </p>
      <p className="min-w-0 truncate body-sm">
        {game.opponentId ? (
          <Link href={`/profile/${game.opponentId}`} className="text-ink-dim hover:text-gold">
            {duelistName(opponent)}
          </Link>
        ) : (
          <span className="text-ink-muted">Unknown duelist</span>
        )}
      </p>
      <p className="text-ink-muted mono-data">
        G{game.gameNumber} · {game.wentFirst === null ? '—' : game.wentFirst ? '1st' : '2nd'} · {game.turns}T · {game.actions} acts
      </p>
      <p className="text-ink-muted mono-data md:text-right">
        {game.start ? <LocalTime iso={game.start} options={{ dateStyle: 'medium', timeStyle: 'short' }} /> : '—'}
      </p>
    </li>
  )
}

const Games = ({ num, data }: { num: string; data: PlayerSeason }) => {
  const games = [...data.games].sort((a, b) => (b.start ?? '').localeCompare(a.start ?? '') || b.gameNumber - a.gameNumber)
  return (
    <section className="pt-section">
      <SectionHead num={num}>Every game</SectionHead>
      <p className="mt-2 text-ink-muted body-sm">Newest first. Open a duel from the match history to see its timeline.</p>
      <ul className="mt-4 grid gap-px border border-line bg-line">
        {games.slice(0, 20).map((game) => (
          <GameRow key={`${game.matchId}:${game.gameNumber}`} game={game} data={data} />
        ))}
      </ul>
      <Fold count={games.length - 20} noun="games">
        <ul className="grid gap-px border border-line bg-line">
          {games.slice(20).map((game) => (
            <GameRow key={`${game.matchId}:${game.gameNumber}`} game={game} data={data} />
          ))}
        </ul>
      </Fold>
    </section>
  )
}

/** The slow part (1–3 s): streamed behind a skeleton so the head and the season picker paint at once. */
const SeasonBody = async ({ playerId, season, cookie }: { playerId: string; season: string; cookie: string | null }) => {
  const data = await getPlayerSeason(playerId, season, cookie)

  if (data === 'forbidden') return <PrivateNotice />
  if (!data) {
    return (
      <div className="pt-section">
        <EmptyBox title="No statistics for this season">That season doesn&apos;t exist, or the duelist has no ranked record in it.</EmptyBox>
      </div>
    )
  }
  if (!data.gameCount) {
    return (
      <div className="pt-section">
        <EmptyBox title="No ranked games yet" note={data.season.label}>
          Statistics appear after the first ranked game of the season is logged.
        </EmptyBox>
      </div>
    )
  }

  let count = 0
  const num = () => String(++count).padStart(2, '0')

  return (
    <>
      <Overview num={num()} data={data} />
      <Decks num={num()} data={data} />
      <CardUsage num={num()} data={data} />
      {data.mostUsedCardsPerArchetype.length ? <SignatureCards num={num()} data={data} /> : null}
      <HandTraps num={num()} data={data} />
      {data.handTrapsPerMatchup.length ? <Matchups num={num()} data={data} /> : null}
      {/* <Games num={num()} data={data} /> */}
    </>
  )
}

const SeasonPicker = ({ profileId, choices, season }: { profileId: string; choices: SeasonChoice[]; season?: string }) => (
  <nav aria-label="Season" className="mt-6 grid gap-3">
    {(['TCG', 'Genesys'] as const).map((format) => {
      const seasons = choices.filter((choice) => choice.format === format)
      if (!seasons.length) return null
      return (
        <div key={format} className="flex flex-wrap items-center gap-2">
          <span className="w-18 shrink-0 text-ink-muted signal-sm">{format}</span>
          {seasons.map((choice) => {
            const on = choice.code === season
            return (
              <Link
                key={choice.code}
                href={`/profile/${profileId}/statistics?season=${encodeURIComponent(choice.code)}`}
                aria-current={on ? 'page' : undefined}
                scroll={false}
                className={twMerge(
                  'inline-flex min-h-11 items-center gap-2 border px-3 signal-chip',
                  on ? 'border-gold bg-ground-gold text-gold' : 'border-line text-ink-dim hover:border-gold hover:text-gold',
                )}
              >
                {choice.label}
                {choice.open ? <span className="size-1.5 bg-positive" aria-label="open season" /> : null}
              </Link>
            )
          })}
        </div>
      )
    })}
  </nav>
)

type PlayerStatisticsProps = {
  profile: Profile
  choices: SeasonChoice[]
  season?: string
  cookie: string | null
}

export const PlayerStatistics = ({ profile, choices, season, cookie }: PlayerStatisticsProps) => {
  const name = profile.displayName ?? profile.handle ?? 'Unknown duelist'
  const current = choices.find((choice) => choice.code === season)

  return (
    <>
      <Header />
      <main className="flex min-h-dvh flex-col overflow-x-hidden pt-16 pb-[clamp(56px,7vw,96px)]">
        <div className="mx-auto w-full max-w-page px-gutter">
          <section className="pt-section">
            <Link href={`/profile/${profile.id}`} className="inline-flex min-h-11 items-center text-ink-muted signal hover:text-gold">
              ← Back to profile
            </Link>
            <Eyebrow tone="cyan" meta={current ? `${current.format} · ${current.label}` : season} className="mt-3">
              Season statistics
            </Eyebrow>
            <div className="mt-5 flex items-center gap-[clamp(14px,2vw,22px)]">
              {profile.avatar ? (
                <div className="relative size-[clamp(56px,7vw,80px)] shrink-0 border-3 border-surface-000 bg-surface-100 shadow-offset-void-sm">
                  <Image src={profile.avatar} alt="" fill sizes="80px" className="object-cover" />
                </div>
              ) : null}
              <h1 className="min-w-0 text-ink display-1">{name}</h1>
            </div>
            {choices.length ? <SeasonPicker profileId={profile.id} choices={choices} season={season} /> : null}
          </section>

          {profile.isPrivate ? (
            <PrivateNotice />
          ) : !season ? (
            <div className="pt-section">
              <EmptyBox title="No season to show">This duelist has no ranked season on record yet.</EmptyBox>
            </div>
          ) : (
            // Keyed by season so switching streams a fresh skeleton instead of holding the old numbers.
            <Suspense key={season} fallback={<div className="pt-section"><Skeleton rows={6} label="Reading every ranked game of the season…" /></div>}>
              <SeasonBody playerId={profile.id} season={season} cookie={cookie} />
            </Suspense>
          )}
        </div>
      </main>
      <Footer />
      <FriendsPanel />
    </>
  )
}
