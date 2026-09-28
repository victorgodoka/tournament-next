import { twMerge } from 'tailwind-merge'

type ThumbProps = {
  /** Shown as uploaded, cover-cropped. */
  src?: string | null
  /** Two mono letters when there's no image ("WD" for WEBDECO). */
  glyph?: React.ReactNode
  alt?: string
  /** The 24px dot field of key art instead of the dense 8px one. */
  wide?: boolean
  className?: string
  children?: React.ReactNode
}

/** A square image slot. Empty, it's a dot field with a mono glyph. Size it with className (default 40px). */
export const Thumb = ({ src, glyph, alt = '', wide, className, children }: ThumbProps) => (
  <span
    className={twMerge(
      'relative grid size-10 shrink-0 place-items-center overflow-hidden bg-surface-200 bg-[radial-gradient(var(--color-line-mid)_1px,transparent_1.2px)] bg-size-[8px_8px] text-ink-muted signal-sm',
      wide && 'bg-[radial-gradient(var(--color-line-mid)_1px,transparent_1.4px)] bg-size-[24px_24px] bg-position-[12px_12px] text-line-mid',
      className,
    )}
  >
    {src ? (
      // eslint-disable-next-line @next/next/no-img-element -- CDN assets of any size; next/image needs known hosts.
      <img src={src} alt={alt} className="absolute inset-0 size-full object-contain" />
    ) : (
      (children ?? glyph)
    )}
  </span>
)
