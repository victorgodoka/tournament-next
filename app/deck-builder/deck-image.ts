import { LABEL as TYPE_LABEL } from '@ui/type-counts'
import { frameOf, imageOf, type CardFrame } from '@utils/deck/model'
import type { CardMap, Deck, Zone } from '@utils/deck/types'

/**
 * The deck as an image to post, after the Omega Hub "Deck share" artboards: 16:9 (`wide`) for feeds
 * and Discord, 9:16 (`tall`) for stories. Drawn on a canvas, like the top-cut card, so it needs no library.
 */

export type ImageLayout = 'wide' | 'tall'

export type ImageInfo = {
  title: string
  /** The banlist's name on the chip, coloured by its format. */
  format: { name: string; format: string } | null
  /** "Built by …", already worded; null signed out. */
  author: string | null
  date: string
  eyebrow: string
  zones: Record<Zone, string>
  /** "Main 40 · Extra 15 · Side 15" (16:9 only). */
  totals: string
  cta: string
  /** Genesys cost per passcode, drawn on the tile's top-left; cards that cost nothing are left out. */
  points: Record<number, number>
}

const SITE = 'omega.duelistsunite.org'
const C = {
  bg: '#080a14',
  s100: '#0e1222',
  s200: '#151a2e',
  line: '#1f2744',
  lineMid: '#33406a',
  ink: '#eef1f8',
  dim: '#b3bdd2',
  muted: '#8e99b4',
  swatchEdge: '#8ea6c7',
  cyan: '#45cfdc',
  cyanOn: '#05121c',
  gold: '#efd17e',
}
const FORMAT_COLOR: Record<string, string> = { tcg: '#3fcf7a', ocg: '#7f9cf0', genesys: '#ea5fc0', md: '#00fdff', edison: '#efd17e', goat: '#c3cbd8' }
const FRAMES: CardFrame[] = ['normal', 'effect', 'ritual', 'fusion', 'synchro', 'xyz', 'link', 'spell', 'trap']
const ZONES: Zone[] = ['main', 'extra', 'side']

// The DS families, read from the page when drawing starts (next/font names them at build time).
let ANTON = 'Impact, sans-serif'
let FIG = 'system-ui, sans-serif'
let MONO = 'monospace'
let MICH = 'sans-serif'
const readFonts = () => {
  const css = getComputedStyle(document.body)
  const font = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
  ANTON = font('--font-display', ANTON)
  FIG = font('--font-sans', FIG)
  MONO = font('--font-mono', MONO)
  MICH = font('--font-brand', MICH)
}

/** Header row, card and ×N badge sizes of a section, at full scale. */
type Style = { head: number; font: number; spacing: number; total: number; swatch: number; gap: number; inner: number; cw: number; gapCards: number; badge: [min: number, h: number, pad: number, font: number, cut: number, off: number] }

const L = {
  wide: {
    w: 1920,
    h: 1080,
    big: { head: 28, font: 12, spacing: 1.68, total: 24, swatch: 10, gap: 12, inner: 6, cw: 120, gapCards: 12, badge: [38, 30, 8, 19, 6, 4] } as Style,
    small: { head: 28, font: 12, spacing: 1.68, total: 24, swatch: 10, gap: 12, inner: 6, cw: 80, gapCards: 8, badge: [30, 24, 6, 15, 5, 3] } as Style,
  },
  tall: {
    w: 1080,
    h: 1920,
    big: { head: 34, font: 18, spacing: 2.16, total: 34, swatch: 14, gap: 14, inner: 8, cw: 112, gapCards: 10, badge: [44, 36, 8, 24, 7, 4] } as Style,
    small: { head: 34, font: 18, spacing: 2.16, total: 34, swatch: 14, gap: 14, inner: 8, cw: 98, gapCards: 10, badge: [40, 32, 8, 21, 6, 4] } as Style,
  },
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })

/** Same-origin, edge-cached (see `app/card-image`): the scan host sends no CORS headers, which would taint the canvas. */
const scanUrl = (id: number) => `/card-image/common/${id}.jpg`

const SCAN_ID = /card-images%2Fcommon%2F(\d+)\.jpg/

