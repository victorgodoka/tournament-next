'use client'

import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { useSearch } from '@hooks/index'
import { FIELD } from '@ui/field'
import { Icon } from '@ui/icon'

export type LookupOption = { key: string | number; label: React.ReactNode; meta?: React.ReactNode }

type LookupProps = {
  /** Names the input. */
  label: string
  placeholder?: string
  /** Called 250 ms after typing stops, from two characters. Must be stable (module-level or memoized). */
  search: (text: string, signal: AbortSignal) => Promise<LookupOption[]>
  onPick: (option: LookupOption) => void
  /** Keys already picked: left out of the results, so a list never offers what it holds. */
  exclude?: readonly (string | number)[]
  /** 32px plate for an inline "add" next to tags. */
  compact?: boolean
  className?: string
}

/**
 * A search field whose results drop below it as buttons. Picking one clears the text, so the same
 * field adds the next one.
 */
export const Lookup = ({ label, placeholder, search, onPick, exclude, compact, className }: LookupProps) => {
  const [text, setText] = useState('')
  const found = useSearch(text, search)
  const hidden = new Set(exclude?.map(String))
  const results = hidden.size ? found.filter((option) => !hidden.has(String(option.key))) : found

  return (
    <div className={twMerge('relative min-w-0', className)}>
      <label className={twMerge(FIELD, 'min-w-0', compact && 'h-8 [--cut:var(--cut-xs)]')}>
        <Icon name="search" size={16} />
        <span className="sr-only">{label}</span>
        <input
          type="search"
          value={text}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          className={twMerge('min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-ink-muted', compact ? 'text-sm' : 'body')}
        />
      </label>
      {results.length ? (
        <ul className="absolute inset-x-0 top-full z-(--z-dropdown) mt-1 max-h-72 overflow-y-auto border border-line-mid bg-surface-200 shadow-lift">
          {results.map((option) => (
            <li key={option.key}>
              <button
                type="button"
                onClick={() => {
                  onPick(option)
                  setText('')
                }}
                className="flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left text-sm text-ink hover:bg-surface-300 focus-visible:bg-surface-300"
              >
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {option.meta ? <span className="shrink-0 text-ink-muted data">{option.meta}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
