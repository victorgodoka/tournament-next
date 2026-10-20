import { describe, expect, it } from 'vitest'
import { fitCardWidth } from './fit'

const board = { width: 724, height: 640 }

describe('fitCardWidth', () => {
  it('scales the probe width by the tighter side of the room', () => {
    expect(fitCardWidth(100, board, { width: 1200, height: 560 })).toBe(87)
  })
  it('a room wider than tall picks the height ratio', () => {
    expect(fitCardWidth(100, board, { width: 1248, height: 576 })).toBe(90) // 576/640
  })
  it('a room taller than wide picks the width ratio', () => {
    expect(fitCardWidth(100, board, { width: 688, height: 1100 })).toBe(95) // 688/724
  })
})
