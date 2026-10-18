'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { CardArt } from '@omega/card-art'
import { CopyButton } from '@omega/tournament/copy-deck'
import { banlistLabel, cardPoolYear, formatRate, formatRecord } from '@omega/tournament/labels'
import { playerName } from '@omega/tournament/player'
import { Avatar } from '@ui/avatar'
import { Chip } from '@ui/chip/chip.component'
import { Eyebrow } from '@ui/eyebrow/eyebrow'
import { Icon } from '@ui/icon'
import { Panel } from '@ui/panel'
import type { DeckCard, Standing, TournamentDeck, TournamentRound, TournamentSummary } from '@utils/types'

/** Rank, duelist and points on a phone; every column from `lg`. */
const COLS =
  'grid grid-cols-[40px_minmax(0,1fr)_auto_36px] items-center gap-3 px-4 lg:grid-cols-[56px_minmax(0,1fr)_200px_104px_56px_76px_76px_36px] lg:px-5'

const META = 'signal-sm text-ink-muted'

const total = (cards: DeckCard[]) => cards.reduce((sum, card) => sum + card.count, 0)

/** "Vanquish Soul, with Mulcharmy": the deck's top archetype, then the ones it splashes. */
const deckLine = (deck: TournamentDeck | null, fallback: string, t: ReturnType<typeof useTranslations<'Tournaments'>>) => {
  if (deck?.name) return deck.name
  const [lead, ...rest] = deck?.archetypes ?? []
  if (!lead) return deck?.archetype ?? fallback
  return rest.length ? t('detail.winnerDeck', { main: lead.name, others: rest.map((a) => a.name).join(', ') }) : lead.name
}

const Winner = ({ champion, live }: { champion: Standing; live: boolean }) => {
  const t = useTranslations('Tournaments')
  const name = playerName(champion.player, t('player.unknown'))
  return (
    <Panel tone="steel" label={t(live ? 'detail.leader' : 'detail.winner')} className="flex items-center gap-6 p-7 min-[720px]:p-7">
      <Avatar name={name} src={champion.player.avatar} cosmetics={champion.player.cosmetics} size="xl" className="max-[720px]:size-16 max-[720px]:text-2xl" />
      <div className="flex min-w-0 flex-col gap-2.5">
        <Eyebrow rule={false} meta={t('detail.winnerMeta', { kts: champion.tiebreakers.kts })}>
          {t(live ? 'detail.leader' : 'detail.winner')}
        </Eyebrow>
        <h2 className="truncate text-[clamp(32px,4vw,44px)] leading-none text-ink uppercase">
          <Link href={`/profile/${champion.player.id}`} className="text-ink hover:text-cyan">
            {name}
          </Link>
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          {champion.player.handle ? <span className="font-mono text-[13px] leading-4.5 text-ink-dim">{champion.player.handle}</span> : null}
          <Chip tone="gold">{t('detail.points', { points: champion.points })}</Chip>
          <Chip>{formatRecord(champion)}</Chip>
        </div>
        <span className="text-[15px] text-ink-dim">{deckLine(champion.deck, t(live ? 'standings.deckHidden' : 'standings.noArchetype'), t)}</span>
      </div>
    </Panel>
  )
}

const HowItRan = ({ tournament }: { tournament: TournamentSummary }) => {
  const t = useTranslations('Tournaments.detail.ran')
  const year = cardPoolYear(tournament.cardPool)
  return (
    <Panel label={t('title')} className="flex flex-col gap-4">
      <span className="text-ink display-3">{t('title')}</span>
      <ul className="flex flex-col gap-2.5 text-sm text-ink-dim">
        <li>{t('swiss', { rounds: tournament.rounds })}</li>
        <li>{t('decks', { banlist: banlistLabel(tournament) })}</li>
        {year ? <li>{t('cardPool', { year })}</li> : null}
        <li>{t('engine')}</li>
      </ul>
    </Panel>
  )
}

