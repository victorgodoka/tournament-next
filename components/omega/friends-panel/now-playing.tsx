import { twMerge } from "tailwind-merge";
import type { Song } from "@utils/types";

/** Live indicator: animated bars while a saved song is playing. */
export const Equalizer = ({ active = true }: { active?: boolean }) => (
  <span aria-hidden className={twMerge("equalizer-bars", !active && "equalizer-bars--idle")}>
    <span className="equalizer-bars__bar" />
    <span className="equalizer-bars__bar" />
    <span className="equalizer-bars__bar" />
    <span className="equalizer-bars__bar" />
  </span>
)

/** The song the duelist shared, linked to YouTube. */
export const NowPlaying = ({ song }: { song: Song }) => (
  <div className="flex shrink-0 items-center gap-2.5 border-b border-line bg-ground-cyan px-3.5 py-2.5">
    <Equalizer />
    <div className="min-w-0">
      <p className="text-cyan signal-sm">Now playing</p>
      <a
        href={`https://youtu.be/${song.videoId}`}
        target="_blank"
        rel="noreferrer"
        className="mt-0.5 block truncate text-ink caption font-bold hover:text-cyan"
      >
        {song.title ?? 'Unknown title'}
      </a>
    </div>
  </div>
)
