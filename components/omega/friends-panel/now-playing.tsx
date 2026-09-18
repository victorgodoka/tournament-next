import type { Song } from "@utils/types";

/** Live indicator: an 8px cyan square stepping between full and dim opacity. */
export const Equalizer = () => <span aria-hidden className="block size-2 shrink-0 animate-blink bg-cyan" />

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
        className="mt-0.5 block truncate text-[13px] font-bold text-ink hover:text-cyan"
      >
        {song.title ?? 'Unknown title'}
      </a>
    </div>
  </div>
)