/** One zone of a decklist: a heading with its count, then the cards in `columns` columns from `lg`. */
const Zone = ({ label, cards, columns }: { label: string; cards: DeckCard[]; columns: string }) => {
  const t = useTranslations('Tournaments')
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-baseline gap-2.5">
        <span className="font-display text-xl leading-none text-ink uppercase">{label}</span>
        <span className={META}>{t('standings.cards', { count: total(cards) })}</span>
      </div>
      <ul className={twMerge('grid grid-cols-1 gap-x-5 sm:grid-cols-2', columns)}>
        {cards.map((card) => (
          <li key={card.id} className="grid grid-cols-[22px_20px_minmax(0,1fr)] items-center gap-2 border-b border-line py-1.5 text-[13px]">
            <span className="font-mono text-xs leading-none font-bold text-cyan">{card.count}×</span>
            <CardArt art={card} alt="" sizes="20px" className="h-7.25 w-5 rounded-xs border border-line-mid" />
            <Link href={`/wiki/card/${card.id}`} className="truncate text-ink hover:text-cyan">
              {card.name ?? t('stats.fallbackName', { id: card.id })}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

const DeckPanel = ({ id, deck }: { id: string; deck: TournamentDeck | null }) => {
  const t = useTranslations('Tournaments.standings')
  return (
    <div id={id} className="flex flex-col gap-6 border-t border-line-mid bg-surface-200 px-4 pt-6 pb-7 lg:pr-6 lg:pl-22">
      {deck ? (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <Eyebrow rule={false} className="w-auto">
              {t('registered')}
            </Eyebrow>
            <div className="flex flex-wrap gap-2">
              {deck.archetypes.map(({ name, cards }) => (
                <Chip key={name}>
                  {name} · {cards}
                </Chip>
              ))}
            </div>
            <CopyButton value={deck.code} label={t('copyCode')} icon="plus" size="sm" className="lg:ml-auto" />
          </div>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Zone label={t('main')} cards={deck.main} columns="" />
            {deck.extra.length ? <Zone label={t('extra')} cards={deck.extra} columns="sm:grid-cols-1" /> : null}
          </div>
          {deck.side.length ? <Zone label={t('side')} cards={deck.side} columns="lg:grid-cols-4" /> : null}
        </>
      ) : (
        <p className="text-sm text-ink-muted">{t('deckUnavailable')}</p>
      )}
    </div>
  )
}

type StandingsProps = { tournament: TournamentSummary; standings: Standing[]; rounds: TournamentRound[] }

/** Winner, how it ran, then the standings table. A row opens into the decklist it was registered with. */
export const Standings = ({ tournament, standings, rounds }: StandingsProps) => {
  const t = useTranslations('Tournaments')
  const locale = useLocale()
  const live = tournament.status === 'live'
  // A finished page opens on the winning deck; a live one on nothing, since rank 1 may still move.
  const [open, setOpen] = useState<string | null>(live ? null : (standings[0]?.player.id ?? null))

  const [champion] = standings
  if (!champion) return <p className="text-sm text-ink-muted">{t('standings.empty')}</p>

  // A finished tournament's unplayed matches were never played; a live one's are still running.
  const unplayed = new Map<string, number>()
  if (!live) {
    for (const match of rounds.flatMap((round) => round.matches)) {
      if (match.outcome !== 'unplayed') continue
      for (const id of [match.player1, match.player2]) unplayed.set(id, (unplayed.get(id) ?? 0) + 1)
    }
  }

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Winner champion={champion} live={live} />
        <HowItRan tournament={tournament} />
      </div>

      <div className="flex flex-col gap-px border border-line bg-line">
        <div aria-hidden className={twMerge(COLS, 'hidden bg-surface-200 py-2.5 lg:grid', META)}>
          <span className="text-center">{t('standings.rank')}</span>
          <span>{t('standings.duelist')}</span>
          <span>{t('standings.deck')}</span>
          <span className="text-right">{t('standings.record')}</span>
          <span className="text-right">{t('standings.points')}</span>
          <span className="text-right">{t('standings.omw')}</span>
          <span className="text-right">{t('standings.oomw')}</span>
          <span />
        </div>

        <ol aria-label={t('standings.label')} className="flex flex-col gap-px">
          {standings.map((standing) => {
            const { rank, player, points, deck, tiebreakers, byes, dropped } = standing
            const name = playerName(player, t('player.unknown'))
            const isOpen = open === player.id
            const panelId = `standing-${player.id}-deck`
            const missed = unplayed.get(player.id) ?? 0
            const lead = deck?.archetypes[0]

            return (
              <li key={player.id} className="flex flex-col">
                <div className={twMerge(COLS, 'py-3', isOpen ? 'bg-steel' : 'bg-surface-100')}>
                  <span
                    className={twMerge(
                      'text-center font-display text-2xl leading-none',
                      rank === 1 ? 'text-gold' : rank <= 4 ? 'text-ink' : 'text-ink-dim',
                    )}
                  >
                    {rank}
                  </span>

                  <span className="flex min-w-0 items-center gap-3">
                    <Avatar name={name} src={player.avatar} cosmetics={player.cosmetics} size="sm" />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <Link
                        href={`/profile/${player.id}`}
                        className={twMerge('truncate text-[15px] font-bold hover:text-cyan', player.name ? 'text-ink' : 'text-ink-muted')}
                      >
                        {name}
                      </Link>
                      <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
                        <span className={twMerge('truncate', META)}>{player.handle ?? t('standings.noDiscord')}</span>
                        {byes ? <span className={META}>{t('standings.byes', { count: byes })}</span> : null}
                        {missed ? <span className={META}>{t('standings.unplayed', { count: missed })}</span> : null}
                        {dropped ? <Chip tone="custom">{t('standings.dropped')}</Chip> : null}
                      </span>
                    </span>
                  </span>

                  <span className="hidden min-w-0 items-center gap-2.5 lg:flex">
                    {lead ? (
                      <CardArt
                        art={{ id: lead.art, name: lead.name }}
                        alt=""
                        sizes="28px"
                        className="h-10 w-7 shrink-0 rounded-xs border border-line-mid"
                      />
                    ) : (
                      <span className="h-10 w-7 shrink-0 rounded-xs border border-line-mid bg-surface-200" />
                    )}
                    <span className={twMerge('truncate text-sm', deck?.name ?? deck?.archetype ? 'text-ink-dim' : 'text-ink-muted')}>
                      {deck?.name ?? deck?.archetype ?? t(live ? 'standings.deckHidden' : 'standings.noArchetype')}
                    </span>
                  </span>

                  <span className="hidden text-right font-mono text-[13px] leading-none lg:block">{formatRecord(standing)}</span>
                  <span className="text-right font-display text-2xl leading-none">{points}</span>
                  <span className="hidden text-right font-mono text-xs leading-none text-ink-dim lg:block">
                    {formatRate(tiebreakers.opponentsMatchWin, locale)}
                  </span>
                  <span className="hidden text-right font-mono text-xs leading-none text-ink-dim lg:block">
                    {formatRate(tiebreakers.opponentsOpponentsMatchWin, locale)}
                  </span>

                  {/* The API sends no decklist while live: nothing to open until it ends. */}
                  {live ? (
                    <span />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : player.id)}
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      aria-label={t(isOpen ? 'standings.hideDeck' : 'standings.showDeck', { name })}
                      className={twMerge(
                        'grid size-8 cursor-pointer place-items-center border',
                        isOpen ? 'rotate-180 border-cyan text-cyan' : 'border-line-mid text-ink-dim hover:border-cyan hover:text-cyan',
                      )}
                    >
                      <Icon name="down" />
                    </button>
                  )}
                </div>

                {isOpen ? <DeckPanel id={panelId} deck={deck} /> : null}
              </li>
            )
          })}
        </ol>
      </div>

      <p className={META}>{t('standings.note')}</p>
    </>
  )
}
