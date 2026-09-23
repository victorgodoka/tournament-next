'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
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

type T = ReturnType<typeof useTranslations<'Tournaments.standings'>>

const Head = ({ t }: { t: T }) => (
  <div aria-hidden className={twMerge('border-b border-line pb-2.5 text-ink-muted signal', COLS)}>
    <span>{t('rank')}</span>
    <span>{t('duelist')}</span>
    <span className="col-start-2 row-start-2 lg:col-auto lg:row-auto">{t('deck')}</span>
    <span className={twMerge('col-start-3 row-start-1', NUMERIC)}>{t('points')}</span>
    <span className={twMerge('col-start-3 row-start-2', NUMERIC)}>{t('record')}</span>
    <span className="hidden lg:block">{t('omw')}</span>
    <span className="hidden lg:block">{t('oomw')}</span>
    <span className="hidden lg:block">{t('kts')}</span>
    <span />
  </div>
)

const slots = (deck: TournamentDeck, t: T) =>
  [
    { label: t('main'), cards: deck.main },
    { label: t('extra'), cards: deck.extra },
    { label: t('side'), cards: deck.side },
  ].filter((slot) => slot.cards.length)

const total = (cards: DeckCard[]) => cards.reduce((sum, card) => sum + card.count, 0)

const DeckPanel = ({ id, deck }: { id: string; deck: TournamentDeck | null }) => {
  const t = useTranslations('Tournaments')
  const ts = useTranslations('Tournaments.standings')
  if (!deck) {
    return (
      <div id={id} className="border border-line bg-surface-100 px-4.5 py-4 text-ink-muted body-sm">
        {t('standings.deckUnavailable')}
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
        {slots(deck, ts)
          .map((slot) => `${slot.label} ${total(slot.cards)}`)
          .join(' · ')}
        {deck.name ? '' : ` · ${t('standings.noDeckName')}`}
      </p>

      {slots(deck, ts).map(({ label, cards }) => (
        <div key={label} className="mt-3.5">
          <p className="text-ink-dim signal">{label}</p>
          <ul className="mt-2 grid grid-cols-2 gap-px border border-line bg-line lg:grid-cols-3">
            {cards.map((card) => (
              <li key={card.id} className="flex items-center gap-2.5 bg-surface-000 p-2.5">
                <CardArt art={card} alt="" sizes="38px" className="size-9.5 shrink-0 border border-line" />
                <span className="min-w-0">
                  <span className="block truncate text-ink body-sm">{card.name ?? t('cards.fallbackName', { id: card.id })}</span>
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

const note = ({ player, byes, dropped }: Standing, t: T) => {
  const parts = [player.handle, byes ? t('byes', { count: byes }) : null, dropped ? t('dropped') : null]
  return parts.filter(Boolean).join(' · ') || t('noDiscord')
}

/** Standings table. A row opens into the decklist it was registered with. */
export const Standings = ({ standings }: { standings: Standing[] }) => {
  const t = useTranslations('Tournaments')
  const ts = useTranslations('Tournaments.standings')
  const [open, setOpen] = useState<number | null>(null)

  if (!standings.length) {
    return <p className="text-ink-muted body-sm">{ts('empty')}</p>
  }

  return (
    <>
      <Head t={ts} />
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
                      {playerName(player, t('player.unknown'))}
                    </span>
                    <span className="block truncate text-ink-muted signal">{note(standing, ts)}</span>
                  </span>
                </span>

                <span className="col-start-2 row-start-2 flex min-w-0 items-center gap-2 lg:col-auto lg:row-auto">
                  {cover ? (
                    <CardArt art={cover} alt="" sizes="24px" className="size-6 shrink-0 border border-line" />
                  ) : null}
                  <span className="truncate text-ink-dim signal">{deck?.archetype ?? t('detail.unclassified')}</span>
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

      <p className="mt-3.5 max-w-[72ch] text-ink-muted signal">{ts('note')}</p>
    </>
  )
}
