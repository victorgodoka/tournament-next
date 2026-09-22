import Image from 'next/image'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'
import { LocalTime } from '@omega/profile/local-time'
import { Chip } from '@ui/chip'
import type { ArticleSummary, WikiUser } from '@utils/types'

export const ARTICLE_DATE: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }

export const ARTICLE_DATE_TIME: Intl.DateTimeFormatOptions = {
  ...ARTICLE_DATE,
  hour: '2-digit',
  minute: '2-digit',
}

/** `username` is `null` for a duelist the wiki has no Discord data for. */
export const userName = (user: WikiUser | null | undefined) => user?.username ?? 'Unknown duelist'

/** Draft or live. A draft is invisible to anyone without `wiki.write`, so the chip explains why it renders. */
export const StatusChip = ({ publishedAt }: { publishedAt: string | null }) =>
  publishedAt ? (
    <Chip tone="neutral">Published</Chip>
  ) : (
    <Chip tone="gold" dot>
      Draft
    </Chip>
  )

export const Byline = ({ user, size = 20, className }: { user: WikiUser | null; size?: number; className?: string }) => (
  <span className={twMerge('inline-flex min-w-0 items-center gap-2', className)}>
    {user?.avatarUrl ? (
      <Image
        src={user.avatarUrl}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="shrink-0 border border-line object-cover"
      />
    ) : (
      <span
        aria-hidden
        style={{ width: size, height: size }}
        className="inline-flex shrink-0 items-center justify-center border border-line bg-surface-200 text-ink-dim signal-chip"
      >
        {user?.username ? user.username.slice(0, 1).toUpperCase() : '?'}
      </span>
    )}
    <span className="truncate">{userName(user)}</span>
  </span>
)

/** Index row: title, who wrote it, when it last moved, and whether it is live. */
export const ArticleRow = ({ article }: { article: ArticleSummary }) => (
  <li>
    <Link
      href={`/wiki/${article.slug}`}
      className="grid grid-cols-1 gap-2.5 border-b border-line py-4 hover:bg-ground-soft lg:grid-cols-[minmax(0,1fr)_200px_150px_110px] lg:items-center lg:gap-4"
    >
      <span className="min-w-0">
        <span className="block truncate text-ink body-strong">{article.title}</span>
        <span className="mt-1 block truncate text-ink-muted signal-sm">/{article.slug}</span>
      </span>

      <Byline user={article.author} className="text-ink-dim body-sm" />

      <span className="text-ink-muted mono-data">
        <LocalTime iso={article.updatedAt} options={ARTICLE_DATE} />
      </span>

      <StatusChip publishedAt={article.publishedAt} />
    </Link>
  </li>
)

/**
 * Article body. The Markdown was parsed, classed and sanitized on the server
 * (`renderArticle`), which is what makes this HTML safe to hand to the DOM.
 */
export const ArticleBody = ({ html, className }: { html: string; className?: string }) => (
  <div className={twMerge('max-w-[72ch]', className)} dangerouslySetInnerHTML={{ __html: html }} />
)
