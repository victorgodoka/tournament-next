'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { Icon } from '@iconify/react'
import { twMerge } from 'tailwind-merge'
import { useAuth } from '@contexts/auth/auth.context'
import { buttonClasses } from '@ui/button'
import { countView, likeArticle, socialError, unlikeArticle } from '@utils/articles'
import { setReturnTo } from '@utils/return-to'
import type { ArticleSocial } from '@utils/types'
import { shareLinks } from './share'

type ArticleBarProps = {
  slug: string
  /** The canonical address: what a share points at. */
  url: string
  title: string
  /** `null`: the social API didn't answer; counts and the like hide, sharing stays. */
  social: ArticleSocial | null
}

const COMPACT = new Intl.NumberFormat('en', { notation: 'compact' })
const STAT = 'inline-flex items-center gap-1.5 text-ink-dim mono-data'
const ICON_BUTTON = buttonClasses({ variant: 'secondary', size: 'icon' })

const noSubscribe = () => () => {}
/** The native share sheet exists on phones and some desktops; read after hydration, never during it. */
const useCanShare = () => useSyncExternalStore(noSubscribe, () => typeof navigator.share === 'function', () => false)

const commentCount = (social: ArticleSocial) =>
  social.comments.reduce((total, thread) => total + (thread.deleted ? 0 : 1) + thread.replies.length, 0)

/** Under the article header: views, the like, the comment count, then share. */
export const ArticleBar = ({ slug, url, title, social }: ArticleBarProps) => {
  const { user } = useAuth()
  const canShare = useCanShare()
  const [like, setLike] = useState({ likes: social?.likes ?? 0, liked: social?.liked ?? false })
  const [pending, setPending] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Counted once a day per reader by the API; a dev double-mount is deduplicated there too.
  useEffect(() => {
    countView(slug)
  }, [slug])

  const toggleLike = async () => {
    const before = like
    setPending(true)
    setError(null)
    try {
      setLike(await (before.liked ? unlikeArticle(slug) : likeArticle(slug)))
    } catch (cause) {
      console.error(cause)
      setLike(before)
      setError(socialError(cause))
    } finally {
      setPending(false)
    }
  }

  const copy = () =>
    navigator.clipboard.writeText(url).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      },
      () => setError("Couldn't copy the link."),
    )

  const likeLabel = (
    <>
      <Icon icon={like.liked ? 'mdi:heart' : 'mdi:heart-outline'} aria-hidden className={twMerge('text-lg', like.liked && 'text-crimson-lift')} />
      <span className="mono-data">{COMPACT.format(like.likes)}</span>
    </>
  )

  return (
    <div className="mb-8 border-b border-line pb-5">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {social ? (
            <>
              <span className={STAT}>
                <Icon icon="mdi:eye-outline" aria-hidden className="text-lg" />
                {COMPACT.format(social.views)} {social.views === 1 ? 'view' : 'views'}
              </span>

              {user === null ? (
                <Link
                  href="/login"
                  onClick={() => setReturnTo(location.pathname)}
                  aria-label={`Sign in to like this article (${like.likes} likes)`}
                  className={buttonClasses({ variant: 'secondary', size: 'sm' })}
                >
                  {likeLabel}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={toggleLike}
                  disabled={pending || user === undefined}
                  aria-pressed={like.liked}
                  aria-label={`Like this article (${like.likes} likes)`}
                  className={buttonClasses({ variant: 'secondary', size: 'sm' })}
                >
                  {likeLabel}
                </button>
              )}

              <a href="#comments" className={twMerge(STAT, 'hover:text-cyan')}>
                <Icon icon="mdi:comment-outline" aria-hidden className="text-lg" />
                {commentCount(social)} {commentCount(social) === 1 ? 'comment' : 'comments'}
              </a>
            </>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-ink-muted signal-sm">Share</span>
          {shareLinks(url, title).map((link) => (
            <a
              key={link.id}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Share on ${link.label}`}
              title={`Share on ${link.label}`}
              className={ICON_BUTTON}
            >
              <Icon icon={link.icon} aria-hidden className="text-lg" />
            </a>
          ))}
          <button type="button" onClick={copy} aria-label="Copy link" title="Copy link" className={ICON_BUTTON}>
            <Icon icon={copied ? 'mdi:check' : 'mdi:link-variant'} aria-hidden className="text-lg" />
          </button>
          {canShare ? (
            <button
              type="button"
              onClick={() => navigator.share({ title, url }).catch(() => {})}
              aria-label="Share…"
              title="Share…"
              className={ICON_BUTTON}
            >
              <Icon icon="mdi:share-variant" aria-hidden className="text-lg" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Never display:none: a live region that appears with its text isn't announced. */}
      <p aria-live="polite" className="text-cyan signal-sm not-empty:mt-2">
        {error ?? (copied ? 'Link copied.' : '')}
      </p>
    </div>
  )
}
