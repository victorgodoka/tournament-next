import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { CardArt } from '@omega/card-art'
import { CopyButton } from '@omega/tournament/copy-deck'
import { formatRate, formatRecord } from '@omega/tournament/labels'
import { playerName } from '@omega/tournament/player'
import { Avatar } from '@ui/avatar'
import { Button } from '@ui/button'
import { Chip } from '@ui/chip'
import { Icon } from '@ui/icon'
import { toYdke } from '@utils/deck/codecs/ydke'
import type { CardFrame } from '@utils/deck/model'
import type { DeckCard, Standing, TournamentDeck, TournamentRound, TournamentSummary } from '@utils/types'
import { FRAME_BG, META, Pill, SERIES, deckName, kindsOf, resultIn, sortByFrame, type Frames } from '../helpers'

/** Rank, duelist, points and the chevron on a phone; every column from `lg`. */
const COLS =
  'grid grid-cols-[44px_minmax(0,1fr)_44px_24px] items-center gap-3.5 px-4 lg:grid-cols-[44px_minmax(180px,1.3fr)_auto_minmax(170px,1.2fr)_72px_64px_64px_44px_24px] lg:px-4.5'
const LG = 'max-lg:hidden'

/** The deck-builder link for a decklist, or nothing when the list can't be encoded. */
const builderHref = (deck: TournamentDeck) => {
  const expand = (cards: DeckCard[]) => cards.flatMap((card) => Array<number>(card.count).fill(card.id))
  try {
    return `/deck-builder?d=${encodeURIComponent(toYdke({ main: expand(deck.main), extra: expand(deck.extra), side: expand(deck.side) }))}&copy`
  } catch {
    return null
  }
}

/** The legend's entries: Normal and Effect fold into one "Monster". */
const legendOf = (frames: CardFrame[]) => {
  const seen = new Set(frames.map((frame) => (frame === 'normal' ? 'effect' : frame)))
  return (['effect', 'ritual', 'fusion', 'synchro', 'xyz', 'link', 'spell', 'trap'] as const).filter((frame) => seen.has(frame))
}

const Line = ({ card, frame }: { card: DeckCard; frame: CardFrame | undefined }) => {
  const t = useTranslations('Tournaments.stats')
  return (
    <li className="grid grid-cols-[22px_minmax(0,1fr)] items-center gap-2">
      <span className="text-right font-mono text-xs leading-5 font-bold text-ink-muted">{card.count}</span>
      <span className="flex min-w-0 items-center gap-2 text-ink body-sm">
        <i aria-hidden className={twMerge('h-3.5 w-0.75 shrink-0', frame ? FRAME_BG[frame] : 'bg-line-mid')} />
        <Link href={`/wiki/card/${card.id}`} className="truncate text-ink hover:text-cyan">
          {card.name ?? t('fallbackName', { id: card.id })}
        </Link>
      </span>
    </li>
  )
}

/** One zone of the list: a ruled heading with its count, then the cards; the main deck flows down two columns. */
const Zone = ({ label, meta, cards, frames, two }: { label: string; meta: string; cards: DeckCard[]; frames: Frames; two?: boolean }) => {
  const sorted = sortByFrame(cards, frames)
  const columns = two ? [sorted.slice(0, Math.ceil(sorted.length / 2)), sorted.slice(Math.ceil(sorted.length / 2))] : [sorted]
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
        <span className="text-ink signal-strong">{label}</span>
        <span className={META}>{meta}</span>
      </div>
      <div className={twMerge('grid gap-x-6', two && 'min-[720px]:grid-cols-2')}>
        {columns.map((column, i) => (
          <ul key={i} className="flex flex-col gap-1">
            {column.map((card) => (
              <Line key={card.id} card={card} frame={frames[card.id]} />
            ))}
          </ul>
        ))}
      </div>
    </div>
  )
}

