'use client'

import { useCallback } from 'react'
import { twMerge } from 'tailwind-merge'
import { Tag } from '@ui/chip'
import { FIELD } from '@ui/field'
import { Icon } from '@ui/icon'
import { Lookup, type LookupOption } from '@ui/lookup'
import { archKey, type LeanArchetype } from '@utils/statistics'
import { Art, faceOf, nameOf, num } from '../DeepDive'

/** A text filter over rows already on the page (no dropdown): the table below narrows as you type. */
export const FilterField = ({ label, value, onChange, className }: { label: string; value: string; onChange: (value: string) => void; className?: string }) => (
  <label className={twMerge(FIELD, 'h-9 min-w-0 max-w-xs [--cut:var(--cut-xs)]', className)}>
    <Icon name="search" size={16} />
    <span className="sr-only">{label}</span>
    <input
      type="search"
      value={value}
      placeholder={label}
      onChange={(e) => onChange(e.target.value)}
      className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
    />
  </label>
)

/** Case-insensitive "contains". */
export const matches = (name: string, query: string) => name.toLowerCase().includes(query.trim().toLowerCase())

/**
 * Chosen decks as removable chips, plus a field that adds any other deck of `pool`, up to `max`.
 * Used for the matrix columns and the trend lines.
 */
export const DeckPicker = <A extends LeanArchetype>({ pool, selected, onChange, max, label, removeLabel }: {
  pool: A[]
  selected: string[]
  onChange: (keys: string[]) => void
  max: number
  label: string
  removeLabel: (name: string) => string
}) => {
  const byKey = new Map(pool.map((a) => [archKey(a.archetype), a]))
  // Lookup wants a stable search: it changes only with the data or a pick.
  const search = useCallback(
    async (text: string): Promise<LookupOption[]> =>
      pool
        .filter((a) => !selected.includes(archKey(a.archetype)) && matches(nameOf(a), text))
        .slice(0, 12)
        .map((a) => ({ key: archKey(a.archetype), label: nameOf(a), meta: `${num(a.games)}` })),
    [pool, selected],
  )
  return (
    <div className="flex flex-wrap items-center gap-2">
      {selected.flatMap((key) => {
        const a = byKey.get(key)
        return a
          ? [
              <Tag key={key} removeLabel={removeLabel(nameOf(a))} onRemove={() => onChange(selected.filter((k) => k !== key))}>
                <Art card={faceOf(a)} size={20} className="size-5" />
                <span className="max-w-36 truncate">{nameOf(a)}</span>
              </Tag>,
            ]
          : []
      })}
      {selected.length < max ? (
        <Lookup compact label={label} placeholder={label} search={search} onPick={({ key }) => onChange([...selected, String(key)])} className="w-56" />
      ) : null}
    </div>
  )
}

