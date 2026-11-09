'use client'

import Image, { getImageProps } from 'next/image'
import { useRef, useState, type RefObject } from 'react'
import { twMerge } from 'tailwind-merge'
import { Icon } from '@ui/icon'
import { type GalleryLayout, type WikiAsset } from '@utils/wiki-doc'
import { WIKI_CHIP } from './wiki'

const LIST: Record<GalleryLayout, string> = {
  grid: 'grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2',
  masonry: 'columns-2 gap-2 sm:columns-3 [&>li]:mb-2 [&>li]:break-inside-avoid',
  strip: 'flex snap-x snap-mandatory gap-2 overflow-x-auto [&>li]:w-[min(78%,300px)] [&>li]:shrink-0 [&>li]:snap-start',
}

/** On a phone a grid shows this many, the last one counting the rest. */
const PHONE_TILES = 4

const focal = (asset: WikiAsset) => (asset.focal ? `${asset.focal.x}% ${asset.focal.y}%` : undefined)

const STEP = 'cut flex size-11 shrink-0 cursor-pointer items-center justify-center text-ink [--edge:var(--color-line-strong)] hover:[--fill:var(--color-surface-300)]'

/** One image in the viewer; `mobile`, a phone-shaped version the viewer shows under the `sm` breakpoint. */
type Slide = { asset: WikiAsset; mobile?: WikiAsset }

const VIEWED = 'h-auto max-h-full w-auto max-w-full border border-line object-contain'

const ViewedImage = ({ asset, mobile }: Slide) => {
  const image = { src: asset.src, alt: asset.alt, width: asset.width, height: asset.height, sizes: '100vw', className: VIEWED }
  if (!mobile) return <Image {...image} alt={asset.alt} />
  const { props: small } = getImageProps({ src: mobile.src, alt: '', width: mobile.width, height: mobile.height, sizes: '100vw' })
  return (
    // `contents`: the image sizes against the figure, not an inline box around it.
    <picture className="contents">
      <source media="(max-width: 639px)" srcSet={small.srcSet ?? small.src} width={mobile.width} height={mobile.height} />
      {/* eslint-disable-next-line jsx-a11y/alt-text -- `alt` is in the props. */}
      <img {...getImageProps(image).props} />
    </picture>
  )
}

type ViewerProps = {
  dialog: RefObject<HTMLDialogElement | null>
  slides: Slide[]
  index: number
  step: (delta: number) => void
  caption?: string
}

