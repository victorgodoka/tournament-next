import Image, { getImageProps } from 'next/image'
import { twMerge } from 'tailwind-merge'
import { Avatar, Chip, Icon, MediaCard } from '@omega-hub/ds'
import { LocalDay } from '@omega/wiki/local-day'
import type { ArticleSummary, WikiUser } from '@utils/types'
import { topicOf, WIKI_TOPICS, type WikiTopic } from '@utils/wiki-topics'

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
        className="inline-flex shrink-0 items-center justify-center bg-azure text-ink signal-chip"
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

const TOPIC_ICON: Record<WikiTopic, string> = {
  start: 'M11 3h2v9l3.3-3.3 1.4 1.4L12 15.8l-5.7-5.7 1.4-1.4L11 12zM4 18h16v2H4z',
  meta: 'M3 21V3h2v16h16v2zm4-4v-7h3v7zm5 0V6h3v11zm5 0v-5h3v5z',
  formats: 'M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5z',
  support:
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 16h-2v-2h2zm2.1-7.7l-.9.9c-.7.7-1.2 1.3-1.2 2.8h-2v-.5c0-1.1.5-2.1 1.2-2.8l1.2-1.3A2 2 0 1 0 10 8H8a4 4 0 1 1 7.1 2.3z',
}

export const TopicIcon = ({ topic, size = 20 }: { topic: WikiTopic; size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
    <path fillRule="evenodd" d={TOPIC_ICON[topic]} />
  </svg>
)

/** The list the index cards sit in. */
export const ARTICLE_LIST = 'grid gap-3'

/**
 * MediaCard takes one plain URL, so a cover goes through Next's optimizer here instead of shipping the original.
 * `src` is the largest srcset entry: 176 wide resolves to the 640 variant, 400 to the 828 one, 800 to the 1920 one
 * (only for a featured card whose tall row crops deep into the cover).
 */
export const coverUrl = (cover: { src: string } | null | undefined, width: 176 | 400 | 800) =>
  cover ? getImageProps({ src: cover.src, alt: '', width, height: Math.round(width * 0.5625), quality: 75 }).props.src : undefined

/** Who wrote it, when, and its counts: a MediaCard's `meta` row. */
export const ArticleMeta = ({ article }: { article: ArticleSummary }) => (
  <>
    <Avatar name={userName(article.author)} src={article.author.avatarUrl} size="sm" />
    <span className="font-semibold text-ink-dim">{userName(article.author)}</span>
    <span aria-hidden>·</span>
    <LocalDay iso={article.publishedAt ?? article.updatedAt} />
    {/* Absent until the API deploy that adds them: hide rather than show zeros. */}
    {article.views === undefined ? null : (
      <>
        <span aria-hidden>·</span>
        <CardStat icon="eye" count={article.views} label="views" />
        <CardStat icon="heartOutline" count={article.likes ?? 0} label="likes" />
        <CardStat icon="comment" count={article.commentCount ?? 0} label="comments" />
      </>
    )}
  </>
)

type ArticleCardProps = {
  article: ArticleSummary
  /** `row` for one-column lists (index, welcome); `stack` for grids. */
  layout?: 'row' | 'stack'
  size?: 'sm' | 'md' | 'lg'
  ratio?: string
  eager?: boolean
}

/** A wiki post: cover, topic, title, summary, then who and when. A draft says so over its cover. */
export const ArticleCard = ({ article, layout = 'row', size = 'sm', ratio, eager }: ArticleCardProps) => {
  const topic = topicOf(article)
  return (
    <MediaCard
      href={`/wiki/${article.slug}`}
      layout={layout}
      size={size}
      ratio={ratio}
      eager={eager}
      accent="cyan"
      image={coverUrl(article.cover, layout === 'row' ? 176 : 400)}
      badge={article.publishedAt ? undefined : <StatusChip publishedAt={null} />}
      eyebrow={topic ? WIKI_TOPICS[topic].label : undefined}
      title={article.title}
      meta={<ArticleMeta article={article} />}
      className="h-full"
    >
      {article.summary || null}
    </MediaCard>
  )
}

/** The article's own stamp: who wrote it and when it last moved. `children` take the rest of the row. */
export const ArticleByline = ({ user, updatedAt, children }: { user: WikiUser; updatedAt: string; children?: React.ReactNode }) => (
  <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
    <div className="flex flex-col gap-0 sm:flex-row sm:items-center sm:gap-6">
      <Byline user={user} size={28} className="gap-2.5 font-bold text-ink max-sm:text-sm/[18px]" />
      <span className="text-ink-muted signal max-sm:-mt-1 max-sm:pl-[38px] max-sm:font-sans max-sm:text-xs/4 max-sm:font-medium max-sm:tracking-normal max-sm:normal-case">
        Updated <LocalDay iso={updatedAt} />
      </span>
    </div>
    {children}
  </div>
)

/**
 * Article body: React nodes from `renderArticle`, which parsed, classed and sanitized the Markdown.
 * No HTML string reaches the DOM.
 */
export const ArticleBody = ({ html, className }: { html: React.ReactNode; className?: string }) => (
  <div className={twMerge('max-w-[72ch]', className)}>{html}</div>
)
