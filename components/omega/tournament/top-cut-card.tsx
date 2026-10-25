'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@ui/button'
import { ModeTabs } from '@ui/mode-tabs'
import { Panel } from '@ui/panel'
import { DAY_YEAR, banlistLabel } from '@omega/tournament/labels'
import { anton, figtree, michroma, spaceMono } from '@utils/fonts'
import type { ArchetypeStat, Standing, TournamentSummary } from '@utils/types'

/**
 * The top cut as an image to post, 16:9 or 9:16: a donut of the decks with their art in the slices and the
 * list beside or under it. Drawn on a canvas so it downloads and shares as a PNG with no library.
 */

const SITE = 'next.duelistsunite.org'
/** Rows the left column holds in two columns; past it the tail folds into Others. */
const MAX_ROWS = 20

const C = {
  bg: '#080a14',
  s100: '#0e1222',
  s200: '#151a2e',
  line: '#1f2744',
  lineMid: '#33406a',
  ink: '#eef1f8',
  dim: '#b3bdd2',
  muted: '#8e99b4',
  cyan: '#00fdff',
  gold: '#efd17e',
  goldInk: '#1a1405',
}
const FORMAT_COLOR: Record<string, string> = { TCG: '#3fcf7a', Genesys: '#ea5fc0', Edison: '#7f9cf0', 'Rush Duel': C.cyan }

const ANTON = anton.style.fontFamily
const FIG = figtree.style.fontFamily
const MONO = spaceMono.style.fontFamily
const MICH = michroma.style.fontFamily

type Slice = { name: string; count: number; art: number | null; others: boolean }

/** The decks of ranks 1–`top`, by archetype, biggest first and the unnamed ones last as `othersLabel`. */
export const cutSlices = (standings: Standing[], archetypes: ArchetypeStat[], top: number, othersLabel: string): Slice[] => {
  const art = new Map(archetypes.map((a) => [a.archetype, a.artCardId]))
  const groups = new Map<string, Slice>()
  for (const s of standings) {
    if (s.rank > top) continue
    const name = s.deck?.archetype ?? null
    const key = name ?? '\0'
    const g = groups.get(key) ?? { name: name ?? othersLabel, count: 0, art: name ? (art.get(name) ?? s.deck?.archetypes[0]?.art ?? null) : null, others: !name }
    g.count++
    groups.set(key, g)
  }
  const named = [...groups.values()].filter((g) => !g.others).sort((a, b) => b.count - a.count)
  const rest = groups.get('\0')?.count ?? 0
  const keep = named.length + Number(rest > 0) > MAX_ROWS ? MAX_ROWS - 1 : named.length
  const folded = rest + named.slice(keep).reduce((sum, g) => sum + g.count, 0)
  return [...named.slice(0, keep), ...(folded ? [{ name: othersLabel, count: folded, art: null, others: true }] : [])]
}

/** Same-origin, edge-cached (see `app/card-image`): the art host sends no CORS headers, which would taint the canvas. */
const loadArt = (id: number) => loadImage(`/card-image/arts/${id}.jpg`)

const loadImage = (src: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })

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

/** A row's top-right corner cut, like the list rows of the design. */
const notch = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: number) => {
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + w - c, y)
  ctx.lineTo(x + w, y + c)
  ctx.lineTo(x + w, y + h)
  ctx.lineTo(x, y + h)
  ctx.closePath()
}

/** `img` cover-cropped into the square at x,y. */
const cover = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, size: number) => {
  const s = Math.min(img.naturalWidth, img.naturalHeight)
  ctx.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, x, y, size, size)
}

const dots = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, step: number, r: number, color: string) => {
  ctx.fillStyle = color
  for (let dy = step / 2; dy < h; dy += step) for (let dx = step / 2; dx < w; dx += step) ctx.fillRect(x + dx - r / 2, y + dy - r / 2, r, r)
}

/** Text cut with an ellipsis to `max` px. */
const fit = (ctx: CanvasRenderingContext2D, text: string, max: number) => {
  if (ctx.measureText(text).width <= max) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1)
  return `${t}…`
}

const text = (ctx: CanvasRenderingContext2D, value: string, x: number, y: number, font: string, color: string, opts: { align?: CanvasTextAlign; spacing?: number } = {}) => {
  ctx.font = font
  ctx.fillStyle = color
  ctx.textAlign = opts.align ?? 'left'
  ctx.letterSpacing = `${opts.spacing ?? 0}px`
  ctx.fillText(value, x, y)
  ctx.letterSpacing = '0px'
}

