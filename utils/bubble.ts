import type { CSSProperties } from 'react'
import type { Cosmetic } from './types'

/**
 * `MSGBUBBLE` items keep their look in the item's `data` (docs/MSGBUBBLE.md). The panel writes it,
 * anyone can read it, and the API only checks that it's a JSON object — so every field is
 * validated here and anything off falls back, instead of trusting it into a style.
 */

const BUBBLE_SHAPES = ['square', 'round', 'pill'] as const
const BUBBLE_CORNERS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const
const BUBBLE_ANIMATIONS = ['none', 'bob', 'wiggle'] as const

export type BubbleStyle = {
  /** Fill, or the gradient's start when `bg2` is set. */
  bg: string
  bg2: string | null
  text: string
  border: string | null
  shape: (typeof BUBBLE_SHAPES)[number]
  /** Where the item's image (the sticker) sits. Ignored when the item has no image. */
  sticker: {
    at: (typeof BUBBLE_CORNERS)[number]
    /** px, 16–64. */
    size: number
    /** px nudges from the corner, −32–32. */
    dx: number
    dy: number
    animate: (typeof BUBBLE_ANIMATIONS)[number]
  }
}

export const DEFAULT_BUBBLE: BubbleStyle = {
  bg: '#1e2a4a',
  bg2: null,
  text: '#ffffff',
  border: null,
  shape: 'round',
  sticker: { at: 'top-right', size: 40, dx: 0, dy: 0, animate: 'none' },
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i

const color = (v: unknown, fallback: string | null) => (typeof v === 'string' && HEX.test(v) ? v : fallback)
const oneOf = <T extends string>(list: readonly T[], v: unknown, fallback: T) => (list.includes(v as T) ? (v as T) : fallback)
const clamp = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.round(Math.min(max, Math.max(min, v))) : fallback

/** Always a complete, safe style. Unknown keys are dropped; bad values take the default. */
export const parseBubble = (data: unknown): BubbleStyle => {
  const d = data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : {}
  const s = d.sticker && typeof d.sticker === 'object' ? (d.sticker as Record<string, unknown>) : {}
  const def = DEFAULT_BUBBLE.sticker
  return {
    bg: color(d.bg, DEFAULT_BUBBLE.bg)!,
    bg2: color(d.bg2, null),
    text: color(d.text, DEFAULT_BUBBLE.text)!,
    border: color(d.border, null),
    shape: oneOf(BUBBLE_SHAPES, d.shape, DEFAULT_BUBBLE.shape),
    sticker: {
      at: oneOf(BUBBLE_CORNERS, s.at, def.at),
      size: clamp(s.size, 16, 64, def.size),
      dx: clamp(s.dx, -32, 32, def.dx),
      dy: clamp(s.dy, -32, 32, def.dy),
      animate: oneOf(BUBBLE_ANIMATIONS, s.animate, def.animate),
    },
  }
}

/** `null` when the duelist has no bubble equipped: the messenger's own style applies. */
export const bubbleOf = (cosmetic: Cosmetic | null | undefined) =>
  cosmetic ? { style: parseBubble(cosmetic.data), sticker: cosmetic.assetUrl } : null

/** CSS variables for `.bubble` (components/omega/bubble). `mine` mirrors left and right, like the bubble itself. */
export const bubbleVars = (b: BubbleStyle, mine = false) => {
  const right = b.sticker.at.endsWith('right') !== mine
  const top = b.sticker.at.startsWith('top')
  const dx = mine ? -b.sticker.dx : b.sticker.dx
  return {
    '--b-bg': b.bg2 ? `linear-gradient(135deg, ${b.bg}, ${b.bg2})` : b.bg,
    '--b-text': b.text,
    '--b-border': b.border ?? 'transparent',
    '--b-radius': b.shape === 'pill' ? '999px' : b.shape === 'round' ? '16px' : '2px',
    '--s-size': `${b.sticker.size}px`,
    '--s-x': right ? `calc(100% + ${dx}px)` : `${dx}px`,
    '--s-y': top ? `${b.sticker.dy}px` : `calc(100% + ${b.sticker.dy}px)`,
    // Room for the half of the sticker that sticks out, so it doesn't sit on the next message.
    '--s-room-top': top ? `${Math.max(0, b.sticker.size / 2 - b.sticker.dy)}px` : '0px',
    '--s-room-bottom': top ? '0px' : `${Math.max(0, b.sticker.size / 2 + b.sticker.dy)}px`,
  } as CSSProperties
}
