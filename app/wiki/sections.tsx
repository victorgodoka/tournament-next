import Link from 'next/link'
import { twMerge } from 'tailwind-merge'
import { AdBanner } from '@omega/ads/ad-banner'
import { NonVipOnly } from '@omega/ads/non-vip-only'
import { WIKI_CARD, WikiHead } from '@omega/wiki'
import { MediaCard } from '@omega-hub/ds'
import { ArticleMeta, COMPACT, coverUrl, TopicIcon } from '@omega/wiki/article'
import { LocalDay } from '@omega/wiki/local-day'
import { buttonClasses } from '@ui/button'
import { Icon } from '@ui/icon'
import { Panel } from '@ui/panel'
import type { ArticleSummary } from '@utils/types'
import { META_REPORT_PREFIX, TOPIC_IDS, topicOf, WIKI_TOPICS, type WikiTopic } from '@utils/wiki-topics'

const SECTION = 'mx-auto flex w-full max-w-page flex-col gap-4 px-gutter pt-10 sm:gap-6 sm:pt-14'

const TOOLS: Partial<Record<WikiTopic, { title: string; to: string }[]>> = {
  formats: [
    { title: 'Banlist', to: '/banlist' },
    { title: 'Banlist timeline', to: '/banlist-timeline' },
  ],
}

const START = [
  { title: 'Install the client', note: 'YGO Omega Install Guide', to: '/wiki/omega-install-guide' },
  { title: 'Learn to duel', note: "Beginner's Guide to YGO Omega", to: '/wiki/beginner-s-guide-to-ygo-omega' },
  { title: 'Pick a format', note: 'Format Primer: every format on Omega', to: '/wiki/yu-gi-oh-formats' },
]

const ARROW = 'M13 5l-1.4 1.4 4.6 4.6H4v2h12.2l-4.6 4.6L13 19l7-7z'

const Arrow = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" width={20} height={20} fill="currentColor" aria-hidden className={twMerge('shrink-0', className)}>
    <path d={ARROW} />
  </svg>
)

const RULE = 'border-t border-[rgba(142,166,199,0.28)]'

/** The page's one steel card: the first three things a new duelist needs. */
export const StartHere = ({ className }: { className?: string }) => (
  <aside
    aria-label="Start here"
    className={twMerge(WIKI_CARD, 'flex min-w-0 flex-col gap-3.5 px-5 py-5.5 [--fill:var(--color-steel)] sm:gap-5 sm:p-7', className)}
  >
    <div className="flex flex-col gap-1 sm:gap-1.5">
      <span className="text-ink-dim signal">New to Omega?</span>
      <h2 className="text-ink display-2">Start here</h2>
    </div>
    <ol className="flex flex-col">
      {START.map(({ title, note, to }, i) => (
        <li key={to}>
          <Link
            href={to}
            className={twMerge(RULE, 'flex min-h-16 items-center gap-3.5 py-2.5 text-ink hover:text-ink sm:min-h-0 sm:gap-4 sm:py-3.5', i === START.length - 1 && 'border-b')}
          >
            <span className="w-5 text-gold display-5">{i + 1}</span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-bold">{title}</span>
              <span className="text-ink-dim body-sm">{note}</span>
            </span>
            <Arrow />
          </Link>
        </li>
      ))}
    </ol>
    <p className="text-ink-dim body-sm">
      Game won&apos;t start?{' '}
      <Link href="/wiki/ygo-omega-troubleshooting-guide" className="hover:text-ink">
        Troubleshooting Guide
      </Link>
    </p>
  </aside>
)

/** Titles in a tile drop what every one of them repeats. */
const shortTitle = (title: string) => title.replace(/^Yu-Gi-Oh! /, '').replace(/^YGO Omega /, '')

