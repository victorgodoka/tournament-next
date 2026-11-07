import { afterEach, describe, expect, it, vi } from 'vitest'
import { aggregateEmpty, bestAgainst, cardHref, coreFlex, deckHref, effectPoints, families, familyWeeks, getDeck, getMeta, getSeasons, getTopDecks, leadOf, localHours, matchupCall, meVerdict, plainDecks, scopeFrom, scopeQuery, seasonOf, shareMoves, statisticsHref, weekBand, weekJumps, windowDays, type CardStat, type DeckStat, type Matchup, type Meta, type PlayerDeck, type Season, type Week, type Window } from '@utils/statistics'

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
    expect(bestAgainst(decks, matchups, 2)).toMatchObject({ key: 'a', wr: 0.51, opponents: [{ key: 'b', wr: 0.51 }] })
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

describe('families', () => {
  it('reads the lead of a key', () => {
    expect([leadOf(''), leadOf('A'), leadOf('A>B'), leadOf('A*')]).toEqual(['', 'A', 'A', 'A'])
  })

  it('groups the plain keys under the lead row they belong to, most played first', () => {
    const found = families([deck('1*', 0.3), deck('1', 0.2), deck('1>2', 0.1), deck('3*', 0.05), deck('', 0.4)])
    expect(found.map((f) => f.family.key)).toEqual(['1*', '3*'])
    expect(found[0]!.members.map((d) => d.key)).toEqual(['1', '1>2'])
    expect(found[1]!.members).toEqual([])
  })

  it('sums the member weeks, and a week without some member still counts', () => {
    const w = (key: string, n: number, share: number, games: number) => ({ key, week: n, firstDay: `d${n}`, games, share }) as Week
    const found = families([deck('1*', 0.3), deck('1', 0.2), deck('1>2', 0.1)])
    const summed = familyWeeks([w('1', 1, 0.2, 20), w('1>2', 1, 0.1, 10), w('1', 2, 0.25, 30)], found)
    expect(summed).toEqual([
      { key: '1*', week: 1, firstDay: 'd1', games: 30, share: expect.closeTo(0.3) },
      { key: '1*', week: 2, firstDay: 'd2', games: 30, share: 0.25 },
    ])
    const { fallers } = shareMoves(summed)
    expect(fallers[0]!.key).toBe('1*')
    expect(fallers[0]!.delta).toBeCloseTo(-0.05)
  })

  it('orders the sums by week when the first member lacks week 1, and passes a member-less family', () => {
    const w = (key: string, n: number, share: number) => ({ key, week: n, firstDay: `d${n}`, games: 10, share }) as Week
    const found = families([deck('1*', 0.3), deck('1', 0.2), deck('1>2', 0.1)])
    const summed = familyWeeks([w('1', 2, 0.2), w('1', 3, 0.2), w('1>2', 1, 0.1), w('1>2', 2, 0.1)], found)
    expect(summed.map((s) => s.week)).toEqual([1, 2, 3])
    const empty = familyWeeks([w('1', 1, 0.2)], [{ family: deck('9*', 0.1), members: [] }])
    expect(empty).toEqual([])
    expect(shareMoves(empty)).toEqual({ risers: [], fallers: [] })
  })
})

