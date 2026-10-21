import type { Action } from './types'

/** The video's frame: 16:9 or 9:16. */
export type Shape = 'landscape' | 'portrait'

/** How long a step stays on screen at 1x: a move or a draw has a card to follow, the rest only changes in place. */
export const stepMs = (a: Action | undefined) => (a?.t === 'move' || a?.t === 'draw' ? 1200 : 700)

/** The video holds on the opening board before the first step and on the final one after the last. */
export const HOLD_START_MS = 1000
export const HOLD_END_MS = 2000

/**
 * The replay of `actions` from `start` as a video: a hold, one step per action after `start` for `stepMs / speed`, a hold.
 * `at(ms)` is the cursor to show at that time and the ms since it appeared; past the end it keeps the last step on screen.
 */
export const renderTimeline = (actions: Action[], start: number, speed: number) => {
  // `begins[k]` is when step k + 1 comes on screen, the one that brings cursor `start + k + 1`.
  const begins: number[] = []
  let t = HOLD_START_MS
  for (let i = start; i < actions.length; i++) {
    begins.push(t)
    t += stepMs(actions[i]) / speed
  }
  return {
    durationMs: t + HOLD_END_MS,
    at(ms: number): { cursor: number; offset: number } {
      const k = begins.findLastIndex((b) => b <= ms)
      return k < 0 ? { cursor: start, offset: 0 } : { cursor: start + k + 1, offset: ms - begins[k]! }
    },
  }
}