/** The modal viewer. Native `<dialog>` owns focus trapping, Escape and the backdrop. One slide hides the stepping. */
const Viewer = ({ dialog, slides, index, step, caption }: ViewerProps) => {
  const current = slides[index]
  const many = slides.length > 1
  return (
    <dialog
      ref={dialog}
      aria-label={caption ? `${many ? 'Gallery' : 'Image'}: ${caption}` : 'Image viewer'}
      onKeyDown={(event) => {
        if (!many) return
        if (event.key === 'ArrowRight') step(1)
        if (event.key === 'ArrowLeft') step(-1)
      }}
      className="m-0 h-dvh max-h-none w-dvw max-w-none bg-transparent p-0 text-ink-dim backdrop:bg-[rgba(4,5,12,0.86)] backdrop:backdrop-blur-[10px]"
    >
      {current ? (
        <div className="flex h-full flex-col">
          <div className="flex h-15 shrink-0 items-center gap-5 border-b border-line px-4 sm:h-18 sm:px-8">
            {many ? (
              <span className="whitespace-nowrap text-ink signal-strong">
                {index + 1} / {slides.length}
              </span>
            ) : null}
            {caption ? <span className="min-w-0 truncate text-sm/5">{caption}</span> : null}
            <span className="ml-auto whitespace-nowrap text-ink-muted signal-sm max-sm:hidden">{many ? '← → move · Esc closes' : 'Esc closes'}</span>
            <form method="dialog" className="max-sm:ml-auto">
              <button type="submit" aria-label="Close viewer" className={STEP}>
                <Icon name="close" size={18} />
              </button>
            </form>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-between gap-2 px-2 sm:gap-8 sm:px-8">
            {many ? (
              <button type="button" onClick={() => step(-1)} aria-label="Previous image" className={twMerge(STEP, 'sm:size-14')}>
                <Icon name="left" size={22} />
              </button>
            ) : null}
            <figure className="flex h-full min-w-0 flex-1 items-center justify-center py-4">
              <ViewedImage {...current} />
            </figure>
            {many ? (
              <button type="button" onClick={() => step(1)} aria-label="Next image" className={twMerge(STEP, 'sm:size-14')}>
                <Icon name="right" size={22} />
              </button>
            ) : null}
          </div>

          <div className="flex min-h-18 shrink-0 items-center gap-6 border-t border-line px-4 py-3 sm:min-h-22 sm:px-8">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="truncate text-[15px]/[22px] font-medium text-ink">{current.asset.alt}</span>
              {current.asset.credit ? <span className="text-ink-muted signal-sm">{current.asset.credit}</span> : null}
            </div>
            {many ? (
              <div aria-hidden className="ml-auto flex shrink-0 flex-wrap justify-end gap-1.5 max-sm:hidden">
                {slides.map(({ asset }, i) => (
                  <span key={asset.id} className={twMerge('h-[3px] w-7', i === index ? 'bg-cyan' : 'bg-line-mid')} />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </dialog>
  )
}

const ZOOM = 'cursor-zoom-in hover:outline-2 hover:outline-offset-2 hover:outline-cyan focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan'

type ZoomableProps = Slide & { caption?: string; children: React.ReactNode }

/** A figure's image that opens, larger, in the gallery's viewer. `children` is the image as the article shows it. */
export const Zoomable = ({ asset, mobile, caption, children }: ZoomableProps) => {
  const dialog = useRef<HTMLDialogElement>(null)
  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()} aria-label={`Enlarge: ${asset.alt}`} className={twMerge('block w-full', ZOOM)}>
        {children}
      </button>
      <Viewer dialog={dialog} slides={[{ asset, mobile }]} index={0} step={() => {}} caption={caption} />
    </>
  )
}

type LightboxProps = {
  assets: WikiAsset[]
  layout: GalleryLayout
  caption?: string
}

/** Thumbnails that open the viewer. */
export const Lightbox = ({ assets, layout, caption }: LightboxProps) => {
  const dialog = useRef<HTMLDialogElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const [index, setIndex] = useState(0)
  const hidden = assets.length - PHONE_TILES

  const open = (i: number) => {
    setIndex(i)
    dialog.current?.showModal()
  }
  const step = (delta: number) => setIndex((i) => (i + delta + assets.length) % assets.length)
  const slide = (direction: 1 | -1) => list.current?.scrollBy({ left: direction * 308, behavior: 'smooth' })

  return (
    <>
      <ul ref={list} className={LIST[layout]}>
        {assets.map((asset, i) => (
          <li key={asset.id} className={twMerge(layout === 'grid' && i >= PHONE_TILES && 'max-sm:hidden')}>
            <button
              type="button"
              onClick={() => open(i)}
              aria-label={`Enlarge: ${asset.alt}`}
              className={twMerge('relative block w-full bg-surface-200', ZOOM)}
            >
              <Image
                src={asset.src}
                alt={asset.alt}
                width={asset.width}
                height={asset.height}
                sizes="(min-width: 640px) 300px, 50vw"
                style={{ objectPosition: focal(asset) }}
                className={twMerge(
                  'w-full',
                  layout === 'masonry' && 'h-auto',
                  layout === 'grid' && 'aspect-square object-cover',
                  layout === 'strip' && 'aspect-video object-cover',
                )}
              />
              {layout === 'grid' && hidden > 0 && i === PHONE_TILES - 1 ? (
                <span aria-hidden className="absolute inset-0 flex items-center justify-center bg-[rgba(8,10,20,0.72)] font-display text-[28px] text-ink sm:hidden">
                  +{hidden}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>

      <figcaption className="flex items-baseline justify-between gap-4 text-ink-dim body-sm">
        {caption ? <span>{caption}</span> : <span />}
        {layout === 'strip' ? (
          <span className="flex gap-1.5 self-center">
            <button type="button" onClick={() => slide(-1)} aria-label="Previous" className={twMerge(WIKI_CHIP, 'size-9 justify-center px-0')}>
              <Icon name="left" size={16} />
            </button>
            <button type="button" onClick={() => slide(1)} aria-label="Next" className={twMerge(WIKI_CHIP, 'size-9 justify-center px-0')}>
              <Icon name="right" size={16} />
            </button>
          </span>
        ) : (
          <span className="whitespace-nowrap text-ink-muted signal-sm">{assets.length} images</span>
        )}
      </figcaption>

      <Viewer dialog={dialog} slides={assets.map((asset) => ({ asset }))} index={index} step={step} caption={caption} />
    </>
  )
}
