/**
 * Display helpers for staff screens, which read and write in Brasília time. Brazil has had no
 * daylight saving since 2019, so BRT is a fixed UTC−3 and a wall clock converts without a tz library.
 */
export const BRT = 'America/Sao_Paulo'

const DAY = new Intl.DateTimeFormat('en-GB', { timeZone: BRT, weekday: 'short', day: 'numeric', month: 'short' })
const TIME = new Intl.DateTimeFormat('en-GB', { timeZone: BRT, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const TIME_S = new Intl.DateTimeFormat('en-GB', { timeZone: BRT, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
const ISO_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: BRT, year: 'numeric', month: '2-digit', day: '2-digit' })

/** "Wed 1 Oct" */
export const dayLabel = (iso: string | Date) => DAY.format(new Date(iso)).replace(',', '')

/** "20:00" */
export const timeLabel = (iso: string | Date, seconds = false) => (seconds ? TIME_S : TIME).format(new Date(iso))

/** "Wed 1 Oct · 20:00" */
export const dayTime = (iso: string | Date) => `${dayLabel(iso)} · ${timeLabel(iso)}`

/** `YYYY-MM-DD` of the BRT calendar day. */
export const isoDay = (iso: string | Date) => ISO_DAY.format(new Date(iso))

/** A stored instant as the BRT wall clock the form edits. */
export const toBrt = (iso: string) => ({ date: isoDay(iso), time: timeLabel(iso) })

/** A BRT wall clock as the ISO instant the API stores. `null` when either part is missing or invalid. */
export const fromBrt = (date: string, time: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null
  const at = new Date(`${date}T${time}:00-03:00`)
  return Number.isNaN(at.getTime()) ? null : at.toISOString()
}

/** Integer cents as reais: "R$ 25.00". */
export const reais = (cents: number) => `R$ ${(cents / 100).toFixed(2)}`

/** "8,000" */
export const count = (n: number) => n.toLocaleString('en-US')

/** Whole days from now until `iso`, rounded up; negative in the past. */
export const daysUntil = (iso: string, now: number) => Math.ceil((Date.parse(iso) - now) / 86_400_000)
