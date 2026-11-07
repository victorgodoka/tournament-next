import { Fragment } from 'react'
import Image, { getImageProps } from 'next/image'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'
import { CardImage } from '@omega/card-art'
import { Icon } from '@ui/icon'
import { CARD_IMAGE_URL } from '@utils/const'
import {
  CODE_LANGUAGES,
  faqKey,
  frameKey,
  imageSource,
  type CalloutTone,
  type CardsAlign,
  type DocHtml,
  type FigureAlign,
  type WikiAsset,
  type WikiBlock,
  type WikiCardRef,
  type WikiDoc,
} from '@utils/wiki-doc'
import { CodeBlock } from './code-block'
import { Lightbox, Zoomable } from './lightbox'
import { ShareButtons } from './share-buttons'
import { Video } from './video'
import { StatisticsDeck } from './statistics-deck'
import { WIKI_TILE } from './wiki'

/** Floats sit beside the text that follows; everything wider clears them first. */
const ALIGN: Record<FigureAlign, string> = {
  left: 'mb-4 sm:float-left sm:mt-1 sm:mr-7 sm:w-[min(300px,42%)]',
  right: 'mb-4 sm:float-right sm:mt-1 sm:ml-7 sm:w-[min(300px,42%)]',
  center: 'clear-both mx-auto my-5 max-w-[560px]',
  wide: 'clear-both my-5',
}

const WARNING = 'M12 2 1 21h22zm1 15h-2v-2h2zm0-4h-2V9h2z'

const CALLOUT: Record<CalloutTone, { box: string; title: string; icon: React.ReactNode }> = {
  gold: { box: '[--edge:var(--color-gold)] [--fill:#1a1708]', title: 'text-gold', icon: <Icon name="star" size={20} /> },
  cyan: { box: '[--edge:var(--color-cyan)] [--fill:var(--color-ground-cyan)]', title: 'text-cyan', icon: <Icon name="info" size={20} /> },
  negative: {
    box: '[--edge:var(--color-crimson-lift)] [--fill:#1f0c12]',
    title: 'text-crimson-lift',
    icon: (
      <svg viewBox="0 0 24 24" width={20} height={20} fill="currentColor" aria-hidden>
        <path d={WARNING} />
      </svg>
    ),
  },
}

const CARDS_ALIGN: Record<CardsAlign, string> = { left: 'justify-start', center: 'justify-center', right: 'justify-end' }

/** A figure's words: the caption, then its credit. `row` keeps them on one line where the figure is wide enough. */
const Caption = ({ children, credit, row }: { children?: React.ReactNode; credit?: string; row?: boolean }) =>
  children || credit ? (
    <figcaption className={twMerge('flex flex-col gap-1 text-ink-dim body-sm', row && 'sm:flex-row sm:items-baseline sm:justify-between sm:gap-4')}>
      {children ? <span>{children}</span> : null}
      {credit ? <span className="text-ink-muted signal-sm leading-3.5 sm:whitespace-nowrap">{credit}</span> : null}
    </figcaption>
  ) : null

/** Nodes from `renderDocHtml`: parsed, classed and sanitized before they get here. */
const Markdown = ({ html, className }: { html?: React.ReactNode; className?: string }) => <div className={className}>{html}</div>

/** A `<picture>` when there is a mobile image: the browser fetches one of the two, never both. */
const FigureImage = ({ asset, mobile, wide }: { asset: WikiAsset; mobile?: WikiAsset; wide: boolean }) => {
  const image = {
    ...imageSource(asset, wide ? 1600 : 640),
    width: asset.width,
    height: asset.height,
    sizes: wide ? '(min-width: 1024px) 680px, 100vw' : '(min-width: 640px) 300px, 100vw',
    className: 'h-auto w-full',
  }
  if (!mobile) return <Image {...image} alt={asset.alt} />
  const { props: small } = getImageProps({ ...imageSource(mobile, 640), alt: '', width: mobile.width, height: mobile.height, sizes: '100vw' })
  return (
    <picture>
      {/* The site's `sm` breakpoint. Width and height let the browser reserve the mobile image's own shape. */}
      <source media="(max-width: 639px)" srcSet={small.srcSet ?? small.src} width={mobile.width} height={mobile.height} />
      {/* eslint-disable-next-line jsx-a11y/alt-text -- `alt` is in the props. */}
      <img {...getImageProps({ ...image, alt: asset.alt }).props} />
    </picture>
  )
}

