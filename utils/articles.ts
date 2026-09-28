/**
 * Wiki articles on omega-server-v3 (see its WIKI_API.md).
 * Reads work anonymously, but an editor's session is what makes drafts visible, so every read
 * forwards credentials — on the server, pass the incoming `cookie` header.
 * Writes need a session and the right `Origin`, so they only run in the browser.
 */
import { API_URL, type AuthUser, type Permission } from '@utils/auth'
import type {
  Article,
  ArticleDraft,
  ArticleIndex,
  ArticlePatch,
  DocArticleDraft,
  DocArticlePatch,
  Revision,
  RevisionDetail,
  WikiEditor,
  WikiUser,
} from '@utils/types'
import type { WikiAsset } from '@utils/wiki-doc'

export class WikiApiError extends Error {
  status: number
  /** Stable code (`FORBIDDEN`, `CONFLICT`, `UNAUTHENTICATED`, ...). Branch on this, never on `message`. */
  code?: string

  constructor(status: number, code?: string, message?: string) {
    super(message ?? `Wiki API failed with ${status}`)
    this.status = status
    this.code = code
  }
}

/** Editor responses carry drafts, so nothing here may land in a shared cache. */
const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(`${API_URL}${path}`, { credentials: 'include', cache: 'no-store', ...init })
  if (res.status === 204) return undefined as T
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new WikiApiError(res.status, body.error, body.message)
  }
  return res.json()
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
})

const withCookie = (cookie?: string | null) => (cookie ? { headers: { cookie } } : undefined)

const search = (query: Record<string, string | number | undefined>) => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

/** Permissions come from `GET /auth/me`; the server revalidates every route anyway. */
export const can = (user: AuthUser | null | undefined, permission: Permission) =>
  !!user?.permissions.includes(permission)

/**
 * An editor may delete only their own article. `wiki.delete` (admin) lifts that.
 * Mirror it in the UI so the button isn't there to be refused.
 */
export const canDelete = (user: AuthUser | null | undefined, authorId: string) =>
  can(user, 'wiki.delete') || (can(user, 'wiki.write') && user?.id === authorId)

export type ArticleQuery = {
  search?: string
  author?: string
  /** Only honoured for a viewer with `wiki.write`; for anyone else drafts don't exist. */
  status?: 'draft' | 'published'
  /** `published` orders drafts by creation. Defaults to `published` / `desc`. */
  sort?: 'published' | 'updated'
  order?: 'asc' | 'desc'
  /** `YYYY-MM-DD`, both inclusive, on the same date the list is sorted by. */
  from?: string
  to?: string
  cursor?: string
  limit?: number
}

/** Newest published first by default. Drafts appear only for a viewer with `wiki.write`. */
export const listArticles = (query: ArticleQuery = {}, cookie?: string | null, signal?: AbortSignal) =>
  request<ArticleIndex>(`/wiki${search(query)}`, { ...withCookie(cookie), signal })

/** Everyone with at least one article this viewer can see: the index's author filter. */
export const listAuthors = async (cookie?: string | null) =>
  (await request<{ authors: WikiUser[] }>('/wiki/authors', withCookie(cookie))).authors

/** `null` for an unknown or malformed slug, and for a draft this viewer may not see. */
export const getArticle = async (slug: string, cookie?: string | null): Promise<Article | null> => {
  try {
    return await request<Article>(`/wiki/${encodeURIComponent(slug)}`, withCookie(cookie))
  } catch (error) {
    if (error instanceof WikiApiError && error.status === 404) return null
    throw error
  }
}

/**
 * Whether an address is free (WIKI_API §4.2): `404` free, `200` taken, `301` a former address of another
 * article — taking it over is allowed but moves the old links here. The 301 is read without following it:
 * a browser reports a manual redirect as an opaque response.
 */
export const checkSlug = async (slug: string, signal?: AbortSignal): Promise<'free' | 'taken' | 'moved'> => {
  const res = await fetch(`${API_URL}/wiki/${encodeURIComponent(slug)}`, {
    credentials: 'include',
    cache: 'no-store',
    redirect: 'manual',
    signal,
  })
  if (res.type === 'opaqueredirect' || res.status === 301) return 'moved'
  if (res.status === 404) return 'free'
  if (res.ok) return 'taken'
  throw new WikiApiError(res.status)
}

/** Newest first, at most 50, no pagination. Deleting an article deletes its history with it. */
export const getRevisions = async (slug: string, cookie?: string | null): Promise<Revision[]> => {
  const { revisions } = await request<{ revisions: Revision[] }>(
    `/wiki/${encodeURIComponent(slug)}/revisions`,
    withCookie(cookie),
  )
  return revisions
}

/** `null` when the revision doesn't exist **or** belongs to another article. */
export const getRevision = async (slug: string, id: string, cookie?: string | null): Promise<RevisionDetail | null> => {
  try {
    return await request<RevisionDetail>(
      `/wiki/${encodeURIComponent(slug)}/revisions/${encodeURIComponent(id)}`,
      withCookie(cookie),
    )
  } catch (error) {
    if (error instanceof WikiApiError && error.status === 404) return null
    throw error
  }
}

/** A restore is a normal edit: the old text comes back as a new revision, and publication is untouched. */
export const restoreRevision = (slug: string, id: string) =>
  request<Article>(`/wiki/${encodeURIComponent(slug)}/revisions/${encodeURIComponent(id)}/restore`, json('POST'))

/** `409 CONFLICT` means the slug is taken — ask for another, the server never appends a number. */
export const createArticle = (draft: ArticleDraft | DocArticleDraft) => request<Article>('/wiki', json('POST', draft))

export const updateArticle = (slug: string, patch: ArticlePatch | DocArticlePatch) =>
  request<Article>(`/wiki/${encodeURIComponent(slug)}`, json('PATCH', patch))

/**
 * One image into the wiki's storage (WIKI_API.md §4.12–4.13), the same way profile covers go:
 * the API signs, the browser uploads straight to Cloudinary, and the API only accepts the result
 * after asking Cloudinary itself that it exists and passed moderation. The returned asset carries
 * Cloudinary's own width and height.
 */
export const uploadWikiAsset = async (file: File, alt: string) => {
  const { uploadUrl, fields } = await request<{ uploadUrl: string; fields: Record<string, string | number> }>(
    '/wiki/assets/sign',
    json('POST'),
  )

  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.set(key, String(value))
  form.set('file', file)
  const res = await fetch(uploadUrl, { method: 'POST', body: form })
  if (!res.ok) throw new WikiApiError(res.status, 'UPLOAD_FAILED')
  const { public_id: publicId } = (await res.json()) as { public_id: string }

  return request<WikiAsset>('/wiki/assets', json('POST', { publicId, alt }))
}

export const deleteArticle = (slug: string) => request<void>(`/wiki/${encodeURIComponent(slug)}`, json('DELETE'))

/** Admins are listed alongside editors, so the panel doesn't pretend they can't write. */
export const listEditors = async (cookie?: string | null) =>
  (await request<{ editors: WikiEditor[] }>('/wiki/editors', withCookie(cookie))).editors

/** `404` means the duelist has never signed in: promotion never creates a row. */
export const promoteEditor = (userId: string) =>
  request<WikiEditor>(`/wiki/editors/${encodeURIComponent(userId)}`, json('PUT'))

/** Their articles stay; they simply can no longer write. */
export const demoteEditor = (userId: string) =>
  request<void>(`/wiki/editors/${encodeURIComponent(userId)}`, json('DELETE'))
