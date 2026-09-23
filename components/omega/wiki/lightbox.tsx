'use client'

import Image from 'next/image'
import { useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { imageSource, type GalleryLayout, type WikiAsset } from '@utils/wiki-doc'

const LIST: Record<GalleryLayout, string> = {
  grid: 'grid grid-cols-2 gap-px bg-line sm:grid-cols-3',
  masonry: 'columns-2 gap-2 sm:columns-3 [&>li]:mb-2 [&>li]:break-inside-avoid',
  strip: 'flex snap-x snap-mandatory gap-2 overflow-x-auto pb-2 [&>li]:w-[min(78%,420px)] [&>li]:shrink-0 [&>li]:snap-start',
}

const focal = (asset: WikiAsset) => (asset.focal ? `${asset.focal.x}% ${asset.focal.y}%` : undefined)

const NAV = 'inline-flex min-h-10.5 min-w-10.5 items-center justify-center border border-line bg-surface-100 text-ink signal-sm hover:border-gold hover:text-gold'

/** Thumbnails that open a modal viewer. Native `<dialog>` owns focus trapping, Escape and the backdrop. */
export const Lightbox = ({ assets, layout }: { assets: WikiAsset[]; layout: GalleryLayout }) => {
  const dialog = useRef<HTMLDialogElement>(null)
  const [index, setIndex] = useState(0)
  const current = assets[index]

  const open = (i: number) => {
    setIndex(i)
    dialog.current?.showModal()
  }
  const step = (delta: number) => setIndex((i) => (i + delta + assets.length) % assets.length)

  return (
    <>
      <ul className={LIST[layout]}>
        {assets.map((asset, i) => (
          <li key={asset.id} className="bg-surface-000">
            <button
              type="button"
              onClick={() => open(i)}
              aria-label={`Enlarge: ${asset.alt}`}
              className="group relative block w-full cursor-zoom-in overflow-hidden"
            >
              <Image
                {...imageSource(asset, 640)}
                alt={asset.alt}
                width={asset.width}
                height={asset.height}
                sizes="(min-width: 1024px) 280px, 50vw"
                style={{ objectPosition: focal(asset) }}
                className={twMerge(
                  'w-full transition-[transform,filter] duration-300 group-hover:scale-[1.03] group-hover:brightness-110 motion-reduce:transition-none',
                  layout === 'masonry' ? 'h-auto' : 'aspect-square object-cover',
                  layout === 'strip' && 'aspect-video',
                )}
              />
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialog}
        aria-label="Image viewer"
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight') step(1)
          if (event.key === 'ArrowLeft') step(-1)
        }}
        className="m-auto max-h-none max-w-none bg-transparent p-4 text-ink backdrop:bg-scrim backdrop:backdrop-blur-sm"
      >
        {current ? (
          <figure className="flex flex-col items-center gap-3">
            <Image
              {...imageSource(current, 1920)}
              alt={current.alt}
              width={current.width}
              height={current.height}
              sizes="100vw"
              className="h-auto max-h-[78dvh] w-auto max-w-[min(1200px,92vw)] border border-line object-contain"
            />
            <figcaption className="flex w-full max-w-[min(1200px,92vw)] items-center gap-3">
              <span className="text-gold mono-data">
                {index + 1}/{assets.length}
              </span>
              <span className="min-w-0 flex-1 truncate text-ink-dim body-sm">
                {current.alt}
                {current.credit ? <span className="text-ink-muted"> · {current.credit}</span> : null}
              </span>
              <button type="button" onClick={() => step(-1)} aria-label="Previous image" className={NAV}>
                ←
              </button>
              <button type="button" onClick={() => step(1)} aria-label="Next image" className={NAV}>
                →
              </button>
              <form method="dialog">
                <button type="submit" aria-label="Close viewer" className={NAV}>
                  ✕
                </button>
              </form>
            </figcaption>
          </figure>
        ) : null}
      </dialog>
    </>
  )
}
