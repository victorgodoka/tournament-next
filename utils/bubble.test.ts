import { describe, expect, it } from 'vitest'
import { DEFAULT_BUBBLE, bubbleVars, parseBubble } from './bubble'

describe('parseBubble', () => {
  it('keeps a valid style', () => {
    const data = { bg: '#ff5fa2', bg2: '#ffb3d1', text: '#fff', border: '#ffffffcc', shape: 'pill', sticker: { at: 'bottom-left', size: 48, dx: -4, dy: 6, animate: 'bob' } }
    expect(parseBubble(data)).toEqual(data)
  })

  it('never lets a non-hex value into a style', () => {
    const b = parseBubble({ bg: 'red;background:url(https://x)', text: 'url(x)', border: '#12', bg2: 42 })
    expect(b.bg).toBe(DEFAULT_BUBBLE.bg)
    expect(b.text).toBe(DEFAULT_BUBBLE.text)
    expect(b.border).toBeNull()
    expect(b.bg2).toBeNull()
  })

  it('clamps numbers and rejects unknown enums', () => {
    const b = parseBubble({ shape: 'star', sticker: { at: 'middle', size: 500, dx: -99, dy: 'x', animate: 'spin' } })
    expect(b.shape).toBe(DEFAULT_BUBBLE.shape)
    expect(b.sticker).toEqual({ ...DEFAULT_BUBBLE.sticker, size: 64, dx: -32 })
  })

  it('reads junk as the default', () => {
    expect(parseBubble(null)).toEqual(DEFAULT_BUBBLE)
    expect(parseBubble([1])).toEqual(DEFAULT_BUBBLE)
  })
})

describe('bubbleVars', () => {
  const b = parseBubble({ sticker: { at: 'top-right', size: 40, dx: 5, dy: -10 } })

  it('puts the sticker on the corner it names', () => {
    const v = bubbleVars(b) as Record<string, string>
    expect(v['--s-x']).toBe('calc(100% + 5px)')
    expect(v['--s-y']).toBe('-10px')
    expect(v['--s-room-top']).toBe('30px')
  })

  it('mirrors it on your own messages', () => {
    const v = bubbleVars(b, true) as Record<string, string>
    expect(v['--s-x']).toBe('-5px')
  })
})