type Labels = {
  eyebrow: string
  top: string
  duelists: string
  winner: string | null
  section: string
  archetypes: string
  topCut: string
  date: string
  decks: (count: number) => string
}

/**
 * `wide` 16:9 for feeds and Discord: text left, donut right. `story` 9:16 for stories, reels and TikTok:
 * header, donut, then the list. The donut sits at a fixed spot so the header can wrap a chip row above it.
 */
export const LAYOUTS = {
  wide: { w: 1920, h: 1080, cw: 840, ox: 1420, oy: 540, r: 420 },
  story: { w: 1080, h: 1920, cw: 920, ox: 540, oy: 760, r: 360 },
} as const
export type Layout = keyof typeof LAYOUTS

const draw = (
  ctx: CanvasRenderingContext2D,
  { layout, title, format, slices, winner, labels, arts, logo }: {
    layout: Layout
    title: string
    format: string
    slices: Slice[]
    winner: string | null
    labels: Labels
    arts: Map<number, HTMLImageElement | null>
    logo: HTMLImageElement | null
  },
) => {
  const { w: W, h: H, cw: CW, ox: OX, oy: OY, r: R } = LAYOUTS[layout]
  const story = layout === 'story'
  const fmt = FORMAT_COLOR[format] ?? C.cyan
  ctx.textBaseline = 'alphabetic'

  // Ground: two soft glows from the top and a dot field fading out around the donut.
  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, W, H)
  for (const [x, y, r, rgb, a] of [[0.22 * W, -130, 900, '0,253,255', 0.07], [0.78 * W, -86, 800, '74,111,216', 0.13]] as const) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, `rgba(${rgb},${a})`)
    g.addColorStop(0.7, `rgba(${rgb},0)`)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  }
  const reach = (R / 420) * 778
  for (let y = 12; y < H; y += 24) {
    for (let x = 12; x < W; x += 24) {
      const d = Math.hypot(x - OX, y - OY) / reach
      const a = 0.16 * Math.min(1, Math.max(0, (0.68 - d) / 0.38))
      if (a <= 0) continue
      ctx.fillStyle = `rgba(142,166,199,${a})`
      ctx.beginPath()
      ctx.arc(x, y, 1.2, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Text column: left of the donut on `wide`, above and below it on `story`.
  const L = 80
  ctx.fillStyle = C.gold
  ctx.fillRect(L, 76, 12, 12)
  text(ctx, labels.eyebrow, L + 24, 88, `700 16px ${MONO}`, C.ink, { spacing: 2.2 })
  text(ctx, labels.top, L + CW, 88, `400 16px ${MONO}`, C.muted, { align: 'right', spacing: 2.2 })
  ctx.font = `700 16px ${MONO}`
  ctx.letterSpacing = '2.2px'
  const eyeEnd = L + 24 + ctx.measureText(labels.eyebrow).width + 12
  ctx.font = `400 16px ${MONO}`
  const topStart = L + CW - ctx.measureText(labels.top).width - 12
  ctx.letterSpacing = '0px'
  ctx.fillStyle = C.line
  ctx.fillRect(eyeEnd, 82, Math.max(0, topStart - eyeEnd), 1)

  // Title: 96px Anton, down to 56px before it ellipsises.
  let size = 96
  ctx.font = `400 ${size}px ${ANTON}`
  while (size > 56 && ctx.measureText(title.toUpperCase()).width > CW) ctx.font = `400 ${(size -= 4)}px ${ANTON}`
  const titleY = 112 + size * 0.78
  text(ctx, fit(ctx, title.toUpperCase(), CW), L, titleY, ctx.font, C.ink)

  // Chips.
  let cx = L
  let cy = titleY + 36
  const chip = (label: string, fill: string, ink: string, edge?: string) => {
    ctx.font = `700 17px ${MONO}`
    ctx.letterSpacing = '2px'
    const w = ctx.measureText(label).width + 36
    ctx.letterSpacing = '0px'
    if (cx + w > L + CW) {
      cx = L
      cy += 62
    }
    if (edge) {
      ctx.fillStyle = edge
      chamfer(ctx, cx, cy, w, 50, 8)
      ctx.fill()
      ctx.fillStyle = fill
      chamfer(ctx, cx + 2, cy + 2, w - 4, 46, 7)
      ctx.fill()
    } else {
      ctx.fillStyle = fill
      chamfer(ctx, cx, cy, w, 50, 8)
      ctx.fill()
    }
    text(ctx, label, cx + 18, cy + 31, `${edge || fill === C.gold ? 700 : 400} 17px ${MONO}`, ink, { spacing: 2 })
    cx += w + 12
  }
  chip(format.toUpperCase(), C.s100, fmt, fmt)
  chip(labels.date.toUpperCase(), C.s100, C.dim)
  chip(labels.duelists.toUpperCase(), C.s100, C.dim)
  if (labels.winner) chip(labels.winner.toUpperCase(), C.gold, C.goldInk)

  // Section row.
  const sy = story ? OY + R + 72 : cy + 50 + 52
  text(ctx, '01', L, sy, `700 15px ${MONO}`, C.gold, { spacing: 2 })
  text(ctx, labels.section.toUpperCase(), L + 40, sy, `400 15px ${MONO}`, C.ink, { spacing: 2 })
  text(ctx, labels.archetypes.toUpperCase(), L + CW, sy, `400 15px ${MONO}`, C.muted, { align: 'right', spacing: 2 })
  ctx.font = `400 15px ${MONO}`
  ctx.letterSpacing = '2px'
  const secEnd = L + 40 + ctx.measureText(labels.section.toUpperCase()).width + 12
  const secStart = L + CW - ctx.measureText(labels.archetypes.toUpperCase()).width - 12
  ctx.letterSpacing = '0px'
  ctx.fillStyle = C.line
  ctx.fillRect(secEnd, sy - 4, Math.max(0, secStart - secEnd), 1)

  // Rows: one column of 64px up to 8, then two columns of 52px.
  const total = slices.reduce((sum, s) => sum + s.count, 0) || 1
  const max = Math.max(1, ...slices.map((s) => s.count))
  const compact = slices.length > 8
  const rowH = compact ? 52 : 64
  const perCol = compact ? Math.ceil(slices.length / 2) : slices.length
  const colW = compact ? (CW - 24) / 2 : CW
  const top0 = sy + 20
  slices.forEach((s, i) => {
    const x = L + (compact ? Math.floor(i / perCol) * (colW + 24) : 0)
    const y = top0 + (i % perCol) * (rowH + 8)
    const win = !s.others && s.name === winner
    ctx.fillStyle = C.s100
    notch(ctx, x, y, colW, rowH, compact ? 10 : 12)
    ctx.fill()
    const b = compact ? 30 : 36
    const bx = x + (compact ? 10 : 12)
    ctx.fillStyle = win ? C.gold : C.s200
    chamfer(ctx, bx, y + (rowH - b) / 2, b, b, 6)
    ctx.fill()
    text(ctx, String(i + 1).padStart(2, '0'), bx + b / 2, y + rowH / 2 + (compact ? 6 : 7), `400 ${compact ? 15 : 18}px ${ANTON}`, win ? C.goldInk : C.ink, { align: 'center' })
    const ax = bx + b + (compact ? 12 : 16)
    ctx.fillStyle = C.s200
    ctx.fillRect(ax, y, rowH, rowH)
    const img = s.art ? arts.get(s.art) : null
    if (img) cover(ctx, img, ax, y, rowH)
    else dots(ctx, ax, y, rowH, rowH, compact ? 10 : 12, 2, 'rgba(142,166,199,0.4)')
    const pctW = compact ? 66 : 90
    const cntW = compact ? 34 : 52
    const pad = compact ? 14 : 20
    const nx = ax + rowH + (compact ? 12 : 16)
    const nameW = x + colW - pad - pctW - cntW - (compact ? 24 : 32) - nx
    ctx.font = `700 ${compact ? 20 : 26}px ${FIG}`
    text(ctx, fit(ctx, s.name, nameW), nx, y + (compact ? 24 : 31), ctx.font, win ? C.gold : C.ink)
    const barY = y + (compact ? 34 : 42)
    const barH = compact ? 3 : 4
    ctx.fillStyle = C.line
    ctx.fillRect(nx, barY, nameW, barH)
    ctx.fillStyle = win ? C.gold : C.cyan
    ctx.fillRect(nx, barY, (nameW * s.count) / max, barH)
    text(ctx, String(s.count), x + colW - pad - pctW - (compact ? 12 : 16), y + rowH / 2 + (compact ? 9 : 12), `400 ${compact ? 24 : 34}px ${ANTON}`, C.ink, { align: 'right' })
    text(ctx, `${((s.count / total) * 100).toFixed(1)}%`, x + colW - pad, y + rowH / 2 + 6, `400 ${compact ? 14 : 18}px ${MONO}`, C.muted, { align: 'right', spacing: 0.6 })
  })

  // Footer.
  if (logo) ctx.drawImage(logo, L, H - 40 - 48, 48, 48)
  text(ctx, 'OMEGA HUB', L + 64, H - 40 - 16, `400 22px ${MICH}`, C.ink, { spacing: 0.9 })
  ctx.font = `400 22px ${MICH}`
  ctx.letterSpacing = '0.9px'
  const brandEnd = L + 64 + ctx.measureText('OMEGA HUB').width + 16
  ctx.letterSpacing = '0px'
  ctx.fillStyle = C.lineMid
  ctx.fillRect(brandEnd, H - 40 - 38, 1, 28)
  text(ctx, SITE, brandEnd + 17, H - 40 - 17, `400 19px ${MONO}`, C.cyan, { spacing: 1.4 })

  // Donut: each slice clipped to its wedge, filled with its deck's art.
  ctx.strokeStyle = C.line
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(OX, OY, R + 21, 0, Math.PI * 2)
  ctx.stroke()
  const rad = (deg: number) => ((deg - 90) * Math.PI) / 180
  let a0 = 0
  const starts: number[] = []
  slices.forEach((s) => {
    const sweep = (s.count / total) * 360
    starts.push(a0)
    ctx.save()
    ctx.beginPath()
    if (sweep < 359.9) ctx.moveTo(OX, OY)
    ctx.arc(OX, OY, R, rad(a0), rad(a0 + sweep))
    ctx.closePath()
    ctx.clip()
    // Bounding square of the wedge, so the art sits on the slice and not on the whole circle.
    const pts: number[][] = [[OX, OY]]
    for (let k = 0; k <= 32; k++) pts.push([OX + R * Math.cos(rad(a0 + (sweep * k) / 32)), OY + R * Math.sin(rad(a0 + (sweep * k) / 32))])
    const xs = pts.map((p) => p[0]!)
    const ys = pts.map((p) => p[1]!)
    const side = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 120)
    const mx = (Math.max(...xs) + Math.min(...xs)) / 2
    const my = (Math.max(...ys) + Math.min(...ys)) / 2
    ctx.fillStyle = C.s200
    ctx.fillRect(OX - R, OY - R, R * 2, R * 2)
    const img = s.art ? arts.get(s.art) : null
    if (img) cover(ctx, img, mx - side / 2, my - side / 2, side)
    else dots(ctx, OX - R, OY - R, R * 2, R * 2, 20, 2.6, 'rgba(142,166,199,0.35)')
    ctx.restore()
    a0 += sweep
  })
  if (slices.length > 1) {
    ctx.strokeStyle = C.bg
    ctx.lineWidth = 6
    for (const a of starts) {
      ctx.beginPath()
      ctx.moveTo(OX, OY)
      ctx.lineTo(OX + (R + 6) * Math.cos(rad(a)), OY + (R + 6) * Math.sin(rad(a)))
      ctx.stroke()
    }
  }
  ctx.fillStyle = C.bg
  ctx.strokeStyle = C.lineMid
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(OX, OY, 150, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  text(ctx, labels.topCut.toUpperCase(), OX, OY - 74, `400 17px ${MONO}`, C.muted, { align: 'center', spacing: 3.4 })
  text(ctx, String(total), OX, OY + 50, `400 132px ${ANTON}`, C.ink, { align: 'center' })
  text(ctx, format.toUpperCase(), OX, OY + 94, `400 17px ${MONO}`, fmt, { align: 'center', spacing: 3.4 })

  // Share of the top cut and deck count on each slice wide enough to hold them; the list carries the rest.
  slices.forEach((s, i) => {
    const sweep = (s.count / total) * 360
    if (sweep < 20 || sweep >= 359.9) return
    const mid = rad(starts[i]! + sweep / 2)
    const x = OX + R * 0.72 * Math.cos(mid) - 56
    const y = OY + R * 0.72 * Math.sin(mid) - 34
    const win = !s.others && s.name === winner
    ctx.fillStyle = win ? C.gold : C.bg
    chamfer(ctx, x, y, 112, 68, 9)
    ctx.fill()
    text(ctx, `${Math.round((s.count / total) * 100)}%`, x + 56, y + 36, `400 30px ${ANTON}`, win ? C.goldInk : C.ink, { align: 'center' })
    text(ctx, labels.decks(s.count).toUpperCase(), x + 56, y + 57, `700 14px ${MONO}`, win ? C.goldInk : C.muted, { align: 'center', spacing: 1.4 })
  })

  // Spine.
  ctx.save()
  ctx.translate(W - 26 - 9, H / 2)
  ctx.rotate(Math.PI / 2)
  text(ctx, `// ${SITE} · Omega Hub`.toUpperCase(), 0, 0, `400 15px ${MONO}`, C.muted, { align: 'center', spacing: 4.6 })
  ctx.restore()
}

/** `top`: the tournament's top cut, by the same rule as the conversion chart. */
export const TopCutCard = ({ tournament, standings, archetypes, top }: {
  tournament: TournamentSummary
  standings: Standing[]
  archetypes: ArchetypeStat[]
  top: number
}) => {
  const t = useTranslations('Tournaments.stats.topCutCard')
  const tStats = useTranslations('Tournaments.stats')
  const locale = useLocale()
  const canvas = useRef<HTMLCanvasElement>(null)
  const [layout, setLayout] = useState<Layout>('wide')
  const slices = cutSlices(standings, archetypes, top, tStats('others'))
  const winner = standings.find((s) => s.rank === 1)?.deck?.archetype ?? null
  const title = `${banlistLabel(tournament)} #${tournament.id}`
  const arch = slices.filter((s) => !s.others).length
  const label = t('alt', { top, decks: slices.map((s) => `${s.name} ${s.count}`).join(', ') })
  const key = JSON.stringify([layout, top, slices, locale])

  useEffect(() => {
    let stale = false
    const ctx = canvas.current?.getContext('2d')
    if (!ctx) return
    const ids = [...new Set(slices.flatMap((s) => (s.art ? [s.art] : [])))]
    Promise.all([
      Promise.all(
        [`20px ${ANTON}`, `20px ${MICH}`, `20px ${MONO}`, `700 20px ${MONO}`, `700 20px ${FIG}`].map((f) => document.fonts.load(f).catch(() => [])),
      ),
      Promise.all(ids.map(async (id) => [id, await loadArt(id)] as const)),
      loadImage('/omega-mark.png'),
    ]).then(([, arts, logo]) => {
      if (stale) return
      draw(ctx, {
        layout,
        title,
        format: tournament.format,
        slices,
        winner,
        arts: new Map(arts),
        logo,
        labels: {
          eyebrow: t('eyebrow').toUpperCase(),
          top: `TOP ${top}`,
          duelists: t('duelists', { count: tournament.players }),
          winner: winner ? t('winner', { deck: winner }) : null,
          section: t('section'),
          archetypes: t('archetypes', { count: arch }),
          topCut: t('topCut'),
          decks: (count) => t('decks', { count }),
          date: new Intl.DateTimeFormat(locale, DAY_YEAR).format(new Date(tournament.startedAt)),
        },
      })
    })
    return () => {
      stale = true
    }
    // `key` stands for every input the drawing reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const file = () =>
    new Promise<File | null>((resolve) => {
      if (!canvas.current) return resolve(null)
      canvas.current.toBlob((blob) => resolve(blob && new File([blob], `omega-${tournament.id}-top${top}${layout === 'story' ? '-story' : ''}.png`, { type: 'image/png' })), 'image/png')
    })

  const download = async () => {
    const f = await file()
    if (!f) return
    const url = URL.createObjectURL(f)
    const a = document.createElement('a')
    a.href = url
    a.download = f.name
    a.click()
    // Revoked on the next tick: some browsers drop a download whose URL dies inside the click.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  /** The system share sheet with the PNG where the browser takes files; a download everywhere else. */
  const share = async () => {
    const f = await file()
    if (!f) return
    if (navigator.canShare?.({ files: [f] })) {
      await navigator.share({ files: [f], title }).catch(() => {})
      return
    }
    void download()
  }

  return (
    <Panel
      title={t('title')}
      meta={t('meta', { count: arch })}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <ModeTabs label={t('layout')} value={layout} onChange={setLayout} items={[{ id: 'wide', label: '16:9' }, { id: 'story', label: '9:16' }]} />
          {/* Phones and tablets only: a desktop share sheet rarely takes a file. */}
          <Button size="mono-md" variant="primary" onClick={share} className="hidden pointer-coarse:inline-flex">
            {t('share')}
          </Button>
          <Button size="mono-md" variant="primary" onClick={download}>
            {t('download')}
          </Button>
        </div>
      }
    >
      <canvas
        ref={canvas}
        width={LAYOUTS[layout].w}
        height={LAYOUTS[layout].h}
        role="img"
        aria-label={label}
        className={`mx-auto block h-auto w-full bg-space-000 ${layout === 'story' ? 'max-w-sm' : ''}`}
      />
      <p className="mt-3 text-[13px] leading-5 text-ink-muted">{t('hint')}</p>
    </Panel>
  )
}