/** The bottom edge of a card takes its frame's color; a card the lookup didn't name stays neutral. */
const frameEdge = (card: WikiCardRef, html: DocHtml): React.CSSProperties | undefined => {
  const frame = html[frameKey(card.id)]
  return typeof frame === 'string' ? { borderBottomColor: `var(--color-type-${frame})` } : undefined
}

const CARD_FACE = 'relative block aspect-[59/86] overflow-hidden border-b-4 border-line-mid bg-surface-200'

const CardFace = ({ card, html, sizes }: { card: WikiCardRef; html: DocHtml; sizes: string }) => (
  <span style={frameEdge(card, html)} className={CARD_FACE}>
    <CardImage src={CARD_IMAGE_URL(card.id)} alt={`${card.name} card`} fill sizes={sizes} className="object-cover" />
  </span>
)

/** One card alone is a feature, with its caption inside. */
const CardFeature = ({ card, caption, html }: { card: WikiCardRef; caption?: string; html: DocHtml }) => (
  <Link
    href={`/wiki/card/${card.id}`}
    className={twMerge(WIKI_TILE, 'clear-both my-5 grid grid-cols-[72px_minmax(0,1fr)] items-center gap-3.5 p-3 text-ink-dim hover:text-ink-dim sm:grid-cols-[96px_minmax(0,1fr)] sm:gap-5 sm:p-4')}
  >
    <CardFace card={card} html={html} sizes="96px" />
    <span className="flex min-w-0 flex-col gap-1 sm:gap-1.5">
      {card.note ? <span className="text-azure-lift signal-sm">{card.note}</span> : null}
      <span className="text-lg/[1.1] text-ink display-3 sm:text-[22px]">{card.name}</span>
      {caption ? <span className="text-[13px]/5 sm:text-sm/[22px]">{caption}</span> : null}
    </span>
  </Link>
)

const Heading = ({ block, num }: { block: Extract<WikiBlock, { type: 'heading' }>; num?: string }) => {
  const anchor = (
    <a
      href={`#${block.anchor}`}
      aria-label={`Link to ${block.text}`}
      className="ml-auto font-mono text-sm text-ink-muted opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
    >
      #
    </a>
  )
  return block.level === 2 ? (
    <div id={block.anchor} className="group clear-both mt-10.5 mb-5 flex scroll-mt-24 items-baseline gap-2.5 border-t border-line pt-4 sm:mt-14 sm:gap-3.5 sm:pt-5">
      <span className="font-display text-lg text-gold sm:text-[22px]">{num}</span>
      <h2 className="text-[28px] text-ink display-2 sm:text-4xl/[1.05]">{block.text}</h2>
      {anchor}
    </div>
  ) : (
    <div id={block.anchor} className="group mt-6 mb-5 flex scroll-mt-24 items-baseline gap-2.5 sm:mt-8">
      <h3 className="text-xl/[1.1] text-ink display-3 sm:text-[22px]">{block.text}</h3>
      {anchor}
    </div>
  )
}

type Share = { url: string; title: string }

type BlockProps = {
  block: WikiBlock
  assets: Record<string, WikiAsset>
  html: DocHtml
  share?: Share
  /** An H2's number. */
  num?: string
  /** The article opens with this block: its first paragraph is the lead. */
  first?: boolean
  /** The first FAQ of the article shows its first answer. */
  openFaq?: boolean
}

