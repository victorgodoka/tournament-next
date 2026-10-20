import { describe, expect, it } from 'vitest'
import { HOLD_END_MS, HOLD_START_MS, renderTimeline, stepMs } from './timing'

const move = { t: 'move', card: 0, to: 'm0' } as const
const end = { t: 'endTurn' } as const
const actions = [{ t: 'shuffle', order: [0] }, { t: 'draw', n: 1 }, move, end] as never[]

describe('renderTimeline', () => {
  it('holds, plays each step from start for stepMs/speed, then holds', () => {
    const tl = renderTimeline(actions, 2, 1)
    expect(tl.durationMs).toBe(HOLD_START_MS + 1200 + 700 + HOLD_END_MS)
    expect(tl.at(0)).toEqual({ cursor: 2, offset: 0 })
    expect(tl.at(999)).toEqual({ cursor: 2, offset: 0 })
    expect(tl.at(1000)).toEqual({ cursor: 3, offset: 0 })
    expect(tl.at(1500)).toEqual({ cursor: 3, offset: 500 })
    expect(tl.at(2200)).toEqual({ cursor: 4, offset: 0 })
    expect(tl.at(2900)).toEqual({ cursor: 4, offset: 700 })
    expect(tl.at(tl.durationMs + 50)).toEqual({ cursor: 4, offset: 2750 })
  })
  it('divides step time by the speed', () => {
    expect(renderTimeline(actions, 2, 2).durationMs).toBe(HOLD_START_MS + 600 + 350 + HOLD_END_MS)
  })
  it('lands past every step a long jump crosses', () => {
    // 3x: the move lasts 400 ms and the end turn 233.3 ms; 1640 is past both, in the end hold
    expect(renderTimeline(actions, 2, 3).at(1640)).toEqual({ cursor: 4, offset: 240 })
  })
  it('is only holds when nothing plays after start', () => {
    expect(renderTimeline(actions, 4, 1).durationMs).toBe(HOLD_START_MS + HOLD_END_MS)
  })
  it('keeps the replay timing', () => {
    expect([stepMs(move), stepMs(end), stepMs(undefined)]).toEqual([1200, 700, 700])
  })
})
