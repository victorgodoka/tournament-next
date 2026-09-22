/** Formatting shared by the tournament list and the tournament page. The API sends raw values. */

// ponytail: fixed locale so server and client render the same digits; per-reader digits need a client-only formatter.
const NUMBER = new Intl.NumberFormat('en-US')
export const formatNumber = (value: number) => NUMBER.format(value)

const DECIMAL = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })
export const formatDecimal = (value: number) => DECIMAL.format(value)

/** Rates come as fractions rounded to 4 decimals: `0.5372` reads as `53.7%`. */
export const formatRate = (rate: number | null) => (rate === null ? '—' : `${(rate * 100).toFixed(1)}%`)

export const formatRecord = ({ wins, loses, draws }: { wins: number; loses: number; draws: number }) =>
  `${wins}–${loses}–${draws}`

/** `2 h 27 min`. Both ends are needed, so a live tournament says "in progress" instead. */
export const formatDuration = (startedAt: string, endedAt: string) => {
  const minutes = Math.max(0, Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 60_000))
  const hours = Math.floor(minutes / 60)
  return hours ? `${hours} h ${minutes % 60} min` : `${minutes} min`
}

export const DATE_TIME: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
}

export const TIME_ONLY: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }

/** For the page title, where the day is the tournament's identity and the clock is noise. */
export const DATE_ONLY: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }

/** Only Edison sets a card pool, and only ever an upper bound. */
export const cardPoolNote = (cardPool: { releasedFrom: string | null; releasedUntil: string | null }) => {
  const until = cardPool.releasedUntil
  return until ? `cards released until ${new Date(until).getUTCFullYear()}` : null
}
