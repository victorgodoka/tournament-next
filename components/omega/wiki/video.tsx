'use client'

import Image from 'next/image'
import { useState } from 'react'

type VideoProps = { videoId: string; title: string; start?: number }

/**
 * Click-to-load YouTube. Until play, the page shows a thumbnail and talks to nobody:
 * no player script, no cookies, no third-party request beyond the image.
 */
export const Video = ({ videoId, title, start }: VideoProps) => {
  const [playing, setPlaying] = useState(false)
  const query = new URLSearchParams({ autoplay: '1', rel: '0', ...(start ? { start: String(start) } : {}) })

  return (
    <div className="relative aspect-video overflow-hidden border border-line bg-surface-200">
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?${query}`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 size-full"
        />
      ) : (
        <button type="button" onClick={() => setPlaying(true)} aria-label={`Play video: ${title}`} className="group absolute inset-0 block">
          {/* `unoptimized`: YouTube already serves this sized, and the optimiser doesn't know its host. */}
          <Image
            src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
            alt=""
            fill
            unoptimized
            className="object-cover brightness-[.7] transition-[filter] duration-300 group-hover:brightness-90 motion-reduce:transition-none"
          />
          <span className="absolute inset-x-0 bottom-0 flex items-center gap-3.5 bg-linear-to-t from-veil-base to-transparent px-4 pt-10 pb-4 text-left">
            <span
              aria-hidden
              className="flex size-12 shrink-0 items-center justify-center bg-cyan text-cyan-on shadow-lift transition-transform group-hover:scale-105 motion-reduce:transition-none"
            >
              ▶
            </span>
            <span className="min-w-0 truncate text-ink body-strong">{title}</span>
          </span>
        </button>
      )}
    </div>
  )
}
