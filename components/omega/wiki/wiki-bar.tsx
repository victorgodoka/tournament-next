'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { searchCards } from '@utils/cards'
import type { CardArt } from '@utils/types'
import { WIKI_PAD } from './wiki'

type WikiBarProps = {
  /** Breadcrumb tail under "Omega Wiki", e.g. `Cards`. */
  section: string
  placeholder: string
  /** The cross-link on the right of the bar. */
  link: { label: string; to: string }
}

/** The last answer the server gave, tagged with the query that asked for it. */
type Answer = { query: string; cards: CardArt[]; failed: boolean }

/**
 * Breadcrumb, card search and cross-link. The query is debounced so a *settled* search is what hits
 * `GET /cards`: the endpoint is cached publicly for an hour, and a request per keystroke never
 * reuses that cache.
 */
export const WikiBar = ({ section, placeholder, link }: WikiBarProps) => {
  const [query, setQuery] = useState('')
  const [answer, setAnswer] = useState<Answer | null>(null)

  const text = query.trim()
  const open = text.length >= 2
  // Tagging the answer with its query is what makes stale results disappear the moment the box
  // changes, without an effect that resets state on every keystroke.
  const shown = answer?.query === text ? answer : null

  useEffect(() => {
    if (text.length < 2) return

    const controller = new AbortController()
    const timer = setTimeout(() => {
      searchCards(text, 8, controller.signal)
        .then((cards) => setAnswer({ query: text, cards, failed: false }))
        .catch((error: Error) => {
          if (error.name !== 'AbortError') setAnswer({ query: text, cards: [], failed: true })
        })
    }, 300)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [text])

  const label = !shown
    ? `Searching for “${text}”…`
    : shown.failed
      ? 'Search is unavailable right now'
      : shown.cards.length
        ? `${shown.cards.length} match${shown.cards.length === 1 ? '' : 'es'} for “${text}”`
        : `No cards match “${text}”`

  return (
    <>
      <div className={`flex flex-wrap items-center gap-3.5 border-b border-line bg-ground-subtle py-2.75 ${WIKI_PAD}`}>
        <span className="whitespace-nowrap text-ink-muted signal">Omega Wiki</span>
        <span aria-hidden className="font-mono text-[10px] text-ink-muted">/</span>
        <span className="whitespace-nowrap text-ink-muted signal">{section}</span>

        <span className="min-w-0 flex-[1_1_12rem]">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
            aria-label="Search the card database"
            className="w-full border border-surface-400 bg-surface-200 px-2.75 py-2.25 text-[13px] text-ink placeholder:text-ink-muted hover:border-ink-muted focus-visible:border-cyan"
          />
        </span>

        <Link href={link.to} className="whitespace-nowrap text-gold signal-nav text-[10px] hover:text-cyan">
          {link.label}
        </Link>
      </div>

      {open ? (
        <div className={`border-b border-cyan bg-ground-cyan py-3.5 ${WIKI_PAD}`} aria-live="polite">
          <p className="text-cyan signal">{label}</p>
          {shown?.cards.length ? (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {shown.cards.map((card) => (
                <Link
                  key={card.id}
                  href={`/wiki/card/${card.id}`}
                  className="inline-flex items-baseline gap-2 border border-line bg-surface-000 px-2.75 py-1.75 text-[13px] font-bold text-ink hover:bg-gold hover:text-gold-on"
                >
                  <span>{card.name ?? 'Unknown card'}</span>
                  <span className="mono-handle">{card.id}</span>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  )
}
