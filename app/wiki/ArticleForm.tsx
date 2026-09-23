'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { twMerge } from 'tailwind-merge'
import { buttonClasses } from '@ui/button'
import { WikiApiError, createArticle, updateArticle } from '@utils/articles'
import type { Article, ArticlePatch } from '@utils/types'

/** The server's own limits (WIKI_API §4.6), checked here only to fail fast with a readable message. */
export const TITLE_MAX = 120
export const BODY_MAX = 100_000

/** The server rejects raw HTML instead of stripping it, so the writer learns it isn't allowed. */
const RAW_HTML = /<[a-zA-Z/!]/

export const FIELD =
  'w-full border border-surface-400 bg-surface-200 px-3 py-2.5 text-ink body-sm placeholder:text-ink-muted hover:border-ink-muted focus-visible:border-cyan'

export const LABEL = 'block text-ink-muted signal-sm'

export const HELP = 'mt-1.5 text-ink-muted mono-note'

/** `message` is written for developers, so every failure maps to copy an editor can act on. */
export const failure = (error: unknown) => {
  if (!(error instanceof WikiApiError)) return "Couldn't reach the wiki. Try again."
  if (error.status === 409) return 'That address is already taken. Choose a different one.'
  if (error.status === 401) return 'Your session expired. Sign in again.'
  if (error.status === 403) return "Your account can't do that."
  if (error.status === 422) return 'Moderation rejected that image (or has not approved it yet).'
  if (error.status === 503) return "Image uploads aren't available on this server."
  // Doc validation names the path, e.g. `doc.blocks[3].md must not contain raw HTML`.
  if (error.status === 400) {
    return error.message.startsWith('Wiki API failed')
      ? 'The server rejected this. Raw HTML is not allowed, and every link must be a full http(s) address.'
      : `The server rejected this: ${error.message}`
  }
  return "Couldn't save the article."
}

type ArticleFormProps = {
  /** Absent on create. */
  article?: Article
}

/** Write and edit. Publication lives with the article's own controls, except on the first save. */
export const ArticleForm = ({ article }: ArticleFormProps) => {
  const router = useRouter()
  const [title, setTitle] = useState(article?.title ?? '')
  const [slug, setSlug] = useState(article?.slug ?? '')
  const [body, setBody] = useState(article?.body ?? '')
  const [status, setStatus] = useState<'idle' | 'saving'>('idle')
  const [error, setError] = useState<string | null>(null)

  const local = () => {
    if (!title.trim()) return 'Give the article a title.'
    if (title.trim().length > TITLE_MAX) return `Keep the title under ${TITLE_MAX} characters.`
    if (!body.trim()) return 'The article has no body yet.'
    if (body.length > BODY_MAX) return `The body is over ${BODY_MAX.toLocaleString('en-US')} characters.`
    if (RAW_HTML.test(body)) return 'Raw HTML is not allowed in the body. Use Markdown.'
    return null
  }

  const save = async (published?: boolean) => {
    const problem = local()
    if (problem) return setError(problem)

    setStatus('saving')
    setError(null)
    try {
      if (article) {
        // Only changed keys: an absent key leaves the column alone, and a new title never moves the URL.
        const patch: ArticlePatch = {}
        if (title !== article.title) patch.title = title.trim()
        if (body !== article.body) patch.body = body
        if (slug !== article.slug) patch.slug = slug.trim()
        if (!Object.keys(patch).length) return router.push(`/wiki/${article.slug}`)

        const saved = await updateArticle(article.slug, patch)
        router.push(`/wiki/${saved.slug}`)
      } else {
        const saved = await createArticle({
          title: title.trim(),
          body,
          slug: slug.trim() || undefined,
          published,
        })
        router.push(`/wiki/${saved.slug}`)
      }
      router.refresh()
    } catch (cause) {
      console.error(cause)
      setError(failure(cause))
      setStatus('idle')
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void save(false)
      }}
      className="max-w-[80ch]"
    >
      <div>
        <label htmlFor="article-title" className={LABEL}>
          Title
        </label>
        <input
          id="article-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={TITLE_MAX}
          required
          className={twMerge(FIELD, 'mt-2')}
        />
        <p className={HELP}>
          {title.trim().length}/{TITLE_MAX}
        </p>
      </div>

      <div className="mt-5">
        <label htmlFor="article-slug" className={LABEL}>
          Address
        </label>
        <input
          id="article-slug"
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
          maxLength={80}
          placeholder={article ? undefined : 'derived from the title'}
          className={twMerge(FIELD, 'mt-2')}
        />
        <p className={HELP}>
          /wiki/{slug.trim() || '…'} · lowercase words joined by hyphens.
          {article ? ' Changing this breaks every existing link to the article.' : ''}
        </p>
      </div>

      <div className="mt-5">
        <label htmlFor="article-body" className={LABEL}>
          Body (Markdown)
        </label>
        <textarea
          id="article-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={22}
          required
          className={twMerge(FIELD, 'mt-2 resize-y font-mono')}
        />
        <p className={HELP}>
          {body.length.toLocaleString('en-US')}/{BODY_MAX.toLocaleString('en-US')} · no raw HTML, and links must be
          full http(s) addresses.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={status === 'saving'} className={buttonClasses({ variant: 'primary', size: 'sm' })}>
          {status === 'saving' ? 'Saving…' : article ? 'Save changes' : 'Save draft'}
        </button>

        {article ? null : (
          <button
            type="button"
            onClick={() => void save(true)}
            disabled={status === 'saving'}
            className={buttonClasses({ variant: 'secondary', size: 'sm' })}
          >
            Save and publish
          </button>
        )}

        <Link href={article ? `/wiki/${article.slug}` : '/wiki'} className={buttonClasses({ variant: 'ghost', size: 'sm' })}>
          Cancel
        </Link>
      </div>

      <p aria-live="polite" role={error ? 'alert' : undefined} className="mt-3.5 text-gold body-sm">
        {error ?? ''}
      </p>
    </form>
  )
}