/** The registered deck under its row: archetypes, copy and open, the three zones, the frame legend. */
const DeckPanel = ({ deck, frames, anchor }: { deck: TournamentDeck | null; frames: Frames; anchor?: boolean }) => {
  const t = useTranslations('Tournaments')
  if (!deck) return <p className="border-t border-line bg-surface-200 px-6 py-5 text-ink-muted body-sm">{t('standings.deckUnavailable')}</p>

  const count = (cards: DeckCard[]) => cards.reduce((sum, card) => sum + card.count, 0)
  const kinds = kindsOf(deck.main, frames)
  const known = kinds.monsters + kinds.spells + kinds.traps
  const legend = legendOf([...deck.main, ...deck.extra, ...deck.side].flatMap((card) => frames[card.id] ?? []))
  const builder = builderHref(deck)

  return (
    <div id={anchor ? 'deck' : undefined} className="flex flex-col gap-5 border-t border-line bg-surface-200 px-6 pt-6 pb-7 lg:pl-19">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          <span className="text-ink-muted signal">{t('standings.registered')}</span>
          <div className="flex flex-wrap gap-2">
            {deck.archetypes.map((archetype, i) => (
              <Chip key={archetype.name} className="text-ink">
                <span aria-hidden className="size-2 shrink-0" style={{ background: SERIES[i] }} />
                {archetype.name} · {archetype.cards}
              </Chip>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <CopyButton value={deck.code} label={t('standings.copyCode')} size="mono" />
          {builder ? (
            <Button href={builder} variant="secondary" size="mono">
              {t('deck.openBuilder')}
            </Button>
          ) : null}
        </div>
      </div>
      <div className="grid gap-6 min-[980px]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Zone
          label={t('standings.main')}
          meta={known ? t('deck.mainMeta', { count: count(deck.main), ...kinds }) : t('standings.cards', { count: count(deck.main) })}
          cards={deck.main}
          frames={frames}
          two
        />
        <Zone label={t('standings.extra')} meta={t('standings.cards', { count: count(deck.extra) })} cards={deck.extra} frames={frames} />
        <Zone label={t('standings.side')} meta={t('standings.cards', { count: count(deck.side) })} cards={deck.side} frames={frames} />
      </div>
      {legend.length ? (
        <div className="flex flex-wrap gap-4">
          {legend.map((frame) => (
            <span key={frame} className={twMerge('inline-flex items-center gap-1.5', META)}>
              <i aria-hidden className={twMerge('h-3 w-1', FRAME_BG[frame])} />
              {t(`deck.frame.${frame === 'effect' ? 'monster' : frame}`)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

type StandingsProps = { tournament: TournamentSummary; standings: Standing[]; rounds: TournamentRound[]; frames: Frames }

/**
 * The table: rank, duelist, a pill per round, deck, record, tiebreakers, points. On a finished tournament a row is
 * a `<details>` that opens into its decklist, one at a time (`name`) with no client code; the winner's starts open.
 */
export const Standings = ({ tournament, standings, rounds, frames }: StandingsProps) => {
  const t = useTranslations('Tournaments')
  const locale = useLocale()
  const live = tournament.status === 'live'
  const [champion] = standings
  if (!champion) return <p className="text-ink-muted body-sm">{t('standings.empty')}</p>

  const pills = (id: string) => (
    <span className="flex gap-1">
      {rounds.map((round) => (
        <Pill key={round.number} result={resultIn(round, id)} label={t('rounds.inProgress')} />
      ))}
    </span>
  )

  return (
    <section aria-label={t('standings.label')} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-ink-dim signal">{t(live ? 'deck.liveLabel' : 'deck.finalLabel')}</span>
        {live ? null : <span className={META}>{t('deck.clickRow')}</span>}
      </div>

      <div className="overflow-x-auto border border-line">
        <div className="flex min-w-0 flex-col gap-px bg-line lg:min-w-240">
          <div aria-hidden className={twMerge(COLS, 'bg-surface-200 py-2.5', META)}>
            <span>{t('standings.rank')}</span>
            <span>{t('standings.duelist')}</span>
            <span className={LG}>{rounds.map((round) => `R${round.number}`).join(' · ')}</span>
            <span className={LG}>{t('standings.deck')}</span>
            <span className={twMerge(LG, 'text-right')}>{t('stats.record')}</span>
            <span className={twMerge(LG, 'text-right')}>{t('standings.omw')}</span>
            <span className={twMerge(LG, 'text-right')}>{t('standings.oomw')}</span>
            <span className="text-right">{t('standings.points')}</span>
            <span />
          </div>

          <ol className="flex flex-col gap-px">
            {standings.map((standing) => {
              const { rank, player, points, deck, tiebreakers, dropped } = standing
              const name = playerName(player, t('player.unknown'))
              const lead = deck?.archetypes[0]
              const share = deck ? deck.archetypes.reduce((sum, a) => sum + a.cards, 0) : 0
              const label = deckName(deck)

              const cells = (
                <>
                  <span className={twMerge('stat', rank === 1 ? 'text-gold' : rank <= 4 ? 'text-ink' : 'text-ink-muted')}>{rank}</span>

                  <span className="flex min-w-0 items-center gap-3">
                    <Avatar name={name} src={player.avatar} cosmetics={player.cosmetics} size="sm" className="size-8 text-xs" />
                    <span className="flex min-w-0 flex-col">
                      <Link href={`/profile/${player.id}`} className={twMerge('truncate body-strong hover:text-cyan', player.name ? 'text-ink' : 'text-ink-muted')}>
                        {name}
                      </Link>
                      {player.handle ? <span className={twMerge('truncate', META)}>{player.handle}</span> : null}
                    </span>
                    {dropped ? <Chip className="[--fill:transparent]">{t('standings.dropped')}</Chip> : null}
                  </span>

                  <span className={LG}>{pills(player.id)}</span>

                  <span className={twMerge(LG, 'flex min-w-0 items-center gap-2.5')}>
                    {live ? (
                      <span className={twMerge('inline-flex items-center gap-1.5', META)}>
                        <Icon name="lock" size={12} />
                        {t('standings.deckHidden')}
                      </span>
                    ) : (
                      <>
                        {lead ? (
                          <CardArt art={{ id: lead.art, name: lead.name }} alt="" sizes="32px" className="size-8 shrink-0" />
                        ) : (
                          <span aria-hidden className="dots size-8 shrink-0 bg-surface-200" />
                        )}
                        <span className="flex min-w-0 flex-1 flex-col gap-1.25">
                          <span className={twMerge('truncate body-sm', label ? 'text-ink' : 'text-ink-muted')}>{label ?? t('standings.noArchetype')}</span>
                          {lead && share ? (
                            <span aria-hidden className="block h-0.75 max-w-30 bg-surface-300">
                              <span className="block h-full bg-series-1" style={{ width: `${(lead.cards / share) * 100}%` }} />
                            </span>
                          ) : null}
                        </span>
                      </>
                    )}
                  </span>

                  <span className={twMerge(LG, 'text-right text-ink-dim data')}>{formatRecord(standing)}</span>
                  <span className={twMerge(LG, 'text-right text-ink-dim data')}>{formatRate(tiebreakers.opponentsMatchWin, locale)}</span>
                  <span className={twMerge(LG, 'text-right text-ink-muted data')}>{formatRate(tiebreakers.opponentsOpponentsMatchWin, locale)}</span>
                  <span className="text-right text-ink stat">{points}</span>
                </>
              )

              // The API sends no decklist while live: nothing to open until it ends.
              if (live) {
                return (
                  <li key={player.id} className={twMerge(COLS, 'bg-surface-100 py-3', dropped && 'opacity-65')}>
                    {cells}
                    <span />
                  </li>
                )
              }

              // ponytail: every decklist ships in the HTML (~7 KB gzipped each); switch to `?deck=` if 64-player events hurt.
              return (
                <li key={player.id} className="flex flex-col">
                  <details name="standing-deck" open={standing === champion} className="group">
                    <summary
                      className={twMerge(
                        COLS,
                        'cursor-pointer list-none bg-surface-100 py-3 hover:bg-surface-200 group-open:bg-surface-300 group-open:shadow-selected [&::-webkit-details-marker]:hidden',
                        dropped && 'opacity-65',
                      )}
                    >
                      {cells}
                      <Icon name="down" size={16} className="text-ink-muted group-open:rotate-180" />
                    </summary>
                    <DeckPanel deck={deck} frames={frames} anchor={standing === champion} />
                  </details>
                </li>
              )
            })}
          </ol>
        </div>
      </div>

      <span className={twMerge(META, 'leading-4')}>{t('standings.note')}</span>
    </section>
  )
}