/**
 * The scans the page has already decoded, by passcode: the largest same-origin `<img>` of each card that is at
 * least `min` wide (a 64px tile would blur on a 120px export tile). The tiles show every card in the deck, so on
 * a retina or phone screen (256px tiles) this covers the whole export without a request.
 */
export const shownScans = (images: Iterable<HTMLImageElement>, min = 128) => {
  const best = new Map<number, HTMLImageElement>()
  for (const img of images) {
    const id = SCAN_ID.exec(img.currentSrc)?.[1]
    if (!id || !img.complete || img.naturalWidth < min || !img.currentSrc.startsWith(location.origin)) continue
    if ((best.get(Number(id))?.naturalWidth ?? 0) < img.naturalWidth) best.set(Number(id), img)
  }
  return best
}

/** The DS chamfer: top-left and bottom-right corners cut by `c`. */
const chamfer = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: number) => {
  ctx.beginPath()
  ctx.moveTo(x + c, y)
  ctx.lineTo(x + w, y)
  ctx.lineTo(x + w, y + h - c)
  ctx.lineTo(x + w - c, y + h)
  ctx.lineTo(x, y + h)
  ctx.lineTo(x, y + c)
  ctx.closePath()
}

const fit = (ctx: CanvasRenderingContext2D, text: string, max: number) => {
  if (ctx.measureText(text).width <= max) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1)
  return `${t}…`
}

/** Draws `value` and returns its width, letter spacing included. */
const text = (ctx: CanvasRenderingContext2D, value: string, x: number, y: number, font: string, color: string, spacing = 0, align: CanvasTextAlign = 'left') => {
  ctx.font = font
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.letterSpacing = `${spacing}px`
  ctx.fillText(value, x, y)
  const w = ctx.measureText(value).width
  ctx.letterSpacing = '0px'
  return w
}

const measure = (ctx: CanvasRenderingContext2D, value: string, font: string, spacing = 0) => {
  ctx.font = font
  ctx.letterSpacing = `${spacing}px`
  const w = ctx.measureText(value).width
  ctx.letterSpacing = '0px'
  return w
}

/** A CSS `radial-gradient(rx ry at x y, rgba(rgb,a), transparent 70%)` over the whole canvas. */
const glow = (ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rgb: string, a: number) => {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(1, ry / rx)
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx)
  g.addColorStop(0, `rgba(${rgb},${a})`)
  g.addColorStop(0.7, `rgba(${rgb},0)`)
  ctx.fillStyle = g
  ctx.fillRect(-x, -y * (rx / ry), ctx.canvas.width, ctx.canvas.height * (rx / ry))
  ctx.restore()
}

