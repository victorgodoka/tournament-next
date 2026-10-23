/**
 * Shared pieces of the statistics infographics (`/statistics/infographic/*`, `/profile/:id/statistics/infographic/*`):
 * a PNG drawn by `next/og` (Satori), 1920×1080 (`?size=wide`) or 1080×1920 (`?size=tall`).
 *
 * Satori lays out flexbox only: every element with more than one child needs `display: flex`.
 * ponytail: Geist (bundled with next/og) for everything; load Anton/Figtree TTFs if the brand fonts matter.
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { createTranslator } from 'next-intl'
import type { CSSProperties, ReactNode } from 'react'
import { CARD_ART_URL, CARD_IMAGE_URL } from '@utils/const'
import { SITE_NAME, SITE_URL } from '@utils/config'
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
  win: '#4fdc8c',
  loss: '#ff8594',
  series: ['#00a6b5', '#e14660', '#337bd0', '#c0851f', '#8169dd', '#36a558'],
  tier: { 1: '#5fa8ff', 2: '#5fd4c4', 3: '#c3cbd8', 4: '#efd17e' } as Record<number, string>,
}

export const SIZES = { wide: { width: 1920, height: 1080 }, tall: { width: 1080, height: 1920 } } as const
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

export const toDataUri = async (url: string): Promise<string | null> => {
  try {
    // A day in the data cache: art never changes, and the origin takes seconds per file.
    const res = await fetch(url, { next: { revalidate: 86_400 }, signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    return `data:${res.headers.get('content-type') ?? 'image/jpeg'};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`
  } catch {
    return null
  }
}

/** Card art (`'art'`) or the full card (`'card'`) as data URIs, fetched in parallel. A miss is left out, never a failed render. */
export const loadImages = async (ids: (number | null | undefined)[], kind: 'art' | 'card' = 'art') => {
  const unique = [...new Set(ids.filter((id): id is number => id != null))]
  const uris = await Promise.all(unique.map((id) => toDataUri(kind === 'art' ? CARD_ART_URL(id) : CARD_IMAGE_URL(id))))
  return new Map(unique.flatMap((id, i) => (uris[i] ? [[id, uris[i]] as const] : [])))
}

let mark: Promise<string | null> | null = null
const markUri = () =>
  (mark ??= readFile(join(process.cwd(), 'public', 'omega-mark.png'))
    .then((b) => `data:image/png;base64,${b.toString('base64')}`)
    .catch(() => null))

/** A square of card art; a plain tile when the art didn't load. */
export const Art = ({ src, size, radius = 0 }: { src?: string; size: number; radius?: number }) =>
  src ? (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img src={src} width={size} height={size} style={{ width: size, height: size, objectFit: 'cover', borderRadius: radius, border: `2px solid ${C.line}` }} />
  ) : (
    <div style={{ display: 'flex', width: size, height: size, borderRadius: radius, background: C.surface2, border: `2px solid ${C.line}` }} />
  )

export const Label = ({ children, color = C.muted, size = 22 }: { children: ReactNode; color?: string; size?: number }) => (
  <div style={{ display: 'flex', fontSize: size, color, letterSpacing: 2, textTransform: 'uppercase' }}>{children}</div>
)

export const Kpi = ({ label, value, color = C.ink, size = 72 }: { label: string; value: string; color?: string; size?: number }) => (
  <div style={{ ...col, flex: 1, flexShrink: 0, gap: 6, padding: '24px 28px', background: C.surface, border: `2px solid ${C.line}` }}>
    <Label>{label}</Label>
    <div style={{ display: 'flex', fontSize: size, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
  </div>
)

/** A horizontal bar on a track; `value` 0..1 of the track. */
export const Bar = ({ value, color = C.cyan, height = 14 }: { value: number; color?: string; height?: number }) => (
  <div style={{ display: 'flex', flex: 1, height, background: C.surface2 }}>
    <div style={{ display: 'flex', width: `${Math.max(0, Math.min(1, value)) * 100}%`, height, background: color }} />
  </div>
)

export const Panel = ({ title, children, style }: { title?: string; children: ReactNode; style?: CSSProperties }) => (
  <div style={{ ...col, flexShrink: 0, gap: 20, padding: 32, background: C.surface, border: `2px solid ${C.line}`, ...style }}>
    {title ? <Label color={C.cyan}>{title}</Label> : null}
    {children}
  </div>
)

export const Empty = ({ children }: { children: ReactNode }) => (
  <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', fontSize: 40, color: C.muted }}>{children}</div>
)

/** Brand head, title and subtitle, the body, and the source line. */
export const render = async ({ size, title, subtitle, footer, body, cache }: {
  size: Size
  title: string
  subtitle: string
  footer: string
  body: ReactNode
  /** `Cache-Control` of the PNG. */
  cache: string
}) => {
  const { width, height } = SIZES[size]
  const pad = size === 'wide' ? 72 : 64
  const logo = await markUri()
  const image = new ImageResponse(
    (
      <div style={{ ...col, width, height, padding: pad, gap: 40, background: `linear-gradient(160deg, ${C.surface2} 0%, ${C.bg} 55%)`, color: C.ink, fontFamily: 'Geist' }}>
        <div style={{ ...row, justifyContent: 'space-between', gap: 32 }}>
          <div style={{ ...col, gap: 10, flex: 1 }}>
            <div style={{ ...row, gap: 16 }}>
              {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
              {logo ? <img src={logo} width={44} height={44} style={{ width: 44, height: 44 }} /> : null}
              <Label color={C.cyan} size={26}>{SITE_NAME}</Label>
            </div>
            <div style={{ display: 'flex', fontSize: size === 'wide' ? 84 : 72, fontWeight: 700, lineHeight: 1.05, textTransform: 'uppercase' }}>{title}</div>
            <div style={{ display: 'flex', fontSize: 32, color: C.dim }}>{subtitle}</div>
          </div>
        </div>
        <div style={{ ...col, flex: 1, minHeight: 0, overflow: 'hidden' }}>{body}</div>
        <div style={{ ...row, justifyContent: 'space-between', fontSize: 24, color: C.muted, borderTop: `2px solid ${C.line}`, paddingTop: 24 }}>
          <div style={{ display: 'flex' }}>{footer}</div>
          <div style={{ display: 'flex', color: C.cyan }}>{SITE_URL.replace(/^https?:\/\//, '')}</div>
        </div>
      </div>
    ),
    { width, height },
  )
  image.headers.set('cache-control', cache)
  return image
}
