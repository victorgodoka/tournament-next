'use client'

import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { CardArt } from '@omega/card-art'
import { CopyDeckButton } from '@omega/tournament/copy-deck'
import { formatRate, formatRecord } from '@omega/tournament/labels'
import { PlayerAvatar, playerName } from '@omega/tournament/player'
import type { DeckCard, Standing, TournamentDeck } from '@utils/types'

/**
 * Three columns on a phone (rank, duelist, points) with deck and record on a second line;
 * eight columns from `lg`, where every tiebreaker gets its own.
 */
const COLS =
  'grid grid-cols-[44px_minmax(0,1fr)_auto_20px] items-center gap-x-3.5 gap-y-1.5 ' +
  'lg:grid-cols-[44px_minmax(0,1.4fr)_minmax(0,1fr)_58px_96px_74px_74px_104px_20px] lg:gap-x-3.5'

const NUMERIC = 'text-right lg:text-left lg:col-auto lg:row-auto'

const Head = () => (
  <div aria-hidden className={twMerge('border-b border-line pb-2.5 text-ink-muted signal', COLS)}>
    <span>#</span>
    <span>Duelist</span>
    <span className="col-start-2 row-start-2 lg:col-auto lg:row-auto">Deck</span>
    <span className={twMerge('col-start-3 row-start-1', NUMERIC)}>Pts</span>
    <span className={twMerge('col-start-3 row-start-2', NUMERIC)}>W–L–D</span>
    <span className="hidden lg:block">OMW</span>
    <span className="hidden lg:block">OOMW</span>
    <span className="hidden lg:block">KTS</span>
    <span />
  </div>
)

const slots = (deck: TournamentDeck) =>
  [
    { label: 'Main', cards: deck.main },
    { label: 'Extra', cards: deck.extra },
    { label: 'Side', cards: deck.side },
  ].filter((slot) => slot.cards.length)

const total = (cards: DeckCard[]) => cards.reduce((sum, card) => sum + card.count, 0)

