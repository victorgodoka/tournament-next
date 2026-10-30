import Image from 'next/image'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'
import { LocalTime } from '@omega/profile/local-time'
import { Chip } from '@ui/chip'
import { Icon } from '@ui/icon'
import type { ArticleSummary, WikiUser } from '@utils/types'
import { imageSource } from '@utils/wiki-doc'

export const ARTICLE_DATE: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }

export const ARTICLE_DATE_TIME: Intl.DateTimeFormatOptions = {
  ...ARTICLE_DATE,
  hour: '2-digit',
  minute: '2-digit',
}

export const COMPACT = new Intl.NumberFormat('en', { notation: 'compact' })

/** What a byline needs of a duelist: a `WikiUser`, or a deck comment's author (no cosmetics). */
export type BylineUser = Pick<WikiUser, 'id' | 'username' | 'avatarUrl'>

/** `username` is `null` for a duelist the wiki has no Discord data for. */
export const userName = (user: BylineUser | null | undefined) => user?.username ?? 'Unknown duelist'

/** Draft or live. A draft is invisible to anyone without `wiki.write`, so the chip explains why it renders. */
export const StatusChip = ({ publishedAt }: { publishedAt: string | null }) =>
  publishedAt ? (
    <Chip tone="neutral">Published</Chip>
  ) : (
    <Chip tone="gold" dot>
      Draft
    </Chip>
  )

export const Byline = ({ user, size = 20, className }: { user: BylineUser | null; size?: number; className?: string }) => (
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

const CardStat = ({ icon, count, label }: { icon: 'eye' | 'heartOutline' | 'comment'; count: number; label: string }) => (
  <span className="inline-flex items-center gap-1.5">
    <Icon name={icon} />
    {COMPACT.format(count)}
    <span className="sr-only">{label}</span>
  </span>
)

/**
 * Index card: cover, title, summary, who wrote it, when it last moved, and whether it is live.
 * No cover gets the same box, empty, so a row of cards lines up.
 */
export const ArticleCard = ({ article }: { article: ArticleSummary }) => (
  <li className="flex">
    <Link
      href={`/wiki/${article.slug}`}
      className="flex min-w-0 flex-1 flex-col gap-3 border border-line bg-space-000 p-4.5 hover:border-ink-muted hover:bg-ground-soft"
    >
      {/* Fixed height, cropped from the center; it bleeds over the card's padding to its edges. */}
      <span className="relative -mx-4.5 -mt-4.5 block h-[210px] shrink-0 overflow-hidden border-b border-line bg-surface-200">
        {article.cover ? (
          <Image
            {...imageSource(article.cover, 640)}
            alt=""
            fill
            sizes="(min-width: 1280px) 400px, (min-width: 640px) 50vw, 100vw"
            className="object-cover object-center"
          />
        ) : null}
      </span>
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

      {/* Absent until the API deploy that adds them: hide rather than show zeros. */}
      {article.views === undefined ? null : (
        <span className="flex items-center gap-4 border-t border-line pt-3 text-ink-muted mono-data">
          <CardStat icon="eye" count={article.views} label="views" />
          <CardStat icon="heartOutline" count={article.likes ?? 0} label="likes" />
          <CardStat icon="comment" count={article.commentCount ?? 0} label="comments" />
        </span>
      )}
    </Link>
  </li>
)

/**
 * Article body: React nodes from `renderArticle`, which parsed, classed and sanitized the Markdown.
 * No HTML string reaches the DOM.
 */
export const ArticleBody = ({ html, className }: { html: React.ReactNode; className?: string }) => (
  <div className={twMerge('max-w-[72ch]', className)}>{html}</div>
)
