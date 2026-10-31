'use client'

import { useState } from 'react'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'
import { buttonClasses } from '@ui/button'
import { Icon } from '@ui/icon'
import { CardResults, useCardSearch } from './wiki-bar'
import { WIKI_CHIP, WIKI_CHIP_ON } from './wiki'

type Mode = 'articles' | 'cards'

const MODES: { id: Mode; label: string; placeholder: string }[] = [
  { id: 'articles', label: 'Articles', placeholder: 'Search articles by title' },
  { id: 'cards', label: 'Cards', placeholder: 'Search cards by name or passcode' },
]

type WikiSearchProps = {
  defaultQuery?: string
  /** The index's other filters, kept across a new article search. */
  keep?: Record<string, string | undefined>
}

/**
 * The index's search. Articles is a plain GET form, so it works without JavaScript; Cards answers in place.
 * One box: switching keeps what was typed.
 */
export const WikiSearch = ({ defaultQuery = '', keep = {} }: WikiSearchProps) => {
  const [mode, setMode] = useState<Mode>('articles')
  const [query, setQuery] = useState(defaultQuery)
  const { open, label, cards } = useCardSearch(query, mode === 'cards')
  const placeholder = MODES.find((item) => item.id === mode)?.placeholder

  return (
    <form
      role="search"
      method="get"
      action="/wiki#articles"
      onSubmit={(event) => mode === 'cards' && event.preventDefault()}
      className="flex w-full max-w-170 flex-col gap-2.5 sm:gap-3"
    >
      <div role="group" aria-label="Search in" className="flex">
        {MODES.map((item, i) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={mode === item.id}
            onClick={() => setMode(item.id)}
            className={twMerge(WIKI_CHIP, 'max-sm:min-h-10 max-sm:flex-1 max-sm:justify-center', i && '-ml-px', mode === item.id && WIKI_CHIP_ON)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex items-stretch gap-2.5 sm:gap-3">
        <label className="cut flex min-h-13 min-w-0 flex-1 items-center gap-2 px-3.5 text-ink-muted [--edge:var(--color-line-strong)] [--fill:var(--color-surface-200)] sm:gap-2.5 sm:px-4">
          <span className="sr-only">Search the wiki</span>
          <Icon name="search" size={20} />
          <input
            type="search"
            name={mode === 'articles' ? 'q' : undefined}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            maxLength={100}
            placeholder={placeholder}
            className="h-12.5 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-muted"
          />
        </label>
        {Object.entries(keep).map(([name, value]) => (value ? <input key={name} type="hidden" name={name} value={value} /> : null))}
        <button type="submit" className={twMerge(buttonClasses({ variant: 'primary', size: 'signal' }), 'min-h-13 px-6 max-sm:hidden')}>
          Search
        </button>
      </div>

      {open ? <CardResults label={label} cards={cards} className="border border-cyan px-3.5" /> : null}
    </form>
  )
}

/** The header's search on an article: Enter searches titles, typing offers cards. A link to the index where the field wouldn't fit. */
export const HeaderSearch = () => {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const { open, label, cards } = useCardSearch(query, focused)

  return (
    <>
      <form
        role="search"
        method="get"
        action="/wiki#articles"
        onFocus={() => setFocused(true)}
        onBlur={(event) => !event.currentTarget.contains(event.relatedTarget) && setFocused(false)}
        className="relative hidden w-60 min-w-40 min-[1440px]:block"
      >
        <label className="cut flex h-10 items-center gap-2 px-3 text-ink-muted [--fill:var(--color-surface-200)]">
          <span className="sr-only">Search the wiki</span>
          <Icon name="search" size={16} />
          <input
            type="search"
            name="q"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            maxLength={100}
            placeholder="Search articles or cards"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
          />
        </label>
        {open ? <CardResults label={label} cards={cards} className="absolute top-full right-0 z-(--z-dropdown) mt-2 w-90 border px-3.5" /> : null}
      </form>

      {/* The field needs 1440px, and gives way to a wide account cell by shrinking down to 160px. */}
      <Link href="/wiki" aria-label="Search the wiki" className={twMerge(buttonClasses({ variant: 'secondary', size: 'icon' }), 'min-[1440px]:hidden')}>
        <Icon name="search" size={18} />
      </Link>
    </>
  )
}
