import { afterEach, describe, expect, it, vi } from 'vitest'
import { bestAgainst, cardHref, coreFlex, deckHref, effectPoints, getDeck, getMeta, getSeasons, localHours, matchupCall, meVerdict, plainDecks, scopeFrom, scopeQuery, shareMoves, statisticsHref, weekBand, weekJumps, windowDays, type CardStat, type DeckStat, type Matchup, type Meta, type PlayerDeck, type Week, type Window } from '@utils/statistics'

describe('localHours', () => {
  it('moves UTC counts to the viewer clock, wrapping the day', () => {
    const utc = Array.from({ length: 24 }, (_, hour) => hour)
    // UTC−3: 00:00 local is 03:00 UTC, and 21:00 local is 00:00 UTC.
    expect(localHours(utc, 3)[0]).toBe(3)
    expect(localHours(utc, 3)[21]).toBe(0)
    // UTC+9: 00:00 local is 15:00 UTC the day before.
    expect(localHours(utc, -9)[0]).toBe(15)
  })
})

afterEach(() => vi.unstubAllGlobals())

/* API_URL is empty in tests, so the request URL is relative: give it a base to parse. */
const urlOf = (fetchMock: ReturnType<typeof vi.fn>) => new URL(String(fetchMock.mock.calls[0]![0]), 'http://api.test')

describe('matchupCall', () => {
  it('calls a matchup only when the interval excludes the expected rate', () => {
    expect(matchupCall({ wrLo: 0.52, wrHi: 0.58, wrExpected: 0.5 })).toBe('favorable')
    expect(matchupCall({ wrLo: 0.52, wrHi: 0.58, wrExpected: 0.53 })).toBe('neutral')
    expect(matchupCall({ wrLo: 0.42, wrHi: 0.49, wrExpected: 0.5 })).toBe('unfavorable')
  })
})

const deck = (key: string, share: number) => ({ key, share }) as DeckStat
const cell = (key: string, opponent: string, wrAdjusted: number) => ({ key, opponent, wrAdjusted }) as Matchup

describe('bestAgainst', () => {
  const decks = [deck('a', 0.3), deck('b', 0.2), deck('c', 0.1)]

  it('takes the highest share-weighted rate against the most played', () => {
    const matchups = [cell('a', 'b', 0.5), cell('a', 'c', 0.5), cell('b', 'a', 0.6), cell('b', 'c', 0.4), cell('c', 'a', 0.5), cell('c', 'b', 0.54)]
    // a 0.5; b (0.3·0.6 + 0.1·0.4) / 0.4 = 0.55; c (0.3·0.5 + 0.2·0.54) / 0.5 = 0.516
    const best = bestAgainst(decks, matchups)
    expect(best?.key).toBe('b')
    expect(best?.wr).toBeCloseTo(0.55)
  })

  it('reads only the `top` most played, and skips a deck missing one of them', () => {
    const matchups = [cell('a', 'b', 0.51), cell('b', 'a', 0.49), cell('c', 'a', 0.7)]
    expect(bestAgainst(decks, matchups, 2)).toEqual({ key: 'a', wr: 0.51 })
  })

  it('is null with no matchups', () => {
    expect(bestAgainst(decks, [])).toBeNull()
  })
})

describe('plainDecks', () => {
  it('leaves out the lead rows and the unknown key, which double-count the shares', () => {
    expect(plainDecks([deck('482', 0.1), deck('482>65537', 0.1), deck('482*', 0.2), deck('', 0.05)]).map((d) => d.key)).toEqual(['482', '482>65537'])
  })
})

describe('scope', () => {
  it('sends the ladder, or the season over it, and the pickers off their defaults', () => {
    expect(scopeQuery({ ladder: 'tcg', window: 'last7', band: 'Gold' })).toBe('ladder=tcg&window=last7&band=Gold')
    expect(scopeQuery({ ladder: 'tcg', season: 'tcg-2', window: 'season', band: 'all' })).toBe('season=tcg-2')
  })

  it('reads the URL, dropping values the API would refuse', () => {
    expect(scopeFrom({ ladder: 'genesys', season: 'genesys-1', window: 'last7', band: 'Gold' })).toEqual({ ladder: 'genesys', season: 'genesys-1', window: 'last7', band: 'Gold' })
    expect(scopeFrom({ ladder: 'x', window: 'year', band: 'Wood' })).toEqual({ ladder: 'tcg', season: undefined, window: 'season', band: 'all' })
    expect(scopeFrom({ band: ['Gold', 'Iron'] }).band).toBe('all')
  })

  it('keeps the scope on the links, the key URL-encoded', () => {
    const scope = { ladder: 'tcg', window: 'last7', band: 'all' } as const
    expect(statisticsHref(scope)).toBe('/statistics?ladder=tcg&window=last7')
    expect(deckHref('482>65537', scope)).toBe('/statistics/archetypes/482%3E65537?ladder=tcg&window=last7')
    expect(deckHref('482*', scope)).toBe('/statistics/archetypes/482*?ladder=tcg&window=last7')
    expect(cardHref(14558127, { ladder: 'tcg', season: 'tcg-2' })).toBe('/statistics/cards/14558127?season=tcg-2')
  })
})

