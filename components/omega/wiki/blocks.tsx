import Image, { getImageProps } from 'next/image'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'
import { CardImage } from '@omega/card-art'
import { CARD_ART_URL } from '@utils/const'
import { faqKey, imageSource, type CalloutTone, type CardsAlign, type DocHtml, type FigureAlign, type WikiAsset, type WikiBlock, type WikiDoc } from '@utils/wiki-doc'
import { Lightbox } from './lightbox'
import { ShareButtons } from './share-buttons'
import { Video } from './video'

/** Floats sit beside the text that follows; everything wider clears them first. */
const ALIGN: Record<FigureAlign, string> = {
  left: 'mb-4 sm:float-left sm:mr-6 sm:mt-1.5 sm:w-[min(300px,42%)]',
  right: 'mb-4 sm:float-right sm:ml-6 sm:mt-1.5 sm:w-[min(300px,42%)]',
  center: 'clear-both mx-auto my-7 max-w-[560px]',
  wide: 'clear-both my-7',
}

const CALLOUT: Record<CalloutTone, { box: string; dot: string; title: string }> = {
  gold: { box: 'border-cyan bg-ground-cyan', dot: 'bg-cyan', title: 'text-cyan' },
  cyan: { box: 'border-cyan bg-ground-cyan', dot: 'bg-cyan', title: 'text-cyan' },
  negative: { box: 'border-loss bg-ground-loss', dot: 'bg-loss', title: 'text-loss' },
}

const CARDS_ALIGN: Record<CardsAlign, string> = { left: 'justify-start', center: 'justify-center', right: 'justify-end' }

const Caption =({ children, credit }: { children?: React.ReactNode; credit?: string }) =>
  children || credit ? (
    <figcaption className="mt-2 border-l-2 border-cyan pl-2.5 text-ink-muted caption">
      {children}
      {credit ? <span className="block text-ink-muted micro">{credit}</span> : null}
    </figcaption>
  ) : null

/** Nodes from `renderDocHtml`: parsed, classed and sanitized before they get here. */
const Markdown = ({ html, className }: { html?: React.ReactNode; className?: string }) => <div className={className}>{html}</div>

const FIGURE_IMAGE = 'h-auto w-full border border-line'

