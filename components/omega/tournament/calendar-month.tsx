'use client'

import { useState, useSyncExternalStore } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { LocalTime } from '@omega/profile/local-time'
import { CalendarRow, calendarKey } from '@omega/tournament/calendar-row'
import { TIME_ONLY, formatTone } from '@omega/tournament/labels'
import type { CalendarEntry } from '@utils/types'

const subscribe = () => () => {}
const DAY_MS = 86_400_000

/** `YYYY-MM-DD` of an instant: the reader's day in the browser, UTC on the server (it can't know the zone). */
const dayOf = (at: Date, local: boolean) =>
  local
    ? `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`
    : at.toISOString().slice(0, 10)

const todayKey = () => dayOf(new Date(), true)

/** The bar and dot of a format: the same colors as its chip. */
const FORMAT_COLOR = {
  tcg: 'var(--color-ladder-tcg)',
  genesys: 'var(--color-ladder-genesys)',
  ocg: 'var(--color-series-4)',
  cyan: 'var(--color-cyan)',
  neutral: 'var(--color-ink-muted)',
} as const
const colorOf = (entry: CalendarEntry) => FORMAT_COLOR[entry.format ? formatTone(entry.format) : 'neutral']

/** Shown per day before "+N". */
const PER_DAY = 3

/**
 * A month as a Sunday-first grid. Each tournament sits on its day in the reader's time zone (UTC
 * until hydration); a day opens its tournaments below the grid. `month` is `YYYY-MM`.
 */
export const CalendarMonth = ({ month, entries }: { month: string; entries: CalendarEntry[] }) => {
  const t = useTranslations('Calendar')
  const locale = useLocale()
  const local = useSyncExternalStore(subscribe, () => true, () => false)
  const today = useSyncExternalStore(subscribe, todayKey, () => null)
  const [picked, setPicked] = useState<string | null>(null)

  const byDay = new Map<string, CalendarEntry[]>()
  for (const entry of entries) {
    const key = dayOf(new Date(entry.startsAt), local)
    byDay.set(key, [...(byDay.get(key) ?? []), entry])
  }

  const first = Date.parse(`${month}-01T00:00:00Z`)
  const lead = new Date(first).getUTCDay()
  const days = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate()
  const cells = Array.from({ length: Math.ceil((lead + days) / 7) * 7 }, (_, i) => new Date(first + (i - lead) * DAY_MS).toISOString().slice(0, 10))
  const inMonth = (key: string) => key.startsWith(month)

  const selected = picked ?? (today && inMonth(today) ? today : cells.find((key) => inMonth(key) && byDay.has(key)) ?? null)
  const dayEntries = selected ? (byDay.get(selected) ?? []) : []
  // 4 Jan 2026 was a Sunday: the week's short names in the page's language.
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Date(Date.UTC(2026, 0, 4 + i)).toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' }),
  )
  const longDay = (key: string) =>
    new Date(`${key}T00:00:00Z`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })

  return (
    <div className="flex flex-col gap-6">
      <div role="grid" aria-label={t('grid')} className="grid grid-cols-7 gap-px border border-line bg-line">
        {weekdays.map((name) => (
          <span key={name} role="columnheader" className="bg-surface-200 px-2 py-2 text-center text-ink-muted signal-sm">
            {name}
          </span>
        ))}
        {cells.map((key) => {
          const list = byDay.get(key) ?? []
          const outside = !inMonth(key)
          return (
            <button
              key={key}
              type="button"
              role="gridcell"
              aria-selected={key === selected}
              aria-label={t('dayLabel', { day: longDay(key), count: list.length })}
              onClick={() => setPicked(key)}
              className={twMerge(
                'flex min-h-16 min-w-0 cursor-pointer flex-col gap-1.5 bg-surface-100 p-1.5 text-left transition-colors hover:bg-surface-200 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-cyan min-[720px]:min-h-28 min-[720px]:p-2',
                outside && 'bg-space-000 text-ink-muted',
                key === selected && 'bg-ground-cyan shadow-selected hover:bg-ground-cyan',
              )}
            >
              <span
                className={twMerge(
                  'flex size-6 items-center justify-center font-mono text-xs tabular-nums',
                  outside ? 'text-ink-muted' : 'text-ink',
                  key === today && 'border border-cyan font-bold text-cyan',
                )}
              >
                {Number(key.slice(8))}
              </span>
              {/* Phone: one dot per tournament. */}
              {list.length ? (
                <span aria-hidden className="flex flex-wrap gap-1 min-[720px]:hidden">
                  {list.map((entry) => (
                    <span key={calendarKey(entry)} className="size-1.5 rounded-round" style={{ background: colorOf(entry) }} />
                  ))}
                </span>
              ) : null}
              <span className="flex min-w-0 flex-col gap-1 max-[720px]:hidden">
                {list.slice(0, PER_DAY).map((entry) => (
                  <span
                    key={calendarKey(entry)}
                    className={twMerge('flex min-w-0 items-center gap-1.5 border-l-2 pl-1.5 text-xs leading-4', outside ? 'text-ink-muted' : 'text-ink-dim')}
                    style={{ borderColor: colorOf(entry) }}
                  >
                    {entry.status === 'live' ? <span aria-hidden className="size-1.5 shrink-0 rounded-round bg-crimson motion-safe:animate-blink" /> : null}
                    <span className="shrink-0 font-mono tabular-nums">
                      <LocalTime iso={entry.startsAt} options={TIME_ONLY} />
                    </span>
                    <span className="truncate">{entry.format ?? t('fallbackFormat')}</span>
                  </span>
                ))}
                {list.length > PER_DAY ? <span className="pl-2 text-ink-muted signal-sm">{t('more', { count: list.length - PER_DAY })}</span> : null}
              </span>
            </button>
          )
        })}
      </div>

      {selected ? (
        <section aria-live="polite" className="flex flex-col gap-3">
          <h2 className="text-ink-muted signal">{longDay(selected)}</h2>
          {dayEntries.length ? (
            <ol className="flex flex-col gap-px border border-line bg-line">
              {dayEntries.map((entry) => <CalendarRow key={calendarKey(entry)} entry={entry} />)}
            </ol>
          ) : (
            <p className="text-sm text-ink-muted">{t('dayEmpty')}</p>
          )}
        </section>
      ) : null}
    </div>
  )
}
