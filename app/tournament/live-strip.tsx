'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { TIME_ONLY } from '@omega/tournament/labels'
import { Button } from '@ui/button'

/** The API's own advice for a running tournament: re-read it every 30 s until it finishes. */
const POLL_S = 30
const subscribe = () => () => {}

type LiveStripProps = {
  round: number
  rounds: number
  /** Matches of the round with a result, out of `total`. */
  done: number
  total: number
  /** When the page read the API, ISO. */
  updatedAt: string
}

/**
 * The band under the header while the tournament runs: the round, how many of its matches are in, when the
 * page last read the API and a countdown to the next read. Refresh reads it now. A hidden tab is nobody
 * watching: the countdown pauses and the page catches up on the way back.
 */
export const LiveStrip = ({ round, rounds, done, total, updatedAt }: LiveStripProps) => {
  const router = useRouter()
  const t = useTranslations('Tournaments.live')
  const locale = useLocale()
  const isBrowser = useSyncExternalStore(subscribe, () => true, () => false)
  const [left, setLeft] = useState(POLL_S)
  // Restarts the countdown from inside the interval's closure, for the Refresh button.
  const restart = useRef(() => {})

  useEffect(() => {
    let seconds = POLL_S
    const reset = () => {
      seconds = POLL_S
      setLeft(seconds)
    }
    restart.current = reset
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      seconds -= 1
      if (seconds <= 0) {
        router.refresh()
        seconds = POLL_S
      }
      setLeft(seconds)
    }, 1000)
    const back = () => {
      if (document.visibilityState !== 'visible') return
      router.refresh()
      reset()
    }
    document.addEventListener('visibilitychange', back)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', back)
    }
  }, [router])

  const refresh = () => {
    router.refresh()
    restart.current()
  }

  // The server can't know the time zone: UTC until hydration, like LocalTime.
  const time = new Date(updatedAt).toLocaleTimeString(locale, isBrowser ? TIME_ONLY : { ...TIME_ONLY, timeZone: 'UTC' })

  return (
    <div className="border-b border-cyan/25 bg-ground-cyan">
      <div className="mx-auto flex min-h-11 w-full max-w-page flex-wrap items-center gap-x-4 gap-y-2 px-gutter py-2">
        <span aria-hidden className="size-2 shrink-0 rounded-round bg-cyan shadow-glow-live" />
        <span className="text-cyan signal-strong">{t('round', { round, rounds })}</span>
        <span className="text-ink-dim signal-sm">{t('done', { done, total })}</span>
        <span className="flex-1" />
        <span className="text-ink-dim signal-sm">
          {t('updated', { time })} · {t('nextCheck', { seconds: left })}
        </span>
        <Button variant="secondary" size="mono" onClick={refresh} className="[--fill:var(--color-ground-cyan)]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
            <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
          </svg>
          {t('refresh')}
        </Button>
      </div>
    </div>
  )
}
