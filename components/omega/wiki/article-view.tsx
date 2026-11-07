import Image from 'next/image'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'
import type { ArticleLink, ArticleLinks } from '@utils/types'
import { imageSource, outline, type DocHtml, type WikiAsset, type WikiDoc, type WikiInfobox } from '@utils/wiki-doc'
import { topicOf, WIKI_TOPICS } from '@utils/wiki-topics'
import { headingNumbers, WikiBlocks } from './blocks'
import { articleShareUrl } from './share'
import { Toc, TocDisclosure, type TocItem } from './toc'
import { WIKI_ASIDE, WIKI_CARD, WIKI_RAIL, WIKI_SCROLL_ROW, WIKI_TILE } from './wiki'

type ArticleViewProps = {
  doc: WikiDoc
  /** The article's address; lives outside the doc. */
  slug: string
  /** From `renderDocHtml(doc)`. */
  html: DocHtml
  /**
   * Hub, related and children as the server resolved them (published only, through redirects).
   * Never read from `doc.hub` / `doc.related`: those may name drafts, deleted or renamed articles.
   * On a child, `children` holds its hub's: the page fetches them, so the card can list the whole hub.
   */
  links?: ArticleLinks
  /** Bottom row of the header: author, date, share. Not in the doc, so the editor preview has none. */
  meta?: React.ReactNode
  /** Extra side-column blocks after the infobox and the hub: status, history, editing. */
  children?: React.ReactNode
  /** The published page only (never the editor preview): right after the opening paragraph. */
  lead?: React.ReactNode
  /** The published page only: names the article column so the ad script can space units through it. */
  bodyId?: string
  /** The published page only: after the article in its column, outside `bodyId`, so no ad is spaced through it. */
  footer?: React.ReactNode
}

/** Tag edges for the two ladders; every other tag stays neutral. */
const TAG_EDGE: Record<string, string> = {
  tcg: '[--edge:var(--color-ladder-tcg)]',
  genesys: '[--edge:var(--color-ladder-genesys)]',
}

/** Fact values that name a ladder take its color. */
const FACT_TONE: Record<string, string> = { TCG: 'text-ladder-tcg', Genesys: 'text-ladder-genesys' }

const focal = (asset: WikiAsset) => (asset.focal ? `${asset.focal.x}% ${asset.focal.y}%` : undefined)

const FactValue = ({ value }: { value: string }) =>
  value.split('\n').map((line, i) => (
    <span key={i} className={twMerge('block', FACT_TONE[line] ?? 'text-ink')}>
      {line}
    </span>
  ))

const Infobox = ({ title, infobox, asset }: { title: string; infobox: WikiInfobox; asset?: WikiAsset }) => (
  <div className={twMerge(WIKI_CARD, 'flex flex-col')}>
    <span className="px-5 pt-4 text-ink-muted signal">{title}</span>
    {asset ? (
      <figure className="flex flex-col gap-2 px-5 pt-3 pb-4">
        <Image
          {...imageSource(asset, 700)}
          alt={asset.alt}
          width={asset.width}
          height={asset.height}
          sizes="240px"
          style={{ objectPosition: focal(asset) }}
          className="aspect-[4/5] w-full object-cover"
        />
        {infobox.caption ? <figcaption className="text-ink-dim body-sm">{infobox.caption}</figcaption> : null}
      </figure>
    ) : (
      <span className="h-2.5" />
    )}
    <dl className="px-5 pb-2">
      {infobox.facts.map(({ label, value }) => (
        <div key={label} className="grid grid-cols-[104px_minmax(0,1fr)] gap-3 border-t border-line py-2.5">
          <dt className="pt-[3px] text-ink-muted signal">{label}</dt>
          <dd className="text-sm/5">
            <FactValue value={value} />
          </dd>
        </div>
      ))}
    </dl>
  </div>
)

/** The infobox over the article on a phone: art beside the facts. */
const CompactInfobox = ({ infobox, asset }: { infobox: WikiInfobox; asset?: WikiAsset }) => (
  <div className={twMerge(WIKI_CARD, 'grid gap-3.5 p-3.5', asset && 'grid-cols-[112px_minmax(0,1fr)]')}>
    {asset ? (
      <Image
        {...imageSource(asset, 320)}
        alt={asset.alt}
        width={asset.width}
        height={asset.height}
        sizes="112px"
        style={{ objectPosition: focal(asset) }}
        className="aspect-[4/5] w-full object-cover"
      />
    ) : null}
    <dl className="flex min-w-0 flex-col">
      {infobox.facts.map(({ label, value }) => (
        <div key={label} className="flex justify-between gap-2 border-b border-line py-1.5 last:border-b-0">
          <dt className="pt-[3px] whitespace-nowrap text-ink-muted signal-sm">{label}</dt>
          <dd className="text-right text-[13px]/[18px]">
            <FactValue value={value} />
          </dd>
        </div>
      ))}
    </dl>
  </div>
)

