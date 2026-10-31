'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Icon } from '@ui/icon'
import { twMerge } from 'tailwind-merge'
import { useAuth } from '@contexts/auth/auth.context'
import { buttonClasses } from '@ui/button'
import { countView, likeArticle, socialError, unlikeArticle } from '@utils/articles'
import { setReturnTo } from '@utils/return-to'
import type { ArticleSocial } from '@utils/types'
import { COMPACT } from './article'
import { ShareButtons } from './share-buttons'

type ArticleBarProps = {
  slug: string
  /** The canonical address: what a share points at. */
  url: string
  title: string
  /** `null`: the social API didn't answer; counts and the like hide, sharing stays. */
  social: ArticleSocial | null
}

const STAT = 'inline-flex items-center gap-1.5 text-ink-dim mono-data'

const commentCount = (social: ArticleSocial) =>
  social.comments.reduce((total, thread) => total + (thread.deleted ? 0 : 1) + thread.replies.length, 0)

/** The right end of the article's byline: views, the like, the comment count, then share. */
export const ArticleBar = ({ slug, url, title, social }: ArticleBarProps) => {
  const { user } = useAuth()
  const [like, setLike] = useState({ likes: social?.likes ?? 0, liked: social?.liked ?? false })
  const [pending, setPending] = useState(false)
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

  const likeLabel = (
    <>
      <Icon name={like.liked ? 'heart' : 'heartOutline'} className={twMerge(like.liked && 'text-crimson-lift')} />
      <span className="mono-data">{COMPACT.format(like.likes)}</span>
    </>
  )

  return (
    <div className="flex flex-1 flex-wrap items-center justify-end gap-x-5 gap-y-3 max-sm:justify-between">
      {social ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className={STAT}>
            <Icon name="eye" />
            {COMPACT.format(social.views)}
            <span className="sr-only">{social.views === 1 ? 'view' : 'views'}</span>
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
            <Icon name="comment" />
            {commentCount(social)}
            <span className="sr-only">{commentCount(social) === 1 ? 'comment' : 'comments'}</span>
          </a>
        </div>
      ) : null}

      <ShareButtons url={url} title={title} />

      {/* Never display:none: a live region that appears with its text isn't announced. */}
      <p aria-live="polite" className="basis-full text-right text-cyan signal-sm empty:hidden">
        {error}
      </p>
    </div>
  )
}
