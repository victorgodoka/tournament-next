import { describe, expect, it } from 'vitest'
import type { PlayerSlice, TimelineRow } from '@utils/statistics'
import { deckRecords, eloChart, gap, headlineOf, readOf, runningChart, ticksFor, weekDates } from './view'

const slice = (over: Partial<PlayerSlice> = {}): PlayerSlice => ({
  n: 100, wins: 55, xWins: 50, xWr: 0.5, pve: 0.05, winsAbove: 5, pveShrunk: 0.03, pveLo: -0.04, pveHi: 0.14, deff: 1, verdict: 'unclear', ...over,
})

describe('readOf', () => {
  it('reads the verdict: above is good, below is bad, anything else flat', () => {
    expect(readOf(slice({ verdict: 'above' }))).toBe('good')
    expect(readOf(slice({ verdict: 'below' }))).toBe('bad')
    expect(readOf(slice({ verdict: 'unclear' }))).toBe('flat')
    expect(readOf(slice({ verdict: null }))).toBe('flat')
  })
})

describe('gap', () => {
  it('turns a slice into points: you, expected, the gap and its interval', () => {
    expect(gap(slice())).toEqual({ you: 0.55, exp: 0.5, gap: 5, lo: -4, hi: 14 })
  })
  it('is null without benchmarked games', () => {
    expect(gap(slice({ n: 0, xWr: null, pve: null, pveLo: null, pveHi: null }))).toBeNull()
  })
})

describe('headlineOf', () => {
  it('names the verdict of the whole season', () => {
    expect(headlineOf('above')).toBe('above')
    expect(headlineOf('below')).toBe('below')
    expect(headlineOf('unclear')).toBe('unclear')
    expect(headlineOf(null)).toBe('few')
  })
})

describe('deckRecords', () => {
  it('sums games and matches per deck from the timeline, mirrors included', () => {
    const rows: TimelineRow[] = [
      ['2026-10-10T00:00:00.000Z', 'W', 'a', 'a', 2, 1, 0],
      ['2026-10-09T00:00:00.000Z', 'L', 'a', 'b', 0, 2, 0],
      ['2026-10-08T00:00:00.000Z', 'D', 'b', 'c', 1, 1, 1],
      ['2026-10-07T00:00:00.000Z', null, null, 'c', 0, 0, 0],
    ]
    expect(deckRecords(rows)).toEqual({
      a: { wins: 2, losses: 3, draws: 0, matches: 2 },
      b: { wins: 1, losses: 1, draws: 1, matches: 1 },
    })
  })
})

describe('weekDates', () => {
  it('names a whole week, with the month once when it does not change', () => {
    expect(weekDates('2026-10-19', '2026-11-03', 'en')).toBe('Mon 19 – Sun 25 Oct')
  })
  it('names both months across a month change', () => {
    expect(weekDates('2026-10-26', '2026-11-03', 'en')).toBe('Mon 26 Oct – Sun 01 Nov')
  })
  it('says since when the week is still going', () => {
    expect(weekDates('2026-11-02', '2026-11-03', 'en')).toBe('Since Mon 02 Nov')
  })
})

describe('ticksFor', () => {
  it('picks round steps that cover the range with zero on it', () => {
    expect(ticksFor(-3.2, 7)).toEqual({ lo: -6, hi: 10, ticks: [-4, 0, 4, 8] })
    expect(ticksFor(0, 0)).toEqual({ lo: -1, hi: 1, ticks: [0] })
  })
})

describe('runningChart', () => {
  it('draws the running total over game order, with week boundaries and labels', () => {
    const running = [0.5, -0.5, 0.5, 1.5]
    const out = runningChart(running, [{ week: 1, n: 2 }, { week: 2, n: 2 }])
    expect(out.line.split(' ')).toHaveLength(5)
    expect(out.line.startsWith('0.00,')).toBe(true)
    expect(out.area.startsWith('0,')).toBe(true)
    expect(out.weekLines).toEqual(['50.00%'])
    expect(out.weekLabels).toEqual([{ label: 'W1', left: '25.00%' }, { label: 'W2', left: '75.00%' }])
    expect(out.end).toBe(1.5)
    expect(out.grid.map((g) => g.value)).toEqual([-1, 0, 1, 2])
  })
  it('caps the points it draws for a long season', () => {
    const out = runningChart(Array.from({ length: 2000 }, (_, i) => i / 100), [{ week: 1, n: 2000 }])
    expect(out.line.split(' ').length).toBeLessThanOrEqual(302)
  })
  it('is empty without games', () => {
    expect(runningChart([], []).line).toBe('')
  })
})

describe('eloChart', () => {
  it('draws the rating with round ticks around it', () => {
    const out = eloChart([1776, 1781, 1769, 1842])
    expect(out.grid.map((g) => g.value)).toEqual([1760, 1800, 1840])
    expect(out.line.split(' ')).toHaveLength(4)
    expect(out.delta).toBe(66)
  })
  it('is empty with fewer than two days', () => {
    expect(eloChart([1500]).line).toBe('')
  })
})