/** The 24px dot field, faded by `ellipse at px py` (farthest-corner) from 20% to 70%, as the artboard's mask. */
const dotField = (ctx: CanvasRenderingContext2D, x0: number, w: number, h: number, px: number, py: number) => {
  const cx = w * px
  const cy = h * py
  const rx = Math.max(cx, w - cx) * Math.SQRT2
  const ry = Math.max(cy, h - cy) * Math.SQRT2
  for (let y = 12; y < h; y += 24) {
    for (let x = 12; x < w; x += 24) {
      const d = Math.hypot((x - cx) / rx, (y - cy) / ry)
      const a = 0.16 * Math.min(1, Math.max(0, (0.7 - d) / 0.5))
      if (a <= 0) continue
      ctx.fillStyle = `rgba(142,166,199,${a})`
      ctx.beginPath()
      ctx.arc(x0 + x, y, 1.1, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

type Group = { id: number; n: number }

/** Copies per passcode, in deck order: one tile per print, as the artboard draws them. */
const groupsOf = (ids: readonly number[]): Group[] => {
  const counts = new Map<number, number>()
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1)
  return [...counts].map(([id, n]) => ({ id, n }))
}

type Grid = { cw: number; ch: number; gap: number; cols: number; h: number }

/** `n` tiles in `width` at `scale` of the style's card: more columns as the cards shrink. */
const gridOf = (n: number, width: number, s: Style, scale: number): Grid => {
  const cw = Math.floor(s.cw * scale)
  const ch = Math.round((cw * 86) / 59)
  const gap = Math.max(4, Math.round(s.gapCards * scale))
  const cols = Math.max(1, Math.floor((width + gap) / (cw + gap)))
  const rows = Math.ceil(n / cols)
  return { cw, ch, gap, cols, h: n ? rows * ch + (rows - 1) * gap : 0 }
}

type Ctx = { ctx: CanvasRenderingContext2D; deck: Deck; cards: CardMap; scans: Map<number, HTMLImageElement | null>; points: ImageInfo['points'] }

/** A chamfered badge with centred Anton text, its corner `off` past the tile's. */
const badge = (ctx: CanvasRenderingContext2D, label: string, x: number, y: number, [min, h, pad, font, cut]: number[], fill: string, ink: string) => {
  const w = Math.max(min!, measure(ctx, label, `400 ${font}px ${ANTON}`) + 2 * pad!)
  ctx.fillStyle = fill
  chamfer(ctx, x, y, w, h!, cut!)
  ctx.fill()
  text(ctx, label, x + w / 2, y + h! / 2 + font! * 0.36, `400 ${font}px ${ANTON}`, ink, 0, 'center')
  return w
}

/** "01 MAIN DECK 40 ———— ■ Effect 12 ■ Spell 18", then the tiles; returns the section's height. */
const section = ({ ctx, deck, cards, scans, points }: Ctx, zone: Zone, num: string, label: string, x: number, y: number, width: number, s: Style, scale: number) => {
  const ids = deck[zone]
  const groups = groupsOf(ids)
  const mid = y + s.head / 2 + s.font * 0.36
  const mono = `700 ${s.font}px ${MONO}`
  let cx = x + text(ctx, num, x, mid, mono, C.gold, s.spacing) + s.gap
  cx += text(ctx, label.toUpperCase(), cx, mid, mono, C.ink, s.spacing) + s.gap
  cx += text(ctx, String(ids.length), cx, y + s.head / 2 + s.total * 0.36, `400 ${s.total}px ${ANTON}`, C.ink) + s.gap

  // Legend from the right: swatch, label, count per frame.
  const kinds = FRAMES.map((f) => [f, ids.filter((id) => { const c = cards.get(id); return !!c && frameOf(c) === f }).length] as const).filter(([, n]) => n)
  const css = getComputedStyle(document.documentElement)
  let rx = x + width
  for (const [frame, n] of [...kinds].reverse()) {
    rx -= text(ctx, String(n), rx, mid, mono, C.ink, s.spacing, 'right') + s.inner
    rx -= text(ctx, TYPE_LABEL[frame].toUpperCase(), rx, mid, `400 ${s.font}px ${MONO}`, C.muted, s.spacing, 'right') + s.inner
    rx -= s.swatch
    const sy = y + (s.head - s.swatch) / 2
    ctx.fillStyle = css.getPropertyValue(`--color-type-${frame}`).trim() || C.s200
    ctx.fillRect(rx, sy, s.swatch, s.swatch)
    ctx.strokeStyle = C.swatchEdge
    ctx.lineWidth = 1
    ctx.strokeRect(rx + 0.5, sy + 0.5, s.swatch - 1, s.swatch - 1)
    rx -= s.gap
  }
  ctx.fillStyle = C.line
  ctx.fillRect(cx, y + s.head / 2, Math.max(0, rx - cx), 1)

  const g = gridOf(groups.length, width, s, scale)
  const top = y + s.head + s.gap + 4
  const sizes = s.badge.map((v) => Math.round(v * Math.max(scale, 0.7)))
  const [bMin, bH, bPad, bFont, , bOff] = sizes
  groups.forEach(({ id, n }, i) => {
    const tx = x + (i % g.cols) * (g.cw + g.gap)
    const ty = top + Math.floor(i / g.cols) * (g.ch + g.gap)
    const scan = scans.get(id)
    if (scan) ctx.drawImage(scan, tx, ty, g.cw, g.ch)
    else {
      ctx.fillStyle = C.s200
      ctx.fillRect(tx, ty, g.cw, g.ch)
      ctx.font = `700 ${Math.max(10, Math.round(g.cw / 9))}px ${FIG}`
      text(ctx, fit(ctx, cards.get(id)?.name ?? String(id), g.cw - 12), tx + 6, ty + 20, ctx.font, C.dim)
    }
    if (points[id]) badge(ctx, String(points[id]), tx - bOff!, ty - bOff!, sizes, C.cyan, C.cyanOn)
    if (n < 2) return
    const label = `×${n}`
    const bw = Math.max(bMin!, measure(ctx, label, `400 ${bFont}px ${ANTON}`) + 2 * bPad!)
    badge(ctx, label, tx + g.cw + bOff! - bw, ty + g.ch + bOff! - bH!, sizes, C.bg, C.ink)
  })
  return s.head + s.gap + 4 + g.h
}

const sectionHeight = (n: number, width: number, s: Style, scale: number) => s.head + s.gap + 4 + gridOf(n, width, s, scale).h

/** The largest card scale (down to half) at which `blocks` fit `avail`. */
const scaleFor = (avail: number, blocks: (scale: number) => number) => {
  for (let scale = 1; scale > 0.5; scale -= 0.02) if (blocks(scale) <= avail) return scale
  return 0.5
}

/** Chips in a row, wrapping inside `maxX`; returns the bottom of the last row. */
const chips = (ctx: CanvasRenderingContext2D, items: { label: string; color?: string }[], x0: number, y0: number, maxX: number, size: number, spacing: number, padX: number, h: number, cut: number) => {
  let x = x0
  let y = y0
  for (const { label, color } of items) {
    const w = measure(ctx, label, `700 ${size}px ${MONO}`, spacing) + 2 * padX + (color ? 4 : 0)
    if (x + w > maxX && x > x0) {
      x = x0
      y += h + 12
    }
    if (color) {
      ctx.fillStyle = color
      chamfer(ctx, x, y, w, h, cut)
      ctx.fill()
      ctx.fillStyle = C.s100
      chamfer(ctx, x + 2, y + 2, w - 4, h - 4, cut - 1)
      ctx.fill()
    } else {
      ctx.fillStyle = C.s100
      chamfer(ctx, x, y, w, h, cut)
      ctx.fill()
    }
    text(ctx, label, x + padX + (color ? 2 : 0), y + h / 2 + size * 0.36, `${color ? 700 : 400} ${size}px ${MONO}`, color ?? C.dim, spacing)
    x += w + 12
  }
  return y + h
}

/** The three key cards fanned out: most copies in the middle. `box` is the artboard's 436×236 / 400×300 frame. */
const fan = (ctx: CanvasRenderingContext2D, scans: (HTMLImageElement | null)[], spots: [x: number, y: number, w: number, h: number, deg: number][]) => {
  const order = [1, 2, 0] // left, right, then the middle one on top
  for (const i of order) {
    const img = scans[i]
    const spot = spots[i]
    if (!img || !spot) continue
    const [x, y, w, h, deg] = spot
    ctx.save()
    ctx.translate(x + w / 2, y + h / 2)
    ctx.rotate((deg * Math.PI) / 180)
    ctx.shadowColor = 'rgba(0,0,0,0.5)'
    ctx.shadowBlur = 40
    ctx.shadowOffsetY = 16
    ctx.drawImage(img, -w / 2, -h / 2, w, h)
    ctx.restore()
  }
}

/** Title in Anton, shrunk to fit `maxW`; `twoLines` lets it wrap once before it shrinks further. */
const titleLines = (ctx: CanvasRenderingContext2D, title: string, maxW: number, max: number, min: number, twoLines: boolean) => {
  const t = title.toUpperCase()
  const font = (size: number) => (ctx.font = `400 ${size}px ${ANTON}`)
  for (let size = max; size >= min; size -= 4) {
    font(size)
    if (ctx.measureText(t).width <= maxW) return { size, lines: [t] }
  }
  if (twoLines) {
    const words = t.split(/\s+/)
    for (let size = Math.round(max * 0.77); size >= min; size -= 4) {
      font(size)
      let first = ''
      let i = 0
      while (i < words.length && ctx.measureText(`${first} ${words[i]}`.trim()).width <= maxW) first = `${first} ${words[i++]}`.trim()
      const second = words.slice(i).join(' ')
      if (first && ctx.measureText(second).width <= maxW) return { size, lines: [first, second] }
    }
    font(min)
    const first = fit(ctx, words[0] ?? t, maxW)
    return { size: min, lines: [first, fit(ctx, words.slice(1).join(' '), maxW)].filter(Boolean) }
  }
  font(min)
  return { size: min, lines: [fit(ctx, t, maxW)] }
}

const footer = (ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null, x: number, bottom: number, right: number, tall: boolean, cta: string) => {
  const [lw, lh, brand, site] = tall ? [59, 59, 28, 22] : [48, 48, 22, 16]
  const top = bottom - lh
  const mid = top + lh / 2
  if (logo) ctx.drawImage(logo, x, top, lw, lh)
  let cx = x + lw + (tall ? 18 : 16)
  cx += text(ctx, 'OMEGA HUB', cx, mid + brand * 0.36, `400 ${brand}px ${MICH}`, C.ink, brand * 0.04)
  if (tall) {
    text(ctx, SITE, right, mid + site * 0.36, `400 ${site}px ${MONO}`, C.cyan, site * 0.08, 'right')
    ctx.fillStyle = C.line
    ctx.fillRect(x, top - 21, right - x, 1)
    return
  }
  ctx.fillStyle = C.lineMid
  ctx.fillRect(cx + 16, mid - 14, 1, 28)
  cx += 33
  cx += text(ctx, SITE, cx, mid + site * 0.36, `400 ${site}px ${MONO}`, C.cyan, site * 0.08) + 16 + 8
  const ctaW = text(ctx, cta.toUpperCase(), right, mid + 12 * 0.36, `400 12px ${MONO}`, C.muted, 1.68, 'right')
  ctx.fillStyle = C.line
  ctx.fillRect(cx, mid, Math.max(0, right - ctaW - 16 - cx), 1)
}

const header = (ctx: CanvasRenderingContext2D, info: ImageInfo, x: number, y: number, right: number, tall: boolean) => {
  const [sq, size, spacing, h] = tall ? [14, 18, 2.52, 24] : [10, 13, 1.82, 18]
  const base = y + h / 2 + size * 0.36
  ctx.fillStyle = C.gold
  ctx.fillRect(x, y + (h - sq) / 2, sq, sq)
  const start = x + sq + (tall ? 14 : 12)
  const w = text(ctx, info.eyebrow.toUpperCase(), start, base, `700 ${size}px ${MONO}`, C.ink, spacing)
  const dw = text(ctx, info.date.toUpperCase(), right, base, `400 ${size}px ${MONO}`, C.muted, spacing, 'right')
  ctx.fillStyle = C.line
  ctx.fillRect(start + w + 12, y + h / 2, Math.max(0, right - dw - 12 - (start + w + 12)), 1)
}

const background = (ctx: CanvasRenderingContext2D, tall: boolean) => {
  const { w, h } = tall ? L.tall : L.wide
  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, w, h)
  if (tall) {
    glow(ctx, 0.2 * w, -0.08 * h, 900, 600, '69,207,220', 0.08)
    glow(ctx, 0.9 * w, -0.04 * h, 800, 600, '74,111,216', 0.15)
    dotField(ctx, w - 640, 640, 520, 0.65, 0.45)
  } else {
    glow(ctx, 0.22 * w, -0.12 * h, 1100, 520, '69,207,220', 0.07)
    glow(ctx, 0.82 * w, -0.08 * h, 900, 520, '74,111,216', 0.14)
    dotField(ctx, w - 760, 760, 420, 0.7, 0.4)
  }
}

/** The three most-copied main deck prints, the most-copied first (the middle of the fan). */
const keyCards = (deck: Deck) =>
  groupsOf(deck.main.length ? deck.main : [...deck.extra, ...deck.side])
    .map((g, i) => ({ ...g, i }))
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .slice(0, 3)
    .map((g) => g.id)

export const deckImage = async (deck: Deck, cards: CardMap, info: ImageInfo, layout: ImageLayout): Promise<Blob> => {
  readFonts()
  const tall = layout === 'tall'
  const { w: W, h: H, big, small } = L[layout]
  const keys = keyCards(deck)
  const ids = [...new Set([...deck.main, ...deck.extra, ...deck.side])]
  const shown = shownScans(document.images)
  const [, scanList, logo] = await Promise.all([
    Promise.all([`20px ${ANTON}`, `20px ${MICH}`, `20px ${MONO}`, `700 20px ${MONO}`, `700 20px ${FIG}`].map((f) => document.fonts.load(f).catch(() => []))),
    Promise.all(
      ids.map(async (id) => {
        const src = imageOf(id, cards.get(id))
        return [id, shown.get(src) ?? (await loadImage(scanUrl(src)))] as const
      }),
    ),
    loadImage('/omega-mark.png'),
  ])
  const scans = new Map(scanList)

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.textBaseline = 'alphabetic'
  const c: Ctx = { ctx, deck, cards, scans, points: info.points }
  const zones = ZONES.filter((z) => deck[z].length)
  const fmt = info.format && { label: info.format.name.toUpperCase(), color: FORMAT_COLOR[info.format.format.toLowerCase()] ?? C.cyan }
  const chipItems = [...(fmt ? [fmt] : []), ...(info.author ? [{ label: info.author.toUpperCase() }] : [])]
  const n = (z: Zone) => groupsOf(deck[z]).length

  background(ctx, tall)

  if (!tall) {
    header(ctx, info, 64, 56, 1856, false)
    const { size, lines } = titleLines(ctx, info.title, 1320, 128, 72, false)
    text(ctx, lines[0]!, 64, 98 + size * 0.874, `400 ${size}px ${ANTON}`, C.ink)
    chips(ctx, [...chipItems, { label: info.totals.toUpperCase() }], 64, 98 + size * 0.9 + 22, 1400, 14, 1.68, 16, 40, 8)
    fan(ctx, keys.map((id) => scans.get(id) ?? null), [
      [1566, 90, 144, 210, 0],
      [1460, 110, 136, 198, -9],
      [1680, 110, 136, 198, 9],
    ])
    // Main on the left; extra, then side, on the right (or on the left, with no main deck).
    const rest = zones.filter((z) => z !== 'main')
    const columns = zones.includes('main')
      ? [{ zones: ['main' as Zone], x: 64, w: 1044, s: big }, { zones: rest, x: 1156, w: 700, s: small }]
      : [{ zones: rest, x: 64, w: 1044, s: big }]
    for (const col of columns) {
      // Cards shrink when the column would run into the footer.
      const scale = scaleFor(H - 40 - 48 - 28 - 336, (s) => col.zones.reduce((h, z, i) => h + (i ? 24 : 0) + sectionHeight(n(z), col.w, col.s, s), 0))
      let y = 336
      for (const z of col.zones) y += section(c, z, `0${ZONES.indexOf(z) + 1}`, info.zones[z], col.x, y, col.w, col.s, scale) + 24
    }
    footer(ctx, logo, 64, H - 40, 1856, false, info.cta)
  } else {
    const X = 56
    const R = 1024
    header(ctx, info, X, 64, R, true)
    // Title block: bottom-aligned in the 300px row beside the fan, chips under it.
    const rowTop = 64 + 24 + 28
    const { size, lines } = titleLines(ctx, info.title, 544, 156, 64, true)
    const chipsH = chipItems.length ? 50 + 24 : 0
    const titleH = lines.length * size * 0.9
    let ty = rowTop + 300 - 8 - chipsH - titleH
    for (const line of lines) {
      text(ctx, line, X, ty + size * 0.874, `400 ${size}px ${ANTON}`, C.ink)
      ty += size * 0.9
    }
    if (chipItems.length) chips(ctx, chipItems, X, ty + 24, X + 544, 20, 2.4, 18, 50, 9)
    fan(ctx, keys.map((id) => scans.get(id) ?? null), [
      [740, rowTop + 14, 168, 245, 0],
      [636, rowTop + 40, 160, 233, -9],
      [852, rowTop + 40, 160, 233, 9],
    ])
    const top = rowTop + 300 + 52
    const avail = H - 56 - 59 - 21 - 40 - top
    const stack = (scale: number) => zones.reduce((h, z, i) => h + (i ? 48 : 0) + sectionHeight(n(z), 968, z === 'main' ? big : small, scale), 0)
    const scale = scaleFor(avail, stack)
    let y = top
    for (const z of zones) y += section(c, z, `0${ZONES.indexOf(z) + 1}`, info.zones[z], X, y, 968, z === 'main' ? big : small, scale) + 48
    footer(ctx, logo, X, H - 56, R, true, info.cta)
  }

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))), 'image/jpeg', 0.92))
}
