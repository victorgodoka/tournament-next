'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'
import { Icon } from '@omega-hub/ds'
import { CardArt } from '@omega/card-art'

export type MetaDeck = { id: number; name: string; note: string }

const SCALE = [1, 0.84, 0.7, 0.6]
const ALPHA = [1, 0.55, 0.2, 0]
export const STEP_MS = 4500

/**
 * Coverflow of the top decks: advances every 4.5s, pauses under the pointer or focus, stops for good with its pause
 * button, holds still on reduced motion. `ranked` false is the static fallback list: no rank badges, no rank claims.
 */
export const MetaCarousel = ({ decks, ranked = true }: { decks: MetaDeck[]; ranked?: boolean }) => {
  const [cur, setCur] = useState(0)
  const [hovered, setHovered] = useState(false)
  const [stopped, setStopped] = useState(false)
  const total = decks.length

  useEffect(() => {
    if (hovered || stopped || total < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = setInterval(() => setCur((i) => (i + 1) % total), STEP_MS)
    return () => clearInterval(timer)
  }, [hovered, stopped, total])

  return (
    <div
      className="ol-car"
      role="region"
      aria-roledescription="carousel"
      aria-label={ranked ? `Top ${total} decks in ranked` : 'Popular decks'}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      <div className="ol-car-track">
        {decks.map((deck, i) => {
          let o = (((i - cur) % total) + total) % total
          if (o > total / 2) o -= total
          const a = Math.min(Math.abs(o), 3)
          const style = { '--o': Math.max(-3, Math.min(3, o)), '--s': SCALE[a], '--a': ALPHA[a], '--z': 10 - a } as React.CSSProperties
          return (
            // Index keys: two decks can share a face card (`A` and `A>B`), and the list never reorders.
            <Link
              key={i}
              href={`/wiki/card/${deck.id}`}
              className={twMerge('ol-car-card cut notch', o === 0 && 'is-center', a >= 3 && 'is-off')}
              style={style}
              tabIndex={o === 0 ? 0 : -1}
              aria-label={ranked ? `${deck.name}, number ${i + 1} in ranked, ${deck.note}` : `${deck.name}, ${deck.note}`}
              onClick={(e) => {
                if (o !== 0) {
                  e.preventDefault()
                  setCur(i)
                }
              }}
            >
              {ranked ? <span className={twMerge('ol-hrank', i === 0 && 'ol-hrank--1')}>#{i + 1}</span> : null}
              <CardArt art={{ id: deck.id, name: deck.name }} alt="" sizes="220px" className="ol-car-art" />
              <span className="ol-car-body">
                <span className="title display-3 text-ink">{deck.name}</span>
                <span className="body-sm">{deck.note}</span>
              </span>
            </Link>
          )
        })}
      </div>
      <div className="ol-car-dots">
        <button
          type="button"
          className="ol-car-toggle"
          aria-label={stopped ? 'Play carousel' : 'Pause carousel'}
          aria-pressed={stopped}
          onClick={() => setStopped((s) => !s)}
        >
          <Icon name={stopped ? 'play' : 'pause'} size={16} />
        </button>
        {decks.map((deck, i) => (
          <button
            key={i}
            type="button"
            className={twMerge('ol-dot', i === cur && 'is-on')}
            aria-label={`Show ${deck.name}`}
            aria-current={i === cur}
            onClick={() => setCur(i)}
          />
        ))}
      </div>
    </div>
  )
}
