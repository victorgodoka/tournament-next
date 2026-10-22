import Image from 'next/image'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'
import { Chip } from '@ui/chip'
import type { ArticleLink, ArticleLinks } from '@utils/types'
import { imageSource, outline, type DocHtml, type WikiDoc } from '@utils/wiki-doc'
import { WikiBlocks } from './blocks'
import { AsideBlock, FactRows, LINK, WIKI_ASIDE, WIKI_PAD } from './wiki'

type ArticleViewProps = {
  doc: WikiDoc
  /** The article's address; lives outside the doc. */
  slug: string
  /** From `renderDocHtml(doc)`. */
  html: DocHtml
  /**
   * Hub, related and children as the server resolved them (published only, through redirects).
   * Never read from `doc.hub` / `doc.related`: those may name drafts, deleted or renamed articles.
   */
  links?: ArticleLinks
  /** Extra side-column blocks after Contents: status, history, editing. */
  children?: React.ReactNode
  /** The published page only (never the editor preview): first thing in the article column. */
  lead?: React.ReactNode
  /** The published page only: names the article column so the ad script can space units through it. */
  bodyId?: string
  /** The published page only: after the article in its column, outside `bodyId`, so no ad is spaced through it. */
  footer?: React.ReactNode
}

/** "Read next" and the hub's own list: title and summary per article. */
const LinkList = ({ label, articles }: { label: string; articles: ArticleLink[] }) => (
  <section aria-label={label} className="clear-both mt-12 border-t border-line pt-6">
    <h2 className="text-ink-muted signal-strong">{label}</h2>
    <ul className="mt-4 grid gap-px border border-line bg-line sm:grid-cols-2">
      {articles.map((article) => (
        <li key={article.slug} className="bg-space-000">
          <Link href={`/wiki/${article.slug}`} className="group block h-full px-4 py-3.5">
            <span className="block text-ink body-strong group-hover:text-cyan">{article.title}</span>
            {article.summary ? <span className="mt-1 line-clamp-2 block text-ink-muted body-sm">{article.summary}</span> : null}
          </Link>
        </li>
      ))}
    </ul>
  </section>
)

/**
 * A block article, cover to infobox. Every pixel comes from `doc` (and `html`, its rendered Markdown), so
 * the editor preview and the published page are the same component fed the same JSON.
 */
export const ArticleView = ({ doc, slug, html, links, children, lead, bodyId, footer }: ArticleViewProps) => {
  const cover = doc.cover && doc.assets[doc.cover.asset]
  const infobox = doc.infobox
  const infoAsset = infobox?.asset ? doc.assets[infobox.asset] : undefined
  const toc = outline(doc)

  return (
    <>
      <header className="relative isolate overflow-hidden border-b border-line">
        {cover ? (
          <Image
            {...imageSource(cover, 1920)}
            alt=""
            fill
            priority
            sizes="100vw"
            style={{
              objectPosition: cover.focal ? `${cover.focal.x}% ${cover.focal.y}%` : undefined,
            }}
            className="-z-10 object-cover brightness-[.55] saturate-[.85]"
          />
        ) : null}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-linear-to-t from-space-000 via-veil-base/60 to-veil-top"
        />

        <div
          className={twMerge(
            'mx-auto flex min-h-[clamp(260px,34vw,420px)] w-full max-w-page flex-col justify-end pt-16 pb-8',
            WIKI_PAD,
          )}
        >
          <nav aria-label="Breadcrumb" className="text-ink-muted signal-sm">
            <Link href="/wiki" className="text-ink-muted hover:text-cyan">
              Omega Wiki
            </Link>{' '}
            /{' '}
            {links?.hub ? (
              <>
                <Link href={`/wiki/${links.hub.slug}`} className="text-ink-muted hover:text-cyan">
                  {links.hub.title}
                </Link>{' '}
                /{' '}
              </>
            ) : null}
            {slug || '…'}
          </nav>
          <h1 className="mt-3 text-ink display-1">{doc.title || 'Untitled'}</h1>
          {doc.summary ? <p className="mt-3.5 max-w-[62ch] text-ink-dim lead">{doc.summary}</p> : null}
          <ul className="mt-4.5 flex flex-wrap gap-2">
            {doc.tags.map((tag) => (
              <li key={tag}>
                <Chip tone="neutral">{tag}</Chip>
              </li>
            ))}
          </ul>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-page grid-cols-1 border-line lg:grid-cols-[minmax(0,1fr)_340px] 2xl:border-x">
        <div className={twMerge('order-2 min-w-0 py-[clamp(24px,3vw,40px)] lg:order-1', WIKI_PAD)}>
          <article id={bodyId}>
            {lead}
            <WikiBlocks doc={doc} html={html} />
            {links?.children.length ? <LinkList label="In this hub" articles={links.children} /> : null}
            {links?.related.length ? <LinkList label="Read next" articles={links.related} /> : null}
          </article>
          {footer}
        </div>

        <aside className={twMerge('order-1 border-b border-line lg:order-2 lg:border-b-0 lg:border-l', WIKI_ASIDE)}>
          {infobox ? (
            <AsideBlock label={doc.title}>
              {infoAsset ? (
                <figure className="mt-2.5">
                  <Image
                    {...imageSource(infoAsset, 700)}
                    alt={infoAsset.alt}
                    width={infoAsset.width}
                    height={infoAsset.height}
                    sizes="300px"
                    className="h-auto w-full border border-line"
                  />
                  {infobox.caption ? (
                    <figcaption className="mt-2 text-ink-muted caption">{infobox.caption}</figcaption>
                  ) : null}
                </figure>
              ) : null}
              <FactRows facts={infobox.facts} />
            </AsideBlock>
          ) : null}

          {toc.length ? (
            <AsideBlock label="Contents" className="hidden lg:block">
              <ol className="mt-2.5 flex flex-col gap-1.5">
                {toc.map((heading, i) => (
                  <li key={heading.id} className={heading.level === 3 ? 'pl-4' : undefined}>
                    <a href={`#${heading.anchor}`} className={twMerge('body-sm', LINK)}>
                      {heading.level === 2 ? (
                        <span className="mr-2 text-ink-muted mono-data">
                          {String(toc.slice(0, i + 1).filter((h) => h.level === 2).length).padStart(2, '0')}
                        </span>
                      ) : null}
                      {heading.text}
                    </a>
                  </li>
                ))}
              </ol>
            </AsideBlock>
          ) : null}

          {children}
        </aside>
      </div>
    </>
  )
}
