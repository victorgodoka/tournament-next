import type { Metadata } from 'next'
import { OG_IMAGE, SITE_DESCRIPTION, SITE_NAME } from '@utils/config'

export type PageMetadataOptions = {
  title: string
  path: string
  description?: string
  noIndex?: boolean
  absoluteTitle?: boolean
  images?: NonNullable<Metadata['openGraph']>['images']
  /** Makes it an `og:type=article`, with its dates and author. */
  article?: { publishedTime?: string; modifiedTime?: string; authors?: string[] }
}

/** Plain text cut to what a SERP shows, on a word boundary. */
export const metaDescription = (text: string, max = 160) => {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  return `${flat.slice(0, flat.lastIndexOf(' ', max - 1)).replace(/[\s.,;:]+$/, '')}…`
}

/** JSON-LD for a `<script>`. `<` is escaped: titles are user-written and must not close the tag. */
export const jsonLd = (data: object) => ({ __html: JSON.stringify(data).replace(/</g, '\\u003c') })

function normalizePath(path: string): string {
  if (!path || path === '/') return '/'
  return path.startsWith('/') ? path : `/${path}`
}

export function pageMetadata({
  title,
  path,
  description = SITE_DESCRIPTION,
  noIndex = false,
  absoluteTitle = false,
  images,
  article,
}: PageMetadataOptions): Metadata {
  const canonical = normalizePath(path)
  const ogImages = images ?? [OG_IMAGE]
  const robots = noIndex ? { index: false, follow: false } : undefined

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical },
    robots,
    openGraph: {
      ...(article ? { type: 'article' as const, ...article } : { type: 'website' as const }),
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      images: ogImages,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ogImages,
    },
  }
}

export function noIndexMetadata(
  title: string,
  path: string,
  description?: string,
): Metadata {
  return pageMetadata({ title, path, description, noIndex: true })
}
