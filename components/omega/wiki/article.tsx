import Image from 'next/image'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'
import { LocalTime } from '@omega/profile/local-time'
import { LocalDay } from '@omega/wiki/local-day'
import { Chip } from '@ui/chip'
import { Icon } from '@ui/icon'
import type { ArticleSummary, WikiUser } from '@utils/types'
import { imageSource } from '@utils/wiki-doc'
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

/** Index row: cover or topic glyph, topic, title, summary, then who and when. A phone keeps the title and the stamp. */
export const ArticleRow = ({ article }: { article: ArticleSummary }) => {
  const topic = topicOf(article.slug)
  const views = article.views ?? 0
  return (
    <li>
      <Link
        href={`/wiki/${article.slug}`}
        className="grid h-full grid-cols-[72px_minmax(0,1fr)] items-start gap-3.5 bg-surface-100 p-3.5 text-ink-dim transition-colors duration-120 ease-out hover:bg-surface-200 hover:text-ink-dim motion-reduce:transition-none sm:grid-cols-[136px_minmax(0,1fr)] sm:items-center sm:gap-5 sm:p-4"
      >
        <span className="dots relative flex size-18 items-center justify-center overflow-hidden bg-surface-200 text-line-mid sm:h-19 sm:w-34">
          {article.cover ? (
            <Image {...imageSource(article.cover, 320)} alt="" fill sizes="(min-width: 640px) 136px, 72px" className="object-cover" />
          ) : topic ? (
            <TopicIcon topic={topic} size={28} />
          ) : null}
        </span>
        <span className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center justify-between gap-3">
            {topic ? <span className="text-azure-lift signal-sm sm:text-[11px] sm:tracking-[0.14em]">{WIKI_TOPICS[topic].label}</span> : <span />}
            {article.publishedAt ? null : <StatusChip publishedAt={null} />}
          </span>
          <span className="text-[15px]/[21px] font-bold text-ink sm:text-base/[22px]">{article.title}</span>
          {article.summary ? <span className="line-clamp-2 text-[13px]/5 max-sm:hidden">{article.summary}</span> : null}
          <span className="mt-0 flex items-center gap-2 text-ink-muted caption sm:mt-1">
            <Byline user={article.author} size={18} className="max-sm:hidden" />
            <span aria-hidden className="max-sm:hidden">
              ·
            </span>
            <LocalDay iso={article.publishedAt ?? article.updatedAt} />
            {article.views === undefined ? null : (
              <>
                <span aria-hidden>·</span>
                {COMPACT.format(views)} {views === 1 ? 'view' : 'views'}
              </>
            )}
          </span>
        </span>
      </Link>
    </li>
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
