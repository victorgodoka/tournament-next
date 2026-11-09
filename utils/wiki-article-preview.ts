import { API_URL } from './auth'
import { isWikiUpload, type WikiAsset } from './wiki-doc'

export type WikiArticlePreview = { slug: string; title: string; summary: string; cover?: WikiAsset }
export const isArticleSlug = (slug: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 80

const pending = new Map<string, Promise<WikiArticlePreview | null>>()
const safeCover = (asset: WikiAsset | undefined | null) => asset && typeof asset.src === 'string' && (
  /^\/(?![/\\])[^?#]*\.(?:png|jpe?g|webp|avif|gif)$/i.test(asset.src) ||
  asset.src.startsWith('https://ygopro.online/assets/card-arts/') ||
  isWikiUpload(asset.src)
) && Number.isInteger(asset.width) && asset.width > 0 && Number.isInteger(asset.height) && asset.height > 0 ? asset : undefined

/** Anonymous metadata of published articles only: no editor session reaches the request, so no draft enters a shared cache. */
export const loadArticlePreview = (slug: string): Promise<WikiArticlePreview | null> => {
  if (!isArticleSlug(slug)) return Promise.resolve(null)
  const running = pending.get(slug)
  if (running) return running
  const request = (async () => {
    try {
      // The editor reads fresh. The server keeps a published preview for 5 minutes, so most page views cost no API read
      // per preview; an unpublished article drops out within that window.
      const freshness: RequestInit = typeof window === 'undefined' ? { next: { revalidate: 300 } } : { cache: 'no-store' }
      const response = await fetch(`${API_URL}/wiki/${encodeURIComponent(slug)}`, { credentials: 'omit', ...freshness, signal: AbortSignal.timeout(3000) })
      if (!response.ok) return null
      const article = await response.json()
      if (!article.publishedAt || typeof article.title !== 'string' || !isArticleSlug(article.slug)) return null
      return {
        slug: article.slug, title: article.title.slice(0, 120), summary: typeof article.summary === 'string' ? article.summary.slice(0, 300) : '',
        cover: safeCover(article.cover ?? (article.doc?.cover ? article.doc.assets?.[article.doc.cover.asset] : undefined)),
      }
    } catch { return null }
  })().then((value) => {
    // Only coalesce simultaneous reads: unpublishing must hide a preview on the next page read.
    pending.delete(slug)
    return value
  })
  pending.set(slug, request)
  return request
}