const HubRow = ({ article, here }: { article: ArticleLink; here: boolean }) =>
  here ? (
    <span className="flex justify-between gap-3 border-t border-line py-2.5 text-sm/5 font-bold text-ink">
      {article.title}
      <span className="pt-1 whitespace-nowrap text-cyan signal-sm">You&apos;re here</span>
    </span>
  ) : (
    <Link
      href={`/wiki/${article.slug}`}
      className="flex flex-col justify-center gap-0.5 border-t border-line py-2.5 text-sm/5 font-bold text-ink max-sm:min-h-12 hover:text-cyan"
    >
      {article.title}
      {article.summary ? <span className="line-clamp-2 text-[13px]/5 font-normal text-ink-dim max-sm:hidden">{article.summary}</span> : null}
    </Link>
  )

/** The hub this article belongs to, or leads: its title and the articles in it, this one marked. */
const HubCard = ({ doc, slug, links, className }: { doc: WikiDoc; slug: string; links?: ArticleLinks; className?: string }) => {
  const hub = links?.hub ?? (links?.children.length ? { slug, title: doc.title } : null)
  if (!hub || !links?.children.length) return null
  return (
    <div className={twMerge(WIKI_CARD, 'flex flex-col gap-1 p-4 sm:p-5', className)}>
      <span className="text-ink-muted signal">In this hub</span>
      <Link href={`/wiki/${hub.slug}`} className="mt-1 mb-2 text-xl/[1.1] text-ink display-3 hover:text-cyan sm:text-[22px]">
        {hub.title}
      </Link>
      {links.children.map((article) => (
        <HubRow key={article.slug} article={article} here={article.slug === slug} />
      ))}
    </div>
  )
}

const ReadNext = ({ articles }: { articles: ArticleLink[] }) => (
  <section aria-labelledby="read-next" className="clear-both mt-6 flex flex-col gap-3 sm:mt-10 sm:gap-4 sm:border-t sm:border-line sm:pt-5">
    <h2 id="read-next" className="text-[26px] text-ink display-2 sm:text-[32px]">
      Read next
    </h2>
    <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4">
      {articles.map((article) => {
        const topic = topicOf(article)
        return (
          <li key={article.slug} className="flex">
            <Link
              href={`/wiki/${article.slug}`}
              className={twMerge(WIKI_TILE, 'flex w-full flex-col gap-1.5 p-4 text-ink-dim hover:text-ink-dim sm:gap-2 sm:p-5')}
            >
              {topic ? <span className="text-azure-lift signal-sm sm:text-[11px] sm:tracking-[0.14em]">{WIKI_TOPICS[topic].label}</span> : null}
              <span className="font-bold text-ink sm:text-base">{article.title}</span>
              {article.summary ? <span className="line-clamp-3 body-sm">{article.summary}</span> : null}
            </Link>
          </li>
        )
      })}
    </ul>
  </section>
)

/**
 * A block article, cover to infobox. Every pixel comes from `doc` (and `html`, its rendered Markdown), so
 * the editor preview and the published page are the same component fed the same JSON.
 *
 * It keeps the design's 1280px at every width instead of `max-w-page`, which narrows from 1366px to 1620px to clear
 * the Nitro rails: three columns don't fit in what's left. So an article's rails wait for 1620px (`RAIL_ARTICLE_QUERY`).
 */
