'use client'

import { useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { CardArt } from '@omega/card-art'
import { formatNumber } from '@omega/tournament/labels'
import type { CardStat } from '@utils/types'

type Zone = 'all' | 'main' | 'extra' | 'side'

const ZONES: { id: Zone; label: string }[] = [
  { id: 'all', label: 'Anywhere' },
  { id: 'main', label: 'Main' },
  { id: 'extra', label: 'Extra' },
  { id: 'side', label: 'Side' },
]

/** Decks that carried the card, in games. Draws are dropped when there are none — usually. */
const deckRecord = ({ wins, loses, draws }: CardStat) => `${wins}W–${loses}L${draws ? `–${draws}D` : ''}`

/** "main 13 · side 3": the zones the card actually appears in. */
const zoneNote = (card: CardStat) =>
  (
    [
      ['main', card.main],
      ['extra', card.extra],
      ['side', card.side],
    ] as const
  )
    .filter(([, zone]) => zone.decks)
    .map(([label, zone]) => `${label} ${formatNumber(zone.decks)}`)
    .join(' · ')

/**
 * Top cards, filterable by zone. "Staple of main" and "staple of side" are different questions,
 * and the API answers both — so a side-deck card doesn't get buried by main-deck volume.
 */
export const CardBoard = ({ cards }: { cards: CardStat[] }) => {
  const [zone, setZone] = useState<Zone>('all')

  const shown = useMemo(() => {
    if (zone === 'all') return cards
    return cards.filter((card) => card[zone].decks).sort((a, b) => b[zone].decks - a[zone].decks)
  }, [cards, zone])

  // A card name can arrive twice under two passcodes (reprints, alternate art). Showing the
  // passcode on those rows keeps it legible as two printings instead of a duplicate row.
  const repeated = useMemo(() => {
    const seen = new Map<string, number>()
    for (const card of cards) {
      if (card.name) seen.set(card.name, (seen.get(card.name) ?? 0) + 1)
    }
    return new Set([...seen].filter(([, count]) => count > 1).map(([name]) => name))
  }, [cards])

  return (
    <>
      <div className="mt-3 flex flex-wrap gap-2">
        {ZONES.map(({ id, label }) => {
          const on = zone === id
          return (
            <button
              key={id}
              type="button"
              aria-pressed={on}
              onClick={() => setZone(id)}
              className={twMerge(
                'min-h-11 cursor-pointer border px-3 signal-chip',
                on ? 'border-gold bg-ground-gold text-gold' : 'border-line text-ink-dim hover:border-gold hover:text-gold',
              )}
            >
              {label}
            </button>
          )
        })}
      </div>

      <ul className="mt-3 grid grid-cols-1 gap-px border border-line bg-line lg:grid-cols-2">
        {shown.map((card) => (
          <li key={card.id} className="flex items-center gap-3 bg-surface-000 p-3">
            <CardArt art={card} alt="" sizes="44px" className="size-11 shrink-0 border border-line" />
            <span className="min-w-0">
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="truncate text-ink body-sm">{card.name ?? `Card ${card.id}`}</span>
                {card.name && repeated.has(card.name) ? (
                  <span className="shrink-0 text-ink-muted mono-handle">{card.id}</span>
                ) : null}
              </span>
              <span className="block text-ink-muted mono-data">
                {formatNumber(card.decks)} decks · {formatNumber(card.copies)} copies
              </span>
              <span className="block truncate text-ink-muted signal">
                {zoneNote(card)} · decks running it: {deckRecord(card)}
              </span>
            </span>
          </li>
        ))}
      </ul>

      {shown.length ? null : <p className="mt-3 text-ink-muted body-sm">No card in this tournament sat in that zone.</p>}
    </>
  )
}
