'use client'

import Image from 'next/image'
import { useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Icon } from '@ui/icon'
import { imageSource, type GalleryLayout, type WikiAsset } from '@utils/wiki-doc'
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

type LightboxProps = {
  assets: WikiAsset[]
  layout: GalleryLayout
  caption?: string
}

/** Thumbnails that open a modal viewer. Native `<dialog>` owns focus trapping, Escape and the backdrop. */
export const Lightbox = ({ assets, layout, caption }: LightboxProps) => {
  const dialog = useRef<HTMLDialogElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const [index, setIndex] = useState(0)
  const current = assets[index]
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
              className="relative block w-full cursor-zoom-in bg-surface-200 hover:outline-2 hover:outline-offset-2 hover:outline-cyan"
            >
              <Image
                {...imageSource(asset, 640)}
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

      <dialog
        ref={dialog}
        aria-label={caption ? `Gallery: ${caption}` : 'Image viewer'}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight') step(1)
          if (event.key === 'ArrowLeft') step(-1)
        }}
        className="m-0 h-dvh max-h-none w-dvw max-w-none bg-transparent p-0 text-ink-dim backdrop:bg-[rgba(4,5,12,0.86)] backdrop:backdrop-blur-[10px]"
      >
        {current ? (
          <div className="flex h-full flex-col">
            <div className="flex h-15 shrink-0 items-center gap-5 border-b border-line px-4 sm:h-18 sm:px-8">
              <span className="whitespace-nowrap text-ink signal-strong">
                {index + 1} / {assets.length}
              </span>
              {caption ? <span className="min-w-0 truncate text-sm/5">{caption}</span> : null}
              <span className="ml-auto whitespace-nowrap text-ink-muted signal-sm max-sm:hidden">← → move · Esc closes</span>
              <form method="dialog" className="max-sm:ml-auto">
                <button type="submit" aria-label="Close viewer" className={STEP}>
                  <Icon name="close" size={18} />
                </button>
              </form>
            </div>

            <div className="flex min-h-0 flex-1 items-center justify-between gap-2 px-2 sm:gap-8 sm:px-8">
              <button type="button" onClick={() => step(-1)} aria-label="Previous image" className={twMerge(STEP, 'sm:size-14')}>
                <Icon name="left" size={22} />
              </button>
              <figure className="flex h-full min-w-0 flex-1 items-center justify-center py-4">
                <Image
                  {...imageSource(current, 1920)}
                  alt={current.alt}
                  width={current.width}
                  height={current.height}
                  sizes="100vw"
                  className="h-auto max-h-full w-auto max-w-full border border-line object-contain"
                />
              </figure>
              <button type="button" onClick={() => step(1)} aria-label="Next image" className={twMerge(STEP, 'sm:size-14')}>
                <Icon name="right" size={22} />
              </button>
            </div>

            <div className="flex min-h-18 shrink-0 items-center gap-6 border-t border-line px-4 py-3 sm:min-h-22 sm:px-8">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-[15px]/[22px] font-medium text-ink">{current.alt}</span>
                {current.credit ? <span className="text-ink-muted signal-sm">{current.credit}</span> : null}
              </div>
              <div aria-hidden className="ml-auto flex shrink-0 flex-wrap justify-end gap-1.5 max-sm:hidden">
                {assets.map((asset, i) => (
                  <span key={asset.id} className={twMerge('h-[3px] w-7', i === index ? 'bg-cyan' : 'bg-line-mid')} />
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  )
}