/** A `<picture>` when there is a mobile image: the browser fetches one of the two, never both. */
const FigureImage = ({ asset, mobile, wide }: { asset: WikiAsset; mobile?: WikiAsset; wide: boolean }) => {
  const image = {
    ...imageSource(asset, wide ? 1600 : 640),
    width: asset.width,
    height: asset.height,
    sizes: wide ? '(min-width: 1024px) 860px, 100vw' : '(min-width: 640px) 300px, 100vw',
    className: FIGURE_IMAGE,
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

type Share = { url: string; title: string }

type BlockProps = { block: WikiBlock; assets: Record<string, WikiAsset>; html: DocHtml; share?: Share }

const Block = ({ block, assets, html, share }: BlockProps) => {
  switch (block.type) {
    case 'text':
      return <Markdown html={html[block.id]} className="mb-4" />

    case 'heading': {
      const Tag = `h${block.level}` as const
      return (
        <Tag
          id={block.anchor}
          className={twMerge(
            'scroll-mt-24 text-ink',
            block.level === 2 ? 'clear-both mt-10 mb-3.5 border-t border-line pt-6 display-2' : 'mt-7 mb-2.5 display-4',
          )}
        >
          <a href={`#${block.anchor}`} className="text-ink hover:text-cyan">
            {block.text}
          </a>
        </Tag>
      )
    }

    case 'figure': {
      const asset = assets[block.asset]
      if (!asset) return null
      const anchor = `figure-${block.id}`
      return (
        <figure id={block.share ? anchor : undefined} className={twMerge(ALIGN[block.align], 'scroll-mt-24')}>
          {block.share && share ? (
            <div className="mb-2 flex justify-end">
              <ShareButtons url={`${share.url}#${anchor}`} title={block.caption || share.title} />
            </div>
          ) : null}
          <FigureImage asset={asset} mobile={block.mobileAsset ? assets[block.mobileAsset] : undefined} wide={block.align === 'wide'} />
          <Caption credit={asset.credit}>{block.caption}</Caption>
        </figure>
      )
    }

    case 'gallery':
      return (
        <figure className="clear-both my-7">
          <Lightbox layout={block.layout} assets={block.assets.flatMap((id) => (assets[id] ? [assets[id]] : []))} />
          <Caption>{block.caption}</Caption>
        </figure>
      )

    case 'cards': {
      const perRow = block.perRow ?? 4
      // Each card draws its own 1px outline over a 1px gap, so a short last row leaves no empty cells behind.
      return (
        <figure className="clear-both my-7">
          <ul
            style={{ '--per-row': perRow } as React.CSSProperties}
            className={twMerge('flex flex-wrap gap-px p-px [--cols:2] sm:[--cols:var(--per-row)]', CARDS_ALIGN[block.align ?? 'left'])}
          >
            {block.cards.map((card) => (
              <li key={card.id} className="w-[calc(100%/var(--cols)_-_1px)] bg-space-000 outline outline-line">
                <Link href={`/wiki/card/${card.id}`} className="group block">
                  <span className="relative block aspect-square overflow-hidden">
                    <CardImage
                      src={CARD_ART_URL(card.id)}
                      alt={`${card.name} card artwork`}
                      fill
                      sizes={`(min-width: 640px) ${Math.ceil(860 / perRow)}px, 50vw`}
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.04] motion-reduce:transition-none"
                    />
                  </span>
                  <span className="block px-3 py-2.5">
                    <span className="block truncate text-ink body-strong group-hover:text-cyan">{card.name}</span>
                    {card.note ? <span className="block truncate text-ink-muted signal-sm">{card.note}</span> : null}
                  </span>
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
        <aside className={twMerge('clear-both my-6 flex gap-3 border px-4.5 py-4', tone.box)}>
          <span aria-hidden className={twMerge('mt-1.5 size-2.25 shrink-0', tone.dot)} />
          <div className="min-w-0">
            {block.title ? <p className={twMerge('mb-1.5 signal-sm', tone.title)}>{block.title}</p> : null}
            <Markdown html={html[block.id]} />
          </div>
        </aside>
      )
    }

    case 'quote':
      return (
        <figure className="clear-both my-8 border-l-2 border-cyan pl-5">
          <blockquote className="text-ink display-5 normal-case">“{block.text}”</blockquote>
          {block.cite ? <figcaption className="mt-2.5 text-ink-muted signal-sm">— {block.cite}</figcaption> : null}
        </figure>
      )

    case 'code':
      return (
        <figure className="clear-both my-6">
          <Markdown html={html[block.id]} className="[&_pre]:my-0" />
          <Caption>{block.caption}</Caption>
        </figure>
      )

    case 'video':
      return (
        <figure className="clear-both my-7">
          <Video videoId={block.videoId} title={block.title} start={block.start} />
          <Caption>{block.caption}</Caption>
        </figure>
      )

    case 'faq':
      return (
        <section aria-label="Frequently asked questions" className="clear-both my-8 border-t border-line">
          {block.items.map((item, i) => (
            <details key={i} className="group border-b border-line">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 py-4 text-ink body-strong hover:text-cyan [&::-webkit-details-marker]:hidden">
                {item.q}
                <span aria-hidden className="text-cyan transition-transform group-open:rotate-45 motion-reduce:transition-none">
                  +
                </span>
              </summary>
              <Markdown html={html[faqKey(block.id, i)]} className="pb-4 text-ink-dim" />
            </details>
          ))}
        </section>
      )

    default:
      // A new block type fails to compile here until it is handled.
      return block satisfies never
  }
}

/**
 * The article flow. `flow-root` keeps floated figures inside it. `html` comes from `renderDocHtml(doc)`.
 * Synchronous and client-safe, so the editor preview renders through this exact component.
 * `shareUrl`: the article's address, which a figure's share buttons point at. Without it they don't show.
 */
export const WikiBlocks = ({ doc, html, className, shareUrl }: { doc: WikiDoc; html: DocHtml; className?: string; shareUrl?: string }) => (
  <div className={twMerge('flow-root', className)}>
    {doc.blocks.map((block) => (
      <Block key={block.id} block={block} assets={doc.assets} html={html} share={shareUrl ? { url: shareUrl, title: doc.title } : undefined} />
    ))}
  </div>
)
