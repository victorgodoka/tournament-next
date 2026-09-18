import Image from 'next/image'
import { twMerge } from 'tailwind-merge'

type ArtTileProps = {
  src: string
  /** Pass `""` for a decorative tile. */
  alt: string
  /** Accent the duotone washes with. Alternate cyan, gold and indigo across a collage. */
  wash?: 'cyan' | 'gold' | 'indigo'
  /** Heavier wash and eager loading, for the one lead tile in a collage. */
  lead?: boolean
  /** Mono corner label printed in the page color over the wash. */
  label?: string
  /** Ink border plus the void offset shadow. */
  framed?: boolean
  width: number
  height: number
  sizes?: string
  className?: string
  imageClassName?: string
}

const WASH = { cyan: 'bg-cyan', gold: 'bg-gold', indigo: 'bg-indigo' }

/** Duotone image: grayscale plate with an accent layer blended in `color` mode. Never full color. */
export const ArtTile = ({ src, alt, wash = 'cyan', lead, label, framed, width, height, sizes, className, imageClassName }: ArtTileProps) => (
  <div className={twMerge('relative overflow-hidden bg-surface-200', framed && 'border border-line-strong shadow-offset-void', className)}>
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      loading={lead ? 'eager' : undefined}
      priority={lead}
      className={twMerge('block size-full object-cover duotone', imageClassName)}
    />
    <span aria-hidden className={twMerge('duotone-wash', WASH[wash], lead && 'opacity-(--opacity-duotone-lead)')} />
    {label ? <span className="absolute bottom-3 left-3.5 text-surface-000 signal">{label}</span> : null}
  </div>
)
