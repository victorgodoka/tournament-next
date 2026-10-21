/** Formatting shared by the tournament list and the tournament page. The API sends raw values. */

/* `locale` is the app locale (`useLocale()`), which server and client share through the cookie,
   so both render the same digits. Callers that don't pass it get English. */
export const formatNumber = (value: number, locale = 'en') => new Intl.NumberFormat(locale).format(value)

export const formatDecimal = (value: number, locale = 'en') =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)

/** Rates come as fractions rounded to 4 decimals: `0.5372` reads as `53.7%` (`53,7%` in pt). */
export const formatRate = (rate: number | null, locale = 'en') =>
  rate === null ? '—' : new Intl.NumberFormat(locale, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(rate)

export const formatRecord = ({ wins, loses, draws }: { wins: number; loses: number; draws: number }) =>
  `${wins}–${loses}–${draws}`

/** Win rate of a record: a draw is not a win. `null` with nothing played. */
export const recordRate = ({ wins, loses, draws }: { wins: number; loses: number; draws: number }) =>
  wins + loses + draws ? wins / (wins + loses + draws) : null

/** Whole minutes between two ISO dates, never negative. */
export const minutesBetween = (from: string, to: string) =>
  Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 60_000))

/** `2h 27m`, or `48m` under an hour. */
export const formatDuration = (startedAt: string, endedAt: string) => {
  const minutes = minutesBetween(startedAt, endedAt)
  const hours = Math.floor(minutes / 60)
  return hours ? `${hours}h ${String(minutes % 60).padStart(2, '0')}m` : `${minutes}m`
}

/** Chip tone per format. Edison and Rush Duel have no ladder color, so they borrow the DS's spare tones. */
export const formatTone = (format: string) =>
  ({ TCG: 'tcg', Genesys: 'genesys', Edison: 'ocg', 'Rush Duel': 'cyan' } as const)[format] ?? 'neutral'

/** The game's banlist name, except an `OCG` banlist is the Genesys queue and must never read as OCG. */
export const banlistLabel = ({ banlist, format }: { banlist: string; format: string }) =>
  format === 'Genesys' ? banlist.replace(/^OCG\s*/, 'Genesys · ') : banlist

/** `Thu 18 Sep`: the day half of a "day · time" pair. */
export const DAY: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }
export const DAY_YEAR: Intl.DateTimeFormatOptions = { ...DAY, year: 'numeric' }

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

/** Only Edison sets a card pool, and only ever an upper bound: the cutoff year, for the caller to word. */
export const cardPoolYear = (cardPool: { releasedFrom: string | null; releasedUntil: string | null }) =>
  cardPool.releasedUntil ? new Date(cardPool.releasedUntil).getUTCFullYear() : null
