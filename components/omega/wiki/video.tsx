'use client'

import Image from 'next/image'
import { useState } from 'react'
import { Icon } from '@ui/icon'

type VideoProps = { videoId: string; title: string; start?: number }

/**
 * Click-to-load YouTube. Until play, the page shows a thumbnail and talks to nobody:
 * no player script, no cookies, no third-party request beyond the image.
 */
export const Video = ({ videoId, title, start }: VideoProps) => {
  const [playing, setPlaying] = useState(false)
  const query = new URLSearchParams({ autoplay: '1', rel: '0', ...(start ? { start: String(start) } : {}) })

  return (
    <div className="flex flex-col gap-2">
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
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`Play video: ${title}`}
            className="group absolute inset-0 flex cursor-pointer items-center justify-center"
          >
            {/* `unoptimized`: YouTube already serves this sized, and the optimiser doesn't know its host. */}
            <Image src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`} alt="" fill unoptimized className="object-cover" />
            <span aria-hidden className="absolute inset-0 bg-linear-to-t from-[rgba(8,10,20,0.92)] to-transparent to-55%" />
            <span
              aria-hidden
              className="cut relative flex size-15 items-center justify-center text-cyan-on transition-transform duration-120 ease-out [--cut:8px] [--edge:var(--color-cyan)] [--fill:var(--color-cyan)] group-hover:scale-105 motion-reduce:transition-none sm:size-19 sm:[--cut:10px]"
            >
              <Icon name="play" size={28} />
            </span>
            <span className="absolute inset-x-5 bottom-4.5 flex items-end justify-between gap-4 text-left max-sm:hidden">
              <span className="flex min-w-0 flex-col gap-1.5">
                <span className="text-ink-dim signal-sm">YouTube</span>
                <span className="text-lg/6 font-bold text-ink">{title}</span>
              </span>
              <span className="whitespace-nowrap text-ink-dim signal-sm">Loads on play</span>
            </span>
            <span className="absolute right-2 bottom-2 bg-surface-100 px-1.5 py-1 text-ink-muted signal-sm sm:hidden">Loads on play</span>
          </button>
        )}
      </div>
      <p className="text-[15px]/[21px] font-bold text-ink sm:hidden">{title}</p>
    </div>
  )
}
