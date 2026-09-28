'use client'

import { twMerge } from 'tailwind-merge'
import type { LookupOption } from '@ui/index'
import { findArchetypes, searchCardArts } from '@utils/cards'
import type { CardGroup } from '@utils/panel'

export type CardRef = CardGroup['cards'][number]

/** Module-level so `useSearch` sees a stable function. */
export const findCards = (text: string, signal: AbortSignal): Promise<LookupOption[]> =>
  searchCardArts(text, 8, signal).then((cards) => cards.map((c) => ({ key: c.id, label: c.name, meta: c.id })))

export const findSetcodes = (text: string, signal: AbortSignal): Promise<LookupOption[]> =>
  findArchetypes(text, signal).then((list) => list.map((a) => ({ key: a.code, label: a.name, meta: a.code })))

const KIND_COLOR = { monster: 'bg-type-effect', spell: 'bg-type-spell', trap: 'bg-type-trap' }

/** Cards picked into a group or a Series: frame color, passcode, name, kind, remove. */
export const CardList = ({ cards, onRemove }: { cards: CardRef[]; onRemove: (id: number) => void }) => (
  <ul className="flex flex-col">
    {cards.map((c) => (
      <li key={c.id} className="grid h-11 grid-cols-[10px_96px_minmax(0,1fr)_80px_28px] items-center gap-3 border-t border-line">
        <span aria-hidden className={twMerge('size-2.5', c.kind ? KIND_COLOR[c.kind] : 'bg-line-mid')} />
        <span className="text-ink-dim data">{c.id}</span>
        <span className="truncate text-sm font-bold">{c.name ?? 'Left the card database'}</span>
        <span className="text-ink-muted signal-sm">{c.kind ?? '—'}</span>
        <button
          type="button"
          aria-label={`Remove ${c.name ?? c.id}`}
          onClick={() => onRemove(c.id)}
          className="grid size-7 cursor-pointer place-items-center text-ink-muted hover:text-crimson-lift"
        >
          <svg viewBox="0 0 24 24" width={12} height={12} aria-hidden fill="currentColor">
            <path d="M5.3 3.9 12 10.6l6.7-6.7 1.4 1.4-6.7 6.7 6.7 6.7-1.4 1.4-6.7-6.7-6.7 6.7-1.4-1.4 6.7-6.7-6.7-6.7z" />
          </svg>
        </button>
      </li>
    ))}
  </ul>
)

/** A picked card from the lookup: the kind isn't known until saved, the server fills it in. */
export const pickedCard = (option: LookupOption): CardRef => ({ id: Number(option.key), name: String(option.label), kind: null })
