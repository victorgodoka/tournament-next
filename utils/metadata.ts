import type { Metadata } from 'next'
import { OG_IMAGE, SITE_DESCRIPTION, SITE_NAME } from '@utils/config'

export type PageMetadataOptions = {
  title: string
  path: string
  description?: string
  noIndex?: boolean
  absoluteTitle?: boolean
  images?: NonNullable<Metadata['openGraph']>['images']
}

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
      type: 'website',
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
