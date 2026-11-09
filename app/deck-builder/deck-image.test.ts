// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { shownScans } from './deck-image'

const img = (src: string, naturalWidth: number, complete = true) => ({ currentSrc: src, naturalWidth, complete }) as HTMLImageElement
const next = (id: number, w: number) => `${location.origin}/_next/image?url=https%3A%2F%2Fygopro.online%2Fassets%2Fcard-images%2Fcommon%2F${id}.jpg&w=${w}&q=75`

describe('shownScans', () => {
  it('keeps the largest decoded same-origin scan per card, at least 128 wide', () => {
    const big = img(next(89631139, 256), 256)
    const scans = shownScans([
      img(next(89631139, 128), 128),
      big,
      img(next(89631139, 64), 64), // the tray thumbnail
      img(next(46986414, 256), 0, false), // still loading
      img(`https://ygopro.online/assets/card-images/common/23995346.jpg`, 256), // cross-origin: would taint the canvas
      img(`${location.origin}/_next/image?url=https%3A%2F%2Fygopro.online%2Fassets%2Fcard-arts%2F7902349.jpg&w=256&q=75`, 256), // an art, not a scan
    ])
    expect([...scans.keys()]).toEqual([89631139])
    expect(scans.get(89631139)).toBe(big)
  })
})
