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

/** Index card: title, summary, who wrote it, when it last moved, and whether it is live. */
export const ArticleCard = ({ article }: { article: ArticleSummary }) => (
  <li className="flex">
    <Link
      href={`/wiki/${article.slug}`}
      className="flex min-w-0 flex-1 flex-col gap-3 border border-line bg-surface-000 p-4.5 hover:border-ink-muted hover:bg-ground-soft"
    >
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0 text-ink body-strong">{article.title}</span>
        {article.publishedAt ? null : <StatusChip publishedAt={null} />}
      </span>
      {article.summary ? <span className="line-clamp-3 text-ink-dim body-sm">{article.summary}</span> : null}

      <span className="mt-auto flex items-center justify-between gap-3 pt-2">
        <Byline user={article.author} className="text-ink-dim body-sm" />
        <span className="shrink-0 text-ink-muted mono-data">
          <LocalTime iso={article.publishedAt ?? article.updatedAt} options={ARTICLE_DATE} />
        </span>
      </span>
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