export const ArticleView = ({ doc, slug, html, links, meta, children, lead, bodyId, footer }: ArticleViewProps) => {
  const cover = doc.cover && doc.assets[doc.cover.asset]
  const infobox = doc.infobox
  const infoAsset = infobox?.asset ? doc.assets[infobox.asset] : undefined
  const numbers = headingNumbers(doc)
  const toc: TocItem[] = outline(doc).map(({ id, anchor, text, level }) => ({ anchor, text, level, num: numbers.get(id) }))

  return (
    <>
      <section aria-labelledby="article-title" className="relative isolate overflow-hidden border-b border-line bg-[#0b1426]">
        {cover ? (
          <span aria-hidden className="absolute inset-x-0 top-0 -z-10 h-60 sm:h-full">
            <Image {...imageSource(cover, 1920)} alt="" fill priority sizes="100vw" style={{ objectPosition: focal(cover) }} className="object-cover" />
            {/* On a phone the cover is only the top band: this melts its bottom edge into the ground. */}
            <span className="absolute inset-0 bg-linear-to-t from-space-000 to-transparent to-60% sm:hidden" />
          </span>
        ) : (
          <span aria-hidden className="dots absolute inset-0 -z-10" />
        )}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[linear-gradient(0deg,#080a14_0%,#080a14_45%,rgba(8,10,20,0.4)_100%)] sm:bg-[linear-gradient(90deg,rgba(8,10,20,0.94)_0%,rgba(8,10,20,0.78)_45%,rgba(8,10,20,0.35)_100%),linear-gradient(0deg,#080a14_0%,rgba(8,10,20,0)_45%)]"
        />

        <div className="relative mx-auto flex w-full max-w-[1280px] flex-col gap-3.5 px-gutter pt-4 pb-6 sm:gap-5 sm:pt-10 sm:pb-11">
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-2 sm:gap-2.5">
              <li>
                <Link href="/" className="inline-flex items-center text-ink-muted signal-strong hover:text-ink max-sm:min-h-11">Home</Link>
              </li>
              <li aria-hidden className="text-ink-muted signal-sm">/</li>
              <li>
                <Link href="/wiki" className="inline-flex items-center text-ink-muted signal-strong hover:text-ink max-sm:min-h-11">
                  Omega Wiki
                </Link>
              </li>
              {links?.hub ? (
                <>
                  <li aria-hidden className="text-ink-muted signal-sm">
                    /
                  </li>
                  <li>
                    <Link href={`/wiki/${links.hub.slug}`} className="inline-flex items-center text-ink-muted signal-strong hover:text-ink max-sm:min-h-11">
                      {links.hub.title}
                    </Link>
                  </li>
                </>
              ) : null}
              <li aria-hidden className="text-ink-muted signal-sm max-sm:hidden">
                /
              </li>
              <li aria-current="page" className="text-ink-dim signal-strong max-sm:hidden">
                {doc.title || slug || '…'}
              </li>
            </ol>
          </nav>

          <h1 id="article-title" className="mt-24 text-[52px] leading-[0.95] text-ink display-hero sm:mt-14 sm:text-[72px] sm:leading-[0.92]">
            {doc.title || 'Untitled'}
          </h1>
          {doc.summary ? <p className="max-w-180 text-base/[26px] text-ink sm:text-lg/7">{doc.summary}</p> : null}

          {doc.tags.length ? (
            <ul aria-label="Tags" className={twMerge('flex gap-2', WIKI_SCROLL_ROW)}>
              {doc.tags.map((tag) => (
                <li key={tag}>
                  <span
                    className={twMerge(
                      'cut inline-flex min-h-8 items-center px-2.5 whitespace-nowrap text-ink-dim signal-strong [--cut:var(--cut-xs)] sm:min-h-7',
                      TAG_EDGE[tag],
                    )}
                  >
                    {tag}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {meta ? <div className="pt-1 sm:mt-0 sm:border-t sm:border-line-mid/60 sm:pt-5">{meta}</div> : null}

          {cover?.credit ? <span className="absolute right-gutter bottom-4 text-ink-muted signal-sm leading-3.5 max-sm:hidden">{cover.credit}</span> : null}
        </div>
      </section>

      <div className="@container mx-auto w-full max-w-[1280px]">
        <div
          className={twMerge(
            'grid grid-cols-1 gap-x-10 px-gutter pt-5 pb-10 @min-[880px]:grid-cols-[minmax(0,1fr)_280px] @min-[880px]:pt-12 @min-[880px]:pb-20',
            toc.length > 0 && '@min-[1220px]:grid-cols-[220px_minmax(0,680px)_minmax(280px,1fr)]',
          )}
        >
          {toc.length ? (
            <div className={twMerge('hidden @min-[1220px]:block', WIKI_RAIL)}>
              <Toc items={toc} />
            </div>
          ) : null}

          <div className="min-w-0">
            <div className="mb-6 flex flex-col gap-3 @min-[880px]:hidden">
              {infobox ? <CompactInfobox infobox={infobox} asset={infoAsset} /> : null}
              {toc.length ? <TocDisclosure items={toc} /> : null}
            </div>

            <article id={bodyId}>
              <WikiBlocks doc={doc} html={html} lead={lead} shareUrl={slug ? articleShareUrl(slug) : undefined} />
              <HubCard doc={doc} slug={slug} links={links} className="mt-6 @min-[880px]:hidden" />
              {links?.related.length ? <ReadNext articles={links.related} /> : null}
            </article>
            {footer}
          </div>

          <aside className={twMerge('flex flex-col gap-6 max-[879px]:mt-6', WIKI_ASIDE)}>
            {infobox ? (
              <div className="hidden @min-[880px]:block">
                <Infobox title={doc.title} infobox={infobox} asset={infoAsset} />
              </div>
            ) : null}
            {toc.length ? <Toc items={toc} className="hidden @min-[880px]:flex @min-[1220px]:hidden" /> : null}
            <HubCard doc={doc} slug={slug} links={links} className="hidden @min-[880px]:flex" />
            {children}
          </aside>
        </div>
      </div>
    </>
  )
}
