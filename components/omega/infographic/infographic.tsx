/**
 * Shared pieces of the statistics infographics (`/statistics/infographic/*`, `/profile/:id/statistics/infographic/*`):
 * a PNG drawn by `next/og` (Satori), 1920×1080 (`?size=wide`) or 1080×1920 (`?size=tall`), after the tournament
 * top-cut card: Anton titles, Space Mono eyebrows and chips, the Omega Hub footer and the spine.
 *
 * Satori lays out flexbox only: every element with more than one child needs `display: flex`.
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { createTranslator } from 'next-intl'
import type { CSSProperties, ReactNode } from 'react'
import sharp from 'sharp'
import { CARD_ART_URL, CARD_IMAGE_URL } from '@utils/const'
import { SITE_URL } from '@utils/config'
import { LOCALES, DEFAULT_LOCALE } from '@i18n/request'

export const C = {
  bg: '#080a14',
  surface: '#0e1222',
  surface2: '#151a2e',
  line: '#1f2744',
  lineMid: '#33406a',
  ink: '#eef1f8',
  dim: '#b3bdd2',
  muted: '#8e99b4',
  cyan: '#00fdff',
  gold: '#efd17e',
  goldInk: '#1a1405',
  win: '#4fdc8c',
  loss: '#ff8594',
  series: ['#00a6b5', '#e14660', '#337bd0', '#c0851f', '#8169dd', '#36a558', '#d45fb8', '#5fa8ff', '#9ab33c', '#c3cbd8'],
  tier: { 1: '#5fa8ff', 1.5: '#5fbfe4', 2: '#5fd4c4', 3: '#c3cbd8', 4: '#efd17e' } as Record<number, string>,
}

/** The DS families; `loadFonts` fetches their TTFs, and Satori falls back to its bundled sans when that fails. */
export const F = { display: 'Anton', sans: 'Figtree', mono: 'Space Mono', brand: 'Michroma' }
const SITE = SITE_URL.replace(/^https?:\/\//, '')
const BRAND = 'OMEGA HUB'

const SIZES = { wide: { width: 1920, height: 1080 }, tall: { width: 1080, height: 1920 } } as const
export type Size = keyof typeof SIZES

export const sizeOf = (params: URLSearchParams): Size => (params.get('size') === 'tall' ? 'tall' : 'wide')

/** `?locale=` (the page's), not the cookie: the URL is the cache key and the shared link. */
export const translator = async <N extends string>(params: URLSearchParams, namespace: N) => {
  const asked = params.get('locale')
  const locale = (LOCALES as readonly string[]).includes(asked ?? '') ? asked! : DEFAULT_LOCALE
  const messages = (await import(`../../../messages/${locale}.json`)).default
  return { locale, t: createTranslator({ locale, messages, namespace: namespace as never }) as (key: string, values?: Record<string, string | number>) => string }
}

export const pct = (v: number | null | undefined, digits = 1) => (v == null ? '—' : `${(v * 100).toFixed(digits)}%`)
export const num = (v: number, locale: string) => v.toLocaleString(locale)

export const row: CSSProperties = { display: 'flex', flexDirection: 'row', alignItems: 'center' }
export const col: CSSProperties = { display: 'flex', flexDirection: 'column' }
export const mono: CSSProperties = { fontFamily: F.mono, letterSpacing: 2, textTransform: 'uppercase' }

/** The largest art any infographic draws. Every 624 px original goes into the SVG whole otherwise: a 50-deck board peaked at 300 MB instead of 150. */
const ART_WIDTH = 320

/** A timeout or a server error tries once more, so one slow file on a big board doesn't leave its tile blank. */
export const toDataUri = async (url: string, width?: number, retry = true): Promise<string | null> => {
  try {
    // A day in the data cache: art never changes, and the origin takes seconds per file.
    const res = await fetch(url, { next: { revalidate: 86_400 }, signal: AbortSignal.timeout(8000) })
    if (!res.ok) return res.status >= 500 && retry ? toDataUri(url, width, false) : null
    const file = Buffer.from(await res.arrayBuffer())
    if (width) return `data:image/jpeg;base64,${(await sharp(file).resize({ width, withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer()).toString('base64')}`
    return `data:${res.headers.get('content-type') ?? 'image/jpeg'};base64,${file.toString('base64')}`
  } catch {
    return retry ? toDataUri(url, width, false) : null
  }
}

/** Card art (`'art'`) or the full card (`'card'`) as data URIs, fetched in parallel. A miss is left out, never a failed render. */
export const loadImages = async (ids: (number | null | undefined)[], kind: 'art' | 'card' = 'art') => {
  const unique = [...new Set(ids.filter((id): id is number => id != null))]
  const uris = await Promise.all(unique.map((id) => toDataUri(kind === 'art' ? CARD_ART_URL(id) : CARD_IMAGE_URL(id), ART_WIDTH)))
  return new Map(unique.flatMap((id, i) => (uris[i] ? [[id, uris[i]] as const] : [])))
}

/** The answer when the render queue is full: the download buttons show it as a failed try. */
export const busy = () => new Response(null, { status: 503, headers: { 'retry-after': '60' } })

let mark: Promise<string | null> | null = null
const markUri = () =>
  (mark ??= readFile(join(process.cwd(), 'public', 'omega-mark.png'))
    .then((b) => `data:image/png;base64,${b.toString('base64')}`)
    .catch(() => null))

type Font = { name: string; data: ArrayBuffer; weight: 400 | 700; style: 'normal' }
const GOOGLE_CSS = 'https://fonts.googleapis.com/css2?family=Anton&family=Figtree:wght@400;700&family=Space+Mono:wght@400;700&family=Michroma'
let fonts: Promise<Font[]> | null = null
/** The TTFs behind `F`, from Google Fonts (a plain fetch gets truetype, not woff2), kept for the process. A failure retries next time. */
const loadFonts = () =>
  (fonts ??= (async () => {
    try {
      const css = await (await fetch(GOOGLE_CSS, { cache: 'force-cache', signal: AbortSignal.timeout(8000) })).text()
      const faces = [...css.matchAll(/font-family:\s*'([^']+)';[^}]*?font-weight:\s*(\d+);[^}]*?url\(([^)]+)\)\s*format\('(?:truetype|opentype)'\)/g)]
      const loaded = await Promise.all(
        faces.map(async ([, name, weight, url]): Promise<Font> => ({ name: name!, weight: Number(weight) === 700 ? 700 : 400, style: 'normal', data: await (await fetch(url!, { cache: 'force-cache', signal: AbortSignal.timeout(8000) })).arrayBuffer() })),
      )
      if (!loaded.length) throw new Error('no faces')
      return loaded
    } catch {
      fonts = null
      return []
    }
  })())

/** A square of card art; a plain tile when the art didn't load. */
export const Art = ({ src, subSrc, size, radius = 0, edge = C.line }: { src?: string; subSrc?: string; size: number; radius?: number; edge?: string }) =>
  subSrc ? (
    <div style={{ display: 'flex', position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <Art src={src} size={size} radius={radius} edge={edge} />
      <div style={{ display: 'flex', position: 'absolute', bottom: 0, right: 0, padding: 3, background: C.bg }}>
        <Art src={subSrc} size={Math.round(size * 0.46)} edge={C.lineMid} />
      </div>
    </div>
  ) : src ? (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img src={src} width={size} height={size} style={{ width: size, height: size, objectFit: 'cover', borderRadius: radius, border: `2px solid ${edge}`, flexShrink: 0 }} />
  ) : (
    <div style={{ display: 'flex', width: size, height: size, borderRadius: radius, background: C.surface2, border: `2px solid ${edge}`, flexShrink: 0 }} />
  )

/** Mono caps, the DS "signal" text. */
export const Label = ({ children, color = C.muted, size = 15, weight = 400 }: { children: ReactNode; color?: string; size?: number; weight?: 400 | 700 }) => (
  <div style={{ display: 'flex', ...mono, fontSize: size, fontWeight: weight, color }}>{children}</div>
)

/** "01 TITLE ———— aside": the section row of the tournament card. */
export const Head = ({ n, title, aside, color = C.gold }: { n: string; title: string; aside?: string; color?: string }) => (
  <div style={{ ...row, gap: 12, flexShrink: 0 }}>
    <Label color={color} weight={700}>{n}</Label>
    <Label color={C.ink}>{title}</Label>
    <div style={{ display: 'flex', flex: 1, height: 1, background: C.line }} />
    {aside ? <Label>{aside}</Label> : null}
  </div>
)

/** A number with its label on a surface tile: Anton for the value. */
export const Kpi = ({ label, value, color = C.ink, size = 64, hint }: { label: string; value: string; color?: string; size?: number; hint?: string }) => (
  <div style={{ ...col, flex: 1, flexShrink: 0, gap: 8, padding: '22px 26px', background: C.surface, borderTop: `3px solid ${C.line}` }}>
    <Label>{label}</Label>
    <div style={{ display: 'flex', fontFamily: F.display, fontSize: size, color, lineHeight: 1 }}>{value}</div>
    {hint ? <div style={{ display: 'flex', fontSize: 18, color: C.dim }}>{hint}</div> : null}
  </div>
)

/** A horizontal bar on a track; `value` 0..1 of the track. */
export const Bar = ({ value, color = C.cyan, height = 8, track = C.line, reverse = false }: { value: number; color?: string; height?: number; track?: string; reverse?: boolean }) => (
  <div style={{ display: 'flex', flex: 1, height, background: track, justifyContent: reverse ? 'flex-end' : 'flex-start' }}>
    <div style={{ display: 'flex', width: `${Math.max(0, Math.min(1, value)) * 100}%`, height, background: color }} />
  </div>
)

export const Panel = ({ n, title, aside, children, style }: { n?: string; title?: string; aside?: string; children: ReactNode; style?: CSSProperties }) => (
  <div style={{ ...col, flexShrink: 0, gap: 20, padding: 28, background: C.surface, border: `1px solid ${C.line}`, ...style }}>
    {title ? <Head n={n ?? '//'} title={title} aside={aside} /> : null}
    {children}
  </div>
)

/** The chip of the tournament card: mono caps on a surface, edged in `edge` when it carries a colour. */
export const Chip = ({ children, color = C.dim, edge, fill = C.surface }: { children: ReactNode; color?: string; edge?: string; fill?: string }) => (
  <div style={{ display: 'flex', ...mono, fontSize: 17, fontWeight: edge ? 700 : 400, color, padding: '0 18px', height: 46, alignItems: 'center', background: fill, border: `2px solid ${edge ?? fill}`, flexShrink: 0 }}>
    {children}
  </div>
)

export const Empty = ({ children }: { children: ReactNode }) => (
  <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', fontSize: 40, color: C.muted }}>{children}</div>
)

export type Slice = { value: number; color: string; art?: string; label?: string; sub?: string; edge?: string }

const rad = (deg: number) => ((deg - 90) * Math.PI) / 180

/**
 * The donut of the tournament card: each slice a wedge of its art (or colour), a disk of `bg` in the middle
 * holding `center`, and a label badge on every slice wide enough. `slices` sum to the whole; `hole` is the disk's diameter.
 */
export const Donut = ({ slices, size, hole, center }: { slices: Slice[]; size: number; hole: number; center?: ReactNode }) => {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1
  const R = size / 2
  const wedges: { s: Slice; a0: number; sweep: number }[] = []
  let a0 = 0
  for (const s of slices) {
    const sweep = (s.value / total) * 360
    if (sweep > 0) wedges.push({ s, a0, sweep })
    a0 += sweep
  }
  const clip = (start: number, sweep: number) => {
    if (sweep >= 359.9) return undefined
    const steps = Math.max(2, Math.ceil(sweep / 3))
    const pts = [`${R}px ${R}px`]
    for (let k = 0; k <= steps; k++) {
      const a = rad(start + (sweep * k) / steps)
      pts.push(`${(R + (R + 1) * Math.cos(a)).toFixed(1)}px ${(R + (R + 1) * Math.sin(a)).toFixed(1)}px`)
    }
    // Satori splits the points on bare commas: no space after them.
    return `polygon(${pts.join(',')})`
  }
  // No border-radius on a slice: Satori drops `clipPath` when the element has its own radius clip. A whole circle gets the radius instead.
  const shape = (start: number, sweep: number) => (sweep >= 359.9 ? { borderRadius: R } : { clipPath: clip(start, sweep) })
  return (
    <div style={{ display: 'flex', position: 'relative', width: size, height: size, flexShrink: 0 }}>
      {wedges.map(({ s, a0, sweep }, i) =>
        s.art ? (
          // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
          <img key={i} src={s.art} width={size} height={size} style={{ position: 'absolute', left: 0, top: 0, width: size, height: size, objectFit: 'cover', ...shape(a0, sweep) }} />
        ) : (
          <div key={i} style={{ display: 'flex', position: 'absolute', left: 0, top: 0, width: size, height: size, background: s.color, ...shape(a0, sweep) }} />
        ),
      )}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute', left: 0, top: 0 }}>
        {wedges.length > 1
          ? wedges.map(({ a0 }, i) => <line key={i} x1={R} y1={R} x2={R + (R + 2) * Math.cos(rad(a0))} y2={R + (R + 2) * Math.sin(rad(a0))} stroke={C.bg} strokeWidth={5} />)
          : null}
        <circle cx={R} cy={R} r={R - 1} fill="none" stroke={C.line} strokeWidth={2} />
      </svg>
      {/* `center` is one element, never a Fragment: Satori lays a Fragment's children out in a row. */}
      <div style={{ display: 'flex', position: 'absolute', left: R - hole / 2, top: R - hole / 2, width: hole, height: hole, borderRadius: hole / 2, background: C.bg, border: `1px solid ${C.lineMid}`, alignItems: 'center', justifyContent: 'center' }}>
        {center}
      </div>
      {wedges.map(({ s, a0, sweep }, i) => {
        if (sweep < 18 || sweep >= 359.9 || !s.label) return null
        const mid = rad(a0 + sweep / 2)
        const d = (R + hole / 2) / 2
        const w = 104
        const h = s.sub ? 62 : 44
        return (
          <div key={i} style={{ ...col, position: 'absolute', left: R + d * Math.cos(mid) - w / 2, top: R + d * Math.sin(mid) - h / 2, width: w, height: h, alignItems: 'center', justifyContent: 'center', background: s.edge ?? C.bg, border: `1px solid ${s.edge ?? C.lineMid}` }}>
            <div style={{ display: 'flex', fontFamily: F.display, fontSize: 28, lineHeight: 1, color: s.edge ? C.goldInk : C.ink }}>{s.label}</div>
            {s.sub ? <div style={{ display: 'flex', ...mono, fontSize: 12, fontWeight: 700, letterSpacing: 1.4, color: s.edge ? C.goldInk : C.muted }}>{s.sub}</div> : null}
          </div>
        )
      })}
    </div>
  )
}

/** The frame: eyebrow row, Anton title, chips, the body, the Omega Hub footer and the spine. `subtitle` is the first chip. */
export const render = async ({ size, eyebrow, aside, title, subtitle, chips = [], footer, body, cache, compact = false }: {
  size: Size
  /** "Ranked statistics": the mono line over the title. */
  eyebrow?: string
  /** The right end of the eyebrow row. */
  aside?: string
  title: string
  subtitle: string
  chips?: string[]
  footer: string
  body: ReactNode
  /** `Cache-Control` of the PNG. */
  cache: string
  /** More room for a board with several rows and multiline deck names. */
  compact?: boolean
}) => {
  const { width, height } = SIZES[size]
  const wide = size === 'wide'
  const pad = wide ? 72 : 64
  const [logo, faces] = await Promise.all([markUri(), loadFonts()])
  const glow = (x: string, rgb: string, a: number, r: number) => (
    <div style={{ display: 'flex', position: 'absolute', left: 0, top: 0, width, height, background: `radial-gradient(circle ${r}px at ${x} -8%, rgba(${rgb},${a}) 0%, rgba(${rgb},0) 70%)` }} />
  )
  const image = new ImageResponse(
    (
      <div style={{ ...col, position: 'relative', width, height, background: C.bg, color: C.ink, fontFamily: F.sans }}>
        {glow('22%', '0,253,255', 0.07, 900)}
        {glow('78%', '74,111,216', 0.13, 800)}
        <div style={{ ...col, position: 'absolute', left: 0, top: 0, width, height, padding: `${compact ? 40 : pad - 8}px ${pad}px ${pad - 16}px`, gap: compact ? 20 : 28 }}>
          <div style={{ ...col, gap: compact ? 12 : 16, flexShrink: 0 }}>
            <div style={{ ...row, gap: 12 }}>
              <div style={{ display: 'flex', width: 12, height: 12, background: C.gold }} />
              <Label color={C.ink} size={16} weight={700}>{eyebrow ?? BRAND}</Label>
              <div style={{ display: 'flex', flex: 1, height: 1, background: C.line }} />
              {aside ? <Label size={16}>{aside}</Label> : null}
            </div>
            <div style={{ display: 'flex', fontFamily: F.display, fontSize: compact ? 60 : wide ? 76 : 68, lineHeight: 1, textTransform: 'uppercase' }}>{title}</div>
            <div style={{ ...row, gap: 10, flexWrap: 'wrap' }}>
              <Chip color={C.cyan} edge={C.cyan}>{subtitle}</Chip>
              {chips.map((c) => <Chip key={c}>{c}</Chip>)}
            </div>
          </div>
          {/* No `overflow: hidden` here: Satori ignores a descendant's `clipPath` (the donut's wedges) under a clipping ancestor. */}
          <div style={{ ...col, flex: 1, minHeight: 0 }}>{body}</div>
          <div style={{ ...row, justifyContent: 'space-between', gap: 24, flexShrink: 0 }}>
            <div style={{ ...row, gap: 16 }}>
              {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
              {logo ? <img src={logo} width={48} height={48} style={{ width: 48, height: 48 }} /> : null}
              <div style={{ display: 'flex', fontFamily: F.brand, fontSize: 22, letterSpacing: 0.9, color: C.ink }}>{BRAND}</div>
              <div style={{ display: 'flex', width: 1, height: 28, background: C.lineMid }} />
              <div style={{ display: 'flex', fontFamily: F.mono, fontSize: 19, letterSpacing: 1.4, color: C.cyan }}>{SITE}</div>
            </div>
            <div style={{ display: 'flex', ...mono, fontSize: 15, color: C.muted }}>{footer}</div>
          </div>
        </div>
        {/* The spine: a box as long as the image, turned on its side along the right edge. */}
        <div style={{ display: 'flex', position: 'absolute', left: width - 26 - height / 2, top: height / 2 - 14, width: height, height: 28, alignItems: 'center', justifyContent: 'center', transform: 'rotate(90deg)', transformOrigin: `${height / 2}px 14px`, ...mono, fontSize: 15, letterSpacing: 4.6, color: C.muted }}>
          {`// ${SITE} · ${BRAND}`}
        </div>
      </div>
    ),
    { width, height, fonts: faces.length ? faces : undefined },
  )
  image.headers.set('cache-control', cache)
  // `ImageResponse` draws behind its stream: waited for here, or `oneAtATime` lets go before the render starts.
  return new Response(await image.arrayBuffer(), { headers: image.headers })
}