describe('scope', () => {
  it('sends the ladder, or the season over it, and the pickers off their defaults', () => {
    expect(scopeQuery({ ladder: 'tcg', window: 'last7', band: 'Gold' })).toBe('ladder=tcg&window=last7&band=Gold')
    expect(scopeQuery({ ladder: 'tcg', season: 'tcg-2', window: 'season', band: 'aggregate' })).toBe('season=tcg-2')
    expect(scopeQuery({ ladder: 'tcg', band: 'all' })).toBe('ladder=tcg&band=all')
  })

  it('reads the URL, dropping values the API would refuse', () => {
    expect(scopeFrom({ ladder: 'genesys', season: 'genesys-1', window: 'last7', band: 'Gold' })).toEqual({ ladder: 'genesys', season: 'genesys-1', window: 'last7', band: 'Gold' })
    expect(scopeFrom({ ladder: 'x', window: 'year', band: 'Wood' })).toEqual({ ladder: 'tcg', season: undefined, window: 'season', band: 'aggregate' })
    expect(scopeFrom({ band: ['Gold', 'Iron'] }).band).toBe('aggregate')
    expect(scopeFrom({}).band).toBe('aggregate')
    expect(scopeFrom({ band: 'Iron' }).band).toBe('aggregate')
    expect(scopeFrom({ band: 'all' }).band).toBe('all')
  })

  it('calls the aggregate band empty on a 404 or a row with no games', () => {
    expect(aggregateEmpty({ ok: false, status: 404 })).toBe(true)
    expect(aggregateEmpty({ ok: true, data: { fit: { games: 0 } } })).toBe(true)
    expect(aggregateEmpty({ ok: true, data: { fit: { games: 10 } } })).toBe(false)
    expect(aggregateEmpty({ ok: false, status: 500 })).toBe(false)
  })

  it('keeps the scope on the links, the key URL-encoded', () => {
    const scope = { ladder: 'tcg', window: 'last7', band: 'aggregate' } as const
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

describe('seasonOf', () => {
  const seasons = [
    { id: 15, code: 'genesys-2', ladder: 'genesys', sweptThrough: null },
    { id: 14, code: 'tcg-3', ladder: 'tcg', sweptThrough: '2026-10-31' },
    { id: 13, code: 'tcg-2', ladder: 'tcg', sweptThrough: '2026-10-18' },
  ] as Season[]

  it('finds the season the API read: by code or id, else the newest swept of the ladder', () => {
    expect(seasonOf(seasons, { ladder: 'tcg', season: 'tcg-2' })?.id).toBe(13)
    expect(seasonOf(seasons, { ladder: 'tcg', season: '13' })?.id).toBe(13)
    expect(seasonOf(seasons, { ladder: 'tcg' })?.id).toBe(14)
    expect(seasonOf(seasons, { ladder: 'genesys' })).toBeUndefined()
    expect(seasonOf([], { ladder: 'tcg' })).toBeUndefined()
  })
})

describe('getTopDecks', () => {
  const season = { id: 14, ladder: 'tcg' }
  const row = (key: string, name: string, share: number, face?: number | null) => ({ key, name, share, face })

  it('takes the most played plain decks and artwork with a single meta request', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ season, decks: [row('1', 'One', 0.1, 8), row('2', 'Two', 0.3, 7), row('2*', 'Two', 0.4, 7), row('', 'x', 0.5), row('3', 'Three', 0.05)] }))
    })
    vi.stubGlobal('fetch', fetchMock)
    expect(await getTopDecks('tcg', 2)).toEqual([
      { key: '2', name: 'Two', share: 0.3, topCards: [{ id: 7, name: null }] },
      { key: '1', name: 'One', share: 0.1, topCards: [{ id: 8, name: null }] },
    ])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(urlOf(fetchMock).pathname).toBe('/statistics/meta')
    expect(urlOf(fetchMock).search).toBe('?ladder=tcg&band=all')
  })

  it('is null without a meta, and leaves artwork empty on older servers without faces', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })))
    expect(await getTopDecks('tcg')).toBeNull()
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (url.includes('/meta') ? new Response(JSON.stringify({ season, decks: [row('1', 'One', 0.1)] })) : new Response('{}', { status: 429 }))))
    expect(await getTopDecks('tcg')).toEqual([{ key: '1', name: 'One', share: 0.1, topCards: [] }])
  })

  it('leaves artwork empty for a null face and respects the requested ladder', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ season, decks: [row('1', 'One', 0.1, null)] })))
    vi.stubGlobal('fetch', fetchMock)
    expect(await getTopDecks('genesys')).toEqual([{ key: '1', name: 'One', share: 0.1, topCards: [] }])
    expect(urlOf(fetchMock).searchParams.get('ladder')).toBe('genesys')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
