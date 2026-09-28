'use client'

import { useRef, useState } from 'react'
import { Icon } from '@ui/icon'
import type { Cosmetic } from '@utils/types'
import { parseYouTube } from '@utils/wiki-doc'

const BUTTON = 'flex size-9 shrink-0 items-center justify-center text-ink-dim hover:bg-surface-300 hover:text-ink'

/**
 * The equipped SONG, audio only: the YouTube player sits off-screen and the bar drives it over
 * postMessage. Nothing loads until the first play, like the wiki's click-to-load video.
 */
export const SongPlayer = ({ song }: { song: Cosmetic }) => {
  const frame = useRef<HTMLIFrameElement>(null)
  const [started, setStarted] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const videoId = song.ext ? parseYouTube(song.ext)?.videoId : null
  if (!videoId) return null

  const command = (func: string) =>
    frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args: [] }), '*')

  const toggle = () => {
    if (!started) setStarted(true) // autoplay=1 starts it
    else command(playing ? 'pauseVideo' : 'playVideo')
    setPlaying(!playing)
  }
  const toggleMute = () => {
    command(muted ? 'unMute' : 'mute')
    setMuted(!muted)
  }

  const query = new URLSearchParams({ autoplay: '1', loop: '1', playlist: videoId, enablejsapi: '1', controls: '0' })

  return (
    <div className="fixed right-4 bottom-4 z-40 flex max-w-[calc(100vw-32px)] items-center gap-1 border border-line-strong bg-surface-200 py-1 pr-1 pl-3 shadow-lift">
      <Icon name="song" size={14} className="text-cyan" />
      <span className="max-w-[24ch] min-w-0 truncate px-1.5 text-ink body-sm">{song.name}</span>
      <button type="button" onClick={toggle} aria-label={playing ? 'Pause song' : 'Play song'} className={BUTTON}>
        <Icon name={playing ? 'pause' : 'play'} size={16} />
      </button>
      <button type="button" onClick={toggleMute} disabled={!started} aria-label={muted ? 'Unmute' : 'Mute'} className={`${BUTTON} disabled:opacity-40`}>
        <Icon name={muted ? 'muted' : 'volume'} size={16} />
      </button>
      {started ? (
        <iframe
          ref={frame}
          src={`https://www.youtube-nocookie.com/embed/${videoId}?${query}`}
          title={song.name}
          allow="autoplay; encrypted-media"
          tabIndex={-1}
          aria-hidden
          className="pointer-events-none absolute size-px opacity-0"
        />
      ) : null}
    </div>
  )
}
