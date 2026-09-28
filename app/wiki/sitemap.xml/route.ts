import { API_URL } from '@utils/auth'

/** The API caches it for an hour too (WIKI_API §8). */
export const revalidate = 3600

/**
 * The wiki sitemap, served from the front's own host: its `<loc>`s are front URLs, and a sitemap has to
 * live on the host it lists. The API decides what's in it — published, indexable, self-canonical only.
 */
export async function GET() {
  const res = await fetch(`${API_URL}/wiki/sitemap.xml`, { next: { revalidate } }).catch(() => null)
  if (!res?.ok) return new Response('Wiki sitemap unavailable', { status: 502 })
  return new Response(await res.text(), {
    headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  })
}