describe('client', () => {
  const scope = { ladder: 'tcg', window: 'season', band: 'all' } as const

  it('maps a 404 to a failed result', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })))
    expect(await getMeta(scope)).toEqual({ ok: false, status: 404 })
    expect(await getDeck('482', scope)).toEqual({ ok: false, status: 404 })
  })

  it('reports a network failure as status 0', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('down') }))
    expect(await getMeta(scope)).toEqual({ ok: false, status: 0 })
  })

  it('asks for the encoded deck key with the scope', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ deck: {} })))
    vi.stubGlobal('fetch', fetchMock)
    await getDeck('482>65537', { ...scope, band: 'Gold' })
    const url = urlOf(fetchMock)
    expect(url.pathname).toBe('/statistics/decks/482%3E65537')
    expect(url.searchParams.get('band')).toBe('Gold')
  })

  it('unwraps the season list, empty on a failure', async () => {
    const season = { id: 14, code: 'tcg-3' }
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ seasons: [season] }))))
    expect(await getSeasons()).toEqual([season])
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })))
    expect(await getSeasons()).toEqual([])
  })
})

describe('effectPoints', () => {
  it('turns a logit into points of win rate around 50%', () => {
    expect(effectPoints(0)).toBe(0)
    expect(effectPoints(0.118)).toBeCloseTo(2.95, 1)
    expect(effectPoints(-0.118)).toBeCloseTo(-2.95, 1)
  })
})

describe('weekBand', () => {
  it('draws the band around the week through the logit, so it stays inside 0–1', () => {
    const { lo, hi } = weekBand({ wrExpected: 0.52, se: 0.05 })
    expect(lo).toBeLessThan(0.52)
    expect(hi).toBeGreaterThan(0.52)
    expect(hi - 0.52).toBeCloseTo(0.0244, 3)
    expect(weekBand({ wrExpected: 0.99, se: 5 }).hi).toBeLessThan(1)
  })
})

describe('coreFlex', () => {
  it('splits a deck at 80% of the lists', () => {
    const cards = [{ inclusion: 0.95 }, { inclusion: 0.8 }, { inclusion: 0.79 }] as CardStat[]
    const { core, flex } = coreFlex(cards)
    expect(core.map((c) => c.inclusion)).toEqual([0.95, 0.8])
    expect(flex.map((c) => c.inclusion)).toEqual([0.79])
  })
})

describe('weeks', () => {
  const week = (key: string, n: number, share: number, jump: Week['jump'] = 0) => ({ key, week: n, share, jump }) as Week
  const weeks = [week('a', 1, 0.1), week('a', 2, 0.15, 1), week('b', 1, 0.2), week('b', 2, 0.12), week('c', 2, 0.05)]

  it('moves are the last week against the one before, for decks in both', () => {
    const { risers, fallers } = shareMoves(weeks)
    expect(risers.map((m) => m.key)).toEqual(['a'])
    expect(risers[0]!.delta).toBeCloseTo(0.05)
    expect(fallers.map((m) => m.key)).toEqual(['b'])
  })

  it('has no moves in the first week', () => {
    expect(shareMoves([week('a', 1, 0.1)])).toEqual({ risers: [], fallers: [] })
  })

  it('reads the jumps of the last week', () => {
    expect(weekJumps(weeks).map((w) => w.key)).toEqual(['a'])
  })
})

describe('windowDays', () => {
  const meta = (window: Window, sweptThrough: string | null, firstDay = '2026-10-19') =>
    ({ window, season: { startsAt: '2026-10-19T03:00:00.000Z', sweptThrough }, weeks: [{ firstDay }] }) as unknown as Meta

  it('counts the swept days, a day-2 window not pretending to a week', () => {
    expect(windowDays(meta('last7', '2026-10-20'))).toBe(2)
    expect(windowDays(meta('last7', '2026-10-31'))).toBe(7)
    expect(windowDays(meta('season', '2026-10-31'))).toBe(13)
    expect(windowDays(meta('season', null))).toBe(0)
  })
})

describe('meVerdict', () => {
  const row = (wrLo: number | null, wrHi: number | null, ladder: { wrLo: number; wrHi: number } | null) => ({ wrLo, wrHi, ladder }) as PlayerDeck

  it('tells the two apart only when the intervals do not touch', () => {
    expect(meVerdict(row(0.6, 0.7, { wrLo: 0.5, wrHi: 0.55 }))).toBe('above')
    expect(meVerdict(row(0.3, 0.45, { wrLo: 0.5, wrHi: 0.55 }))).toBe('below')
    expect(meVerdict(row(0.45, 0.6, { wrLo: 0.5, wrHi: 0.55 }))).toBe('same')
    expect(meVerdict(row(null, null, { wrLo: 0.5, wrHi: 0.55 }))).toBeNull()
    expect(meVerdict(row(0.45, 0.6, null))).toBeNull()
  })
})