const Block = ({ block, assets, html, share, num, first, openFaq }: BlockProps) => {
  switch (block.type) {
    case 'text':
      return (
        <Markdown
          html={html[block.id]}
          className={twMerge('mb-5', first && '[&>p:first-child]:text-[17px]/7 [&>p:first-child]:text-ink sm:[&>p:first-child]:text-lg/[30px]')}
        />
      )

    case 'heading':
      return <Heading block={block} num={num} />

    case 'statistics-deck':
      return <StatisticsDeck deck={block.deck} caption={block.caption} />
    case 'article-preview':
      return <Markdown html={html[block.id]} />

    case 'figure': {
      const asset = assets[block.asset]
      if (!asset) return null
      const mobile = block.mobileAsset ? assets[block.mobileAsset] : undefined
      const anchor = `figure-${block.id}`
      const floats = block.align === 'left' || block.align === 'right'
      return (
        <figure id={block.share ? anchor : undefined} className={twMerge(ALIGN[block.align], 'flex scroll-mt-24 flex-col gap-2')}>
          {block.share && share ? <ShareButtons url={`${share.url}#${anchor}`} title={block.caption || share.title} label="Share figure" small /> : null}
          <Zoomable asset={asset} mobile={mobile} caption={block.caption}>
            <FigureImage asset={asset} mobile={mobile} wide={block.align === 'wide'} />
          </Zoomable>
          <Caption credit={asset.credit} row={!floats}>
            {block.caption}
          </Caption>
        </figure>
      )
    }

    case 'gallery':
      return (
        <figure className="clear-both my-5 flex flex-col gap-2">
          <Lightbox layout={block.layout} assets={block.assets.flatMap((id) => (assets[id] ? [assets[id]] : []))} caption={block.caption} />
        </figure>
      )

    case 'cards': {
      const [only] = block.cards
      if (block.cards.length === 1 && only) return <CardFeature card={only} caption={block.caption} html={html} />
      const perRow = block.perRow ?? 4
      const dense = perRow >= 5
      return (
        <figure className="clear-both my-5 flex flex-col gap-2.5">
          {/* Sized by hand rather than a grid, so `align` can place a short last row. */}
          <ul
            style={{ '--per-row': perRow, '--gap': dense ? '12px' : '16px' } as React.CSSProperties}
            className={twMerge('flex flex-wrap gap-(--gap) [--cols:2] max-sm:[--gap:12px]! sm:[--cols:var(--per-row)]', CARDS_ALIGN[block.align ?? 'left'])}
          >
            {block.cards.map((card) => (
              <li key={card.id} className="w-[calc((100%-(var(--cols)-1)*var(--gap))/var(--cols))]">
                <Link
                  href={`/wiki/card/${card.id}`}
                  className="group flex flex-col gap-2 text-ink transition-[translate] duration-120 ease-out hover:-translate-y-0.5 hover:text-ink motion-reduce:transition-none"
                >
                  <span className="block group-hover:outline-2 group-hover:outline-offset-2 group-hover:outline-cyan">
                    <CardFace card={card} html={html} sizes={`(min-width: 640px) ${Math.ceil(680 / perRow)}px, 50vw`} />
                  </span>
                  <span className={twMerge('line-clamp-2 text-[13px]/[18px] font-bold', dense && 'sm:text-xs/4')}>{card.name}</span>
                  {card.note ? <span className={twMerge('text-ink-muted signal-sm', dense && 'sm:text-[9px] sm:tracking-[0.14em]')}>{card.note}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
          <Caption>{block.caption}</Caption>
        </figure>
      )
    }

    case 'callout': {
      const tone = CALLOUT[block.tone]
      return (
        <aside className={twMerge('cut clear-both my-5 flex gap-3 px-4 py-3.5 sm:gap-3.5 sm:px-4.5 sm:py-4', tone.box)}>
          <span aria-hidden className={twMerge('mt-0.5 shrink-0', tone.title)}>
            {tone.icon}
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            {block.title ? <p className={twMerge('signal-strong', tone.title)}>{block.title}</p> : null}
            <Markdown html={html[block.id]} className="[&_li]:text-[15px]/6 [&_p]:mb-2 [&_p]:text-[15px]/6 [&_p]:text-ink [&_p:last-child]:mb-0" />
          </div>
        </aside>
      )
    }

    case 'quote':
      return (
        <figure className={twMerge('clear-both my-5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 py-1 sm:gap-x-4.5 sm:gap-y-2.5', block.cite && 'sm:py-2')}>
          <span aria-hidden className={twMerge('row-span-2 font-display text-[56px] leading-[0.8] text-gold', block.cite && 'sm:text-[72px]')}>
            “
          </span>
          <blockquote className={twMerge('text-xl/[29px] font-medium text-ink sm:text-[22px]/8', block.cite && 'sm:text-2xl/[34px]')}>{block.text}</blockquote>
          {block.cite ? <figcaption className="text-ink-muted signal">— {block.cite}</figcaption> : null}
        </figure>
      )

    case 'code':
      return (
        <figure className="clear-both my-5 flex flex-col gap-2">
          <CodeBlock language={CODE_LANGUAGES[block.lang]} code={block.code} html={html[block.id]} />
          <Caption>{block.caption}</Caption>
        </figure>
      )

    case 'video':
      return (
        <figure className="clear-both my-5 flex flex-col gap-2">
          <Video videoId={block.videoId} title={block.title} start={block.start} />
          <Caption>{block.caption}</Caption>
        </figure>
      )

    case 'faq':
      return (
        <section aria-label="Frequently asked questions" className="clear-both my-5 grid gap-px border border-line bg-line">
          {block.items.map((item, i) => (
            <details key={i} open={openFaq && i === 0} className="group bg-surface-100">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-[15px]/[22px] font-bold text-ink sm:gap-4 sm:px-5 sm:text-base/[22px] [&::-webkit-details-marker]:hidden">
                {item.q}
                <span aria-hidden className="font-mono text-xl text-cyan transition-transform duration-120 ease-out group-open:rotate-45 motion-reduce:transition-none">
                  +
                </span>
              </summary>
              <Markdown html={html[faqKey(block.id, i)]} className="px-4 pb-4 sm:px-5 sm:pb-4.5" />
            </details>
          ))}
        </section>
      )

    default:
      // A new block type fails to compile here until it is handled.
      return block satisfies never
  }
}

/** Each H2's number, by block id. The contents list reads the same ones. */
export const headingNumbers = (doc: WikiDoc) =>
  new Map(doc.blocks.flatMap((block) => (block.type === 'heading' && block.level === 2 ? [block.id] : [])).map((id, i) => [id, String(i + 1).padStart(2, '0')]))

type WikiBlocksProps = { doc: WikiDoc; html: DocHtml; className?: string; shareUrl?: string; lead?: React.ReactNode }

/**
 * The article flow. `flow-root` keeps floated figures inside it. `html` comes from `renderDocHtml(doc)`.
 * Synchronous and client-safe, so the editor preview renders through this exact component.
 * `shareUrl`: the article's address, which a figure's share buttons point at. Without it they don't show.
 * `lead`: goes right after the opening paragraph, which is the article's first impression. No opening text, it goes first.
 */
export const WikiBlocks = ({ doc, html, className, shareUrl, lead }: WikiBlocksProps) => {
  const numbers = headingNumbers(doc)
  const firstFaq = doc.blocks.find((block) => block.type === 'faq')?.id
  const opensWithText = doc.blocks[0]?.type === 'text'
  return (
    <div className={twMerge('flow-root', className)}>
      {opensWithText ? null : lead}
      {doc.blocks.map((block, i) => (
        <Fragment key={block.id}>
          <Block
            block={block}
            assets={doc.assets}
            html={html}
            share={shareUrl ? { url: shareUrl, title: doc.title } : undefined}
            num={numbers.get(block.id)}
            first={i === 0}
            openFaq={block.id === firstFaq}
          />
          {opensWithText && i === 0 ? lead : null}
        </Fragment>
      ))}
    </div>
  )
}