const DeckPanel = ({ id, deck }: { id: string; deck: TournamentDeck | null }) => {
  if (!deck) {
    return (
      <div id={id} className="border border-line bg-surface-100 px-4.5 py-4 text-ink-muted body-sm">
        The stored deck code couldn&apos;t be decoded, so this list is unavailable.
      </div>
    )
  }

  return (
    <div id={id} className="border border-line bg-surface-100 px-[clamp(14px,2vw,20px)] py-[clamp(14px,2vw,20px)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-wrap gap-2">
          {deck.archetypes.map(({ name, cards, art }, index) => (
            <li
              key={name}
              className={twMerge(
                'flex items-center gap-2 border py-1.25 pr-2 pl-1.25 signal-chip',
                index === 0 ? 'border-gold text-gold' : 'border-line text-ink-dim',
              )}
            >
              <CardArt art={{ id: art, name }} alt="" sizes="20px" className="size-5 shrink-0" />
              {name} · {cards}
            </li>
          ))}
        </ul>
        <CopyDeckButton code={deck.code} />
      </div>

      <p className="mt-4 text-ink-muted signal">
        {slots(deck)
          .map((slot) => `${slot.label} ${total(slot.cards)}`)
          .join(' · ')}
        {deck.name ? '' : ' · deck name not categorised yet'}
      </p>

      {slots(deck).map(({ label, cards }) => (
        <div key={label} className="mt-3.5">
          <p className="text-ink-dim signal">{label}</p>
          <ul className="mt-2 grid grid-cols-2 gap-px border border-line bg-line lg:grid-cols-3">
            {cards.map((card) => (
              <li key={card.id} className="flex items-center gap-2.5 bg-surface-000 p-2.5">
                <CardArt art={card} alt="" sizes="38px" className="size-9.5 shrink-0 border border-line" />
                <span className="min-w-0">
                  <span className="block truncate text-ink body-sm">{card.name ?? `Card ${card.id}`}</span>
                  <span className="block text-ink-muted signal">×{card.count}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

const note = ({ player, byes, dropped }: Standing) => {
  const parts = [player.handle, byes ? `${byes} bye${byes > 1 ? 's' : ''}` : null, dropped ? 'dropped' : null]
  return parts.filter(Boolean).join(' · ') || 'no Discord data'
}

/** Standings table. A row opens into the decklist it was registered with. */
export const Standings = ({ standings }: { standings: Standing[] }) => {
  const [open, setOpen] = useState<number | null>(null)

  if (!standings.length) {
    return <p className="text-ink-muted body-sm">No entrants recorded yet.</p>
  }

  return (
    <>
      <Head />
      <ul>
        {standings.map((standing) => {
          const { rank, player, points, deck, tiebreakers } = standing
          // The top archetype's most-copied card in *this* deck, which the API picks as its face.
          const lead = deck?.archetypes[0]
          const cover = lead ? { id: lead.art, name: lead.name } : null
          const isOpen = open === rank
          const panelId = `standing-${rank}-deck`

          return (
            <li key={player.id} className={twMerge('border-b border-line', isOpen && 'bg-ground-subtle')}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : rank)}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className={twMerge('w-full cursor-pointer py-3.5 text-left hover:bg-ground-soft', COLS)}
              >
                <span className={twMerge('display-5 tabular-nums', rank === 1 ? 'text-gold' : 'text-ink-dim')}>
                  {rank}
                </span>

                <span className="flex min-w-0 items-center gap-2.5">
                  <PlayerAvatar player={player} />
                  <span className="min-w-0">
                    <span className={twMerge('block truncate body-strong', player.name ? 'text-ink' : 'text-ink-muted')}>
                      {playerName(player)}
                    </span>
                    <span className="block truncate text-ink-muted signal">{note(standing)}</span>
                  </span>
                </span>

                <span className="col-start-2 row-start-2 flex min-w-0 items-center gap-2 lg:col-auto lg:row-auto">
                  {cover ? (
                    <CardArt art={cover} alt="" sizes="24px" className="size-6 shrink-0 border border-line" />
                  ) : null}
                  <span className="truncate text-ink-dim signal">{deck?.archetype ?? 'Unclassified'}</span>
                </span>

                <span
                  className={twMerge(
                    'col-start-3 row-start-1 mono-data tabular-nums',
                    rank === 1 ? 'text-gold' : 'text-ink',
                    NUMERIC,
                  )}
                >
                  {points}
                </span>
                <span className={twMerge('col-start-3 row-start-2 text-ink-dim mono-data tabular-nums', NUMERIC)}>
                  {formatRecord(standing)}
                </span>
                <span className="hidden text-ink-muted mono-data tabular-nums lg:block">
                  {formatRate(tiebreakers.opponentsMatchWin)}
                </span>
                <span className="hidden text-ink-muted mono-data tabular-nums lg:block">
                  {formatRate(tiebreakers.opponentsOpponentsMatchWin)}
                </span>
                <span className="hidden text-ink-muted mono-data tabular-nums lg:block">{tiebreakers.kts}</span>

                <svg
                  aria-hidden
                  viewBox="0 0 12 12"
                  className={twMerge(
                    'col-start-4 row-start-1 size-3 text-ink-muted lg:col-auto lg:row-auto',
                    isOpen && 'rotate-180 text-gold',
                  )}
                >
                  <path d="M2 4.5 L6 8.5 L10 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </button>

              {isOpen ? (
                <div className="pb-5">
                  <DeckPanel id={panelId} deck={deck} />
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>

      <p className="mt-3.5 text-ink-muted signal">
        Open a row for the decklist it was registered with. Rank and tiebreakers are computed from the records — the game stores neither. KTS is points, OMW% and OOMW% in
        eight digits, and the order sorts on it.
      </p>
    </>
  )
}
