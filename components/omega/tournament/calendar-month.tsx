'use client'

import { useState, useSyncExternalStore } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { Switch } from '@ui/choice'
import { Select } from '@ui/field'
import { Modal } from '@ui/modal/modal.component'
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

/** Parts of the reader's day, as `[from, to)` hours. */
const SLOTS = { morning: [6, 12], afternoon: [12, 18], evening: [18, 24], night: [0, 6] } as const
type Slot = keyof typeof SLOTS

/**
 * A month as a Sunday-first grid. Each tournament sits on its day in the reader's time zone (UTC
 * until hydration); a day opens its tournaments in a drawer on the right. `month` is `YYYY-MM`.
 */
export const CalendarMonth = ({ month, entries }: { month: string; entries: CalendarEntry[] }) => {
  const t = useTranslations('Calendar')
  const locale = useLocale()
  const local = useSyncExternalStore(subscribe, () => true, () => false)
  const today = useSyncExternalStore(subscribe, todayKey, () => null)
  const [picked, setPicked] = useState<string | null>(null)
  const [format, setFormat] = useState('')
  const [slot, setSlot] = useState<Slot | ''>('')
  const [rotating, setRotating] = useState(true)

  const formats = [...new Set(entries.flatMap((entry) => (entry.format ? [entry.format] : [])))].sort()
  // The hour is the reader's: filters only change after hydration, so the server's UTC never applies.
  const shown = entries.filter((entry) => {
    if (format && entry.format !== format) return false
    if (!rotating && entry.source === 'scheduler') return false
    if (!slot) return true
    const hour = new Date(entry.startsAt).getHours()
    return hour >= SLOTS[slot][0] && hour < SLOTS[slot][1]
  })

  const byDay = new Map<string, CalendarEntry[]>()
  for (const entry of shown) {
    const key = dayOf(new Date(entry.startsAt), local)
    byDay.set(key, [...(byDay.get(key) ?? []), entry])
  }

  const first = Date.parse(`${month}-01T00:00:00Z`)
  const lead = new Date(first).getUTCDay()
  const days = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate()
  const cells = Array.from({ length: Math.ceil((lead + days) / 7) * 7 }, (_, i) => new Date(first + (i - lead) * DAY_MS).toISOString().slice(0, 10))
  const inMonth = (key: string) => key.startsWith(month)

  const dayEntries = picked ? (byDay.get(picked) ?? []) : []
  // 4 Jan 2026 was a Sunday: the week's short names in the page's language.
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Date(Date.UTC(2026, 0, 4 + i)).toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' }),
  )
  const longDay = (key: string) =>
    new Date(`${key}T00:00:00Z`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })

  return (
    <div className="flex flex-col gap-6">
      <div role="group" aria-label={t('filters.label')} className="flex flex-wrap items-center gap-4">
        <Select
          prefix={t('filters.format')}
          options={[{ value: '', label: t('filters.allFormats') }, ...formats]}
          value={format}
          onChange={(event) => setFormat(event.target.value)}
        />
        <Select
          prefix={t('filters.time')}
          options={[
            { value: '', label: t('filters.anyTime') },
            ...(Object.keys(SLOTS) as Slot[]).map((value) => ({ value, label: t(`filters.slot.${value}`) })),
          ]}
          value={slot}
          onChange={(event) => setSlot(event.target.value as Slot | '')}
        />
        <Switch quiet checked={rotating} onChange={setRotating} label={t('filters.rotating')} />
      </div>
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
              aria-selected={key === picked}
              aria-haspopup="dialog"
              aria-label={t('dayLabel', { day: longDay(key), count: list.length })}
              onClick={() => setPicked(key)}
              className={twMerge(
                'flex min-h-16 min-w-0 cursor-pointer flex-col gap-1.5 bg-surface-100 p-1.5 text-left transition-colors hover:bg-surface-200 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-cyan min-[720px]:min-h-28 min-[720px]:p-2',
                outside && 'bg-space-000 text-ink-muted',
                key === picked && 'bg-ground-cyan shadow-selected hover:bg-ground-cyan',
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

      <Modal isOpen={!!picked} onClose={() => setPicked(null)} aria-label={picked ? longDay(picked) : undefined} className="items-stretch justify-end p-0">
        <section className="flex h-full w-full max-w-[520px] flex-col gap-4 overflow-y-auto border-l border-line-strong bg-space-000 px-5 pt-14 pb-8">
          <h2 className="text-ink-muted signal">{picked ? longDay(picked) : null}</h2>
          {dayEntries.length ? (
            <ol className="flex flex-col gap-px border border-line bg-line">
              {dayEntries.map((entry) => <CalendarRow key={calendarKey(entry)} entry={entry} />)}
            </ol>
          ) : (
            <p className="text-sm text-ink-muted">{t('dayEmpty')}</p>
          )}
        </section>
      </Modal>
    </div>
  )
}