const TopicTile = ({ topic, articles }: { topic: WikiTopic; articles: ArticleSummary[] }) => {
  const { label, blurb, phoneBlurb } = WIKI_TOPICS[topic]
  const links = [
    ...articles.slice(0, 3).map((article) => ({ title: shortTitle(article.title), to: `/wiki/${article.slug}`, tag: '' })),
    ...(TOOLS[topic] ?? []).map((tool) => ({ ...tool, tag: 'Tool' })),
  ]
  return (
    <div className="cut notch relative flex min-h-37.5 flex-col gap-2.5 p-4 [--cut:var(--cut-md)] sm:gap-3.5 sm:p-6">
      <div className="flex items-center justify-between">
        <span className="cut flex size-9 items-center justify-center text-azure-lift [--cut:var(--cut-xs)] [--edge:var(--color-surface-200)] [--fill:var(--color-surface-200)] sm:size-10">
          <TopicIcon topic={topic} />
        </span>
        <span className="text-ink-muted signal-sm max-sm:hidden">
          {articles.length} {articles.length === 1 ? 'article' : 'articles'}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <h3 className="text-xl/[1.1] text-ink display-3 sm:text-[22px]">{label}</h3>
        <p className="text-[13px]/[18px] text-ink-dim sm:hidden">{phoneBlurb}</p>
        <p className="text-ink-dim body-sm max-sm:hidden">{blurb}</p>
      </div>
      <ul className="flex flex-1 flex-col max-sm:hidden">
        {links.map(({ title, to, tag }) => (
          <li key={to}>
            <Link href={to} className="flex items-center justify-between gap-3 border-t border-line py-2.5 text-sm/5 text-ink hover:text-cyan">
              {title}
              {tag ? <span className="text-ink-muted signal-sm">{tag}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
      <span className="mt-auto text-ink-muted signal-sm sm:hidden">
        {articles.length} {articles.length === 1 ? 'article' : 'articles'}
      </span>
      {/* On a phone the whole tile is this link. */}
      <Link href={`/wiki?topic=${topic}#articles`} className="self-start pt-3 signal-strong hover:text-ink max-sm:absolute max-sm:inset-0 max-sm:pt-0">
        <span className="max-sm:sr-only">All in {label} →</span>
      </Link>
    </div>
  )
}

export const TopicsSection = ({ articles }: { articles: ArticleSummary[] }) => (
  <section aria-labelledby="topics-head" className={SECTION}>
    <WikiHead num="01" id="topics-head" end={`${articles.length} articles · ${TOPIC_IDS.length} topics`}>
      Browse by topic
    </WikiHead>
    <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
      {TOPIC_IDS.map((topic) => (
        <TopicTile key={topic} topic={topic} articles={articles.filter((article) => topicOf(article) === topic)} />
      ))}
    </div>

    <Link
      href="/wiki/card/72270339"
      className="cut flex items-center gap-3.5 p-4 text-ink-dim hover:text-ink-dim sm:hidden"
    >
      <span className="cut flex size-9 shrink-0 items-center justify-center text-gold [--cut:var(--cut-xs)] [--edge:var(--color-surface-200)] [--fill:var(--color-surface-200)]">
        <Icon name="cards" size={18} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-bold text-ink">Card reference</span>
        <span className="body-sm">Search any card by name or passcode.</span>
      </span>
      <Arrow className="text-cyan" />
    </Link>
    <div className="cut flex flex-wrap items-center gap-5 px-6 py-5 max-sm:hidden">
      <span className="cut flex size-10 items-center justify-center text-gold [--cut:var(--cut-xs)] [--edge:var(--color-surface-200)] [--fill:var(--color-surface-200)]">
        <Icon name="cards" size={20} />
      </span>
      <div className="flex min-w-0 flex-[1_1_320px] flex-col text-ink-dim">
        <span className="font-bold text-ink">Card reference</span>
        <span className="body-sm">
          Every card has a page with its text, rulings and passcode. Search by name or passcode, like <span className="font-mono text-ink">72270339</span>.
        </span>
      </div>
      <Link href="/wiki/card/72270339" className={buttonClasses({ variant: 'secondary', size: 'signal' })}>
        Search cards
      </Link>
    </div>
  </section>
)

/** The game count a tier list states in its summary, as `scripts/wiki-tier-list.ts` writes it ("matches" before November 2026). */
const ladderGames = (summary: string) => summary.match(/([\d,]+) YGO Omega ladder (?:games|matches)/)?.[1]?.replaceAll(',', ' ')

const LADDER = {
  tcg: { label: 'TCG ladder', color: 'var(--color-ladder-tcg)', text: 'text-ladder-tcg' },
  genesys: { label: 'Genesys ladder', color: 'var(--color-ladder-genesys)', text: 'text-ladder-genesys' },
}

const LadderTile = ({ article, ladder }: { article: ArticleSummary; ladder: keyof typeof LADDER }) => {
  const games = ladderGames(article.summary)
  return (
    <MediaCard
      href={`/wiki/${article.slug}`}
      size="sm"
      ratio="cinema"
      image={coverUrl(article.cover, 400)}
      accent={LADDER[ladder].color}
      className="h-full"
      eyebrow={<span className={LADDER[ladder].text}>{LADDER[ladder].label}</span>}
      title={article.title}
      meta={
        // The list is replaced in place every week, so its last edit is its issue date.
        <>
          Last updated <LocalDay iso={article.updatedAt} />
          {article.views === undefined ? null : <> · {COMPACT.format(article.views)} views</>}
        </>
      }
      footer={
        games ? (
          <>
            <span className="stat text-ink">{games}</span>
            <span className="text-ink-muted signal-sm">Ladder games</span>
          </>
        ) : undefined
      }
    />
  )
}

export const hasMetaSection = (articles: ArticleSummary[]) => articles.some((article) => article.slug.startsWith(META_REPORT_PREFIX))

export const MetaSection = ({ articles }: { articles: ArticleSummary[] }) => {
  const report = articles.find((article) => article.slug.startsWith(META_REPORT_PREFIX))
  const tcg = articles.find((article) => article.slug === 'yu-gi-oh-tcg-tier-list')
  const genesys = articles.find((article) => article.slug === 'yu-gi-oh-genesys-tier-list')
  if (!report) return null
  const day = <LocalDay iso={report.publishedAt ?? report.updatedAt} />

  return (
    <section aria-labelledby="meta-head" className={SECTION}>
      <WikiHead
        num="02"
        id="meta-head"
        end={
          <>
            Ranked ladders · Updated {day}
          </>
        }
      >
        Meta this week
      </WikiHead>
      <div className="flex flex-wrap gap-3 sm:gap-6">
        <MediaCard
          href={`/wiki/${report.slug}`}
          size="lg"
          layout="row"
          ratio="cinema"
          eager
          image={coverUrl(report.cover, 800)}
          accent="cyan"
          className="min-w-0 flex-[2_1_520px]"
          eyebrow={<>Meta report · {day}</>}
          title={report.title}
          tags={['TCG', 'Genesys']}
          meta={<ArticleMeta article={report} />}
        >
          {report.summary || null}
        </MediaCard>
        {tcg || genesys ? (
          <div className="grid min-w-0 flex-[1_1_340px] gap-3 min-[480px]:grid-cols-2 sm:flex sm:flex-col sm:gap-6">
            {tcg ? <LadderTile article={tcg} ladder="tcg" /> : null}
            {genesys ? <LadderTile article={genesys} ladder="genesys" /> : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}

/** The index's side column. On a phone it follows the list. */
export const IndexAside = ({ articles }: { articles: ArticleSummary[] }) => {
  const mostRead = [...articles].sort((a, b) => (b.views ?? 0) - (a.views ?? 0)).slice(0, 5)
  return (
    <aside className="flex min-w-0 flex-col gap-4 sm:gap-6">
      {mostRead.length ? (
        <Panel tone="framed" title="Most read" meta="By views" className="p-5 min-[720px]:p-6">
          <ol>
            {mostRead.map((article, i) => (
              <li key={article.slug}>
                <Link href={`/wiki/${article.slug}`} className="flex min-h-12 items-center gap-3.5 border-t border-line py-2 text-sm/5 text-ink hover:text-cyan sm:min-h-0 sm:py-2.5">
                  <span className="w-4.5 text-gold display-5">{i + 1}</span>
                  <span className="min-w-0 flex-1">{article.title}</span>
                  <span className="text-ink-muted signal-sm">{COMPACT.format(article.views ?? 0)}</span>
                </Link>
              </li>
            ))}
          </ol>
        </Panel>
      ) : null}

      <Panel tone="framed" title="Still stuck?" className="p-5 min-[720px]:p-6">
        <p className="text-sm/[22px] text-ink-dim">Ask in the Omega-help channel on Discord. Found a bug? Post one report on the forum.</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <a href="https://discord.gg/duelistsunite" className={buttonClasses({ variant: 'secondary', size: 'signal' })}>
            Open Discord
          </a>
          <Link href="/wiki/bug-reports-how-to-report-a-ygo-omega-bug" className="inline-flex min-h-11 items-center text-ink-muted signal-strong hover:text-ink">
            Report a bug →
          </Link>
        </div>
      </Panel>

      <NonVipOnly>
        <Panel tone="framed" label="Omega VIP" className="flex flex-col gap-2.5 p-5 min-[720px]:gap-3 min-[720px]:p-6">
          <div className="flex items-center gap-2.5">
            <span aria-hidden className="size-2 bg-gold" />
            <span className="text-gold signal">Omega VIP</span>
          </div>
          <p className="text-sm/[22px] text-ink-dim">Donate 5 USD or more: 1 of each rarity, your mat and sleeves visible to opponents, and no ads on the site.</p>
          <Link href="/download#donations" className="inline-flex items-center text-ink-muted signal-strong hover:text-ink max-sm:min-h-11">
            See VIP perks →
          </Link>
        </Panel>
      </NonVipOnly>

      <AdBanner id="ad-aside" placement="aside" className="p-0" />
    </aside>
  )
}
